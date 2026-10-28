import type Phaser from "phaser";
import { opponent, type Shot, type Side } from "../../domain/engine";
import type { Point } from "../../domain/geometry";
import { BALL_START, touchdown, type ThrowResult } from "../../domain/throw";
import { BALL_RADIUS, U, toPx } from "../layout";
import type { Palette } from "../palette";
import type { CupLayer } from "./CupLayer";

const AIR_MS = 650;
const BOUNCE_MS = [430, 220] as const;
const SINK_SCALE = 0.4;
const SINK_ALPHA = 0.2;

/** The resting balls and the animation of a thrown ball, including what it does at the cups. */
export class BallFlight {
  private readonly resting: Record<
    Side,
    { body: Phaser.GameObjects.Arc; ring: Phaser.GameObjects.Arc }
  >;
  private readonly flying: Phaser.GameObjects.Arc;

  constructor(
    private readonly scene: Phaser.Scene,
    palette: Palette,
    private readonly cups: CupLayer,
  ) {
    const rest = (side: Side) => {
      const at = toPx(BALL_START[side]);
      return {
        ring: scene.add
          .circle(at.x, at.y, (BALL_RADIUS + 0.7) * U)
          .setStrokeStyle(0.5 * U, palette.accent),
        body: scene.add.circle(at.x, at.y, BALL_RADIUS * U, palette.strong),
      };
    };
    this.resting = { 0: rest(0), 1: rest(1) };
    this.flying = scene.add
      .circle(0, 0, BALL_RADIUS * U, palette.strong)
      .setVisible(false)
      .setDepth(10);
  }

  /** Mark whose ball is ready to throw (a glowing ring), or none. */
  highlight(side: Side | null): void {
    for (const s of [0, 1] as const) this.resting[s].ring.setVisible(s === side);
  }

  /** Animate a throw to where it lands and what it does there. Resolves when the ball is gone. */
  async play(side: Side, result: ThrowResult, shot: Shot): Promise<void> {
    const origin = BALL_START[side];
    const defender = opponent(side);
    const { landing } = result;
    this.resting[side].ring.setVisible(false);
    const ball = this.flying.setVisible(true).setAlpha(1).setScale(1);

    if (shot === "air") {
      await this.hop(ball, origin, landing, AIR_MS, 1.5);
    } else {
      const mid = touchdown(origin, landing);
      await this.hop(ball, origin, mid, BOUNCE_MS[0], 1.4);
      await this.hop(ball, mid, landing, BOUNCE_MS[1], 1.25);
    }

    const cupAt = result.touched !== null ? this.cups.positionOf(defender, result.touched) : null;
    switch (result.contact) {
      case "clean":
        if (cupAt) await this.sink(ball, cupAt, 220);
        else await this.fade(ball);
        break;
      case "rattle-in":
        if (cupAt) {
          this.cups.wobble(defender, result.touched!, 1.1);
          await this.rattle(ball, cupAt, toPx(landing));
        } else await this.fade(ball);
        break;
      case "bounce-out":
        this.cups.wobble(defender, result.touched!, 1.12);
        await this.bounceAway(ball, landing, result.bounces);
        break;
      case "ricochet": {
        this.cups.wobble(defender, result.touched!, 1.12);
        const next = result.target !== null ? this.cups.positionOf(defender, result.target) : null;
        if (result.deflect) await this.hop(ball, landing, result.deflect, 300, 1.5, "Quad.easeOut");
        if (next) await this.sink(ball, next, 200);
        else await this.fade(ball);
        break;
      }
      default:
        await this.bounceAway(ball, landing, result.bounces);
    }
    ball.setVisible(false).setAlpha(1).setScale(1);
  }

  /** Fly in a straight line while swelling and shrinking, which reads as an arc seen from above. */
  private hop(
    ball: Phaser.GameObjects.Arc,
    from: Point,
    to: Point,
    duration: number,
    peak: number,
    ease = "Linear",
  ): Promise<void> {
    const a = toPx(from);
    const b = toPx(to);
    ball.setPosition(a.x, a.y);
    this.scene.tweens.add({
      targets: ball,
      scale: peak,
      duration: duration / 2,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    return this.tween({ targets: ball, x: b.x, y: b.y, duration, ease });
  }

  /**
   * A miss: hop on through the given points, each hop lower than the last, and let the ball roll
   * to a stop. A ball that missed inside the rack thus bounces off the cups and out of the rack.
   */
  private async bounceAway(
    ball: Phaser.GameObjects.Arc,
    from: Point,
    bounces: Point[],
  ): Promise<void> {
    let at = from;
    for (const [i, next] of bounces.entries()) {
      const cm = Math.hypot(next.x - at.x, next.y - at.y);
      const duration = Math.min(420, Math.max(180, cm * 16));
      const last = i === bounces.length - 1;
      await this.hop(ball, at, next, duration, 1.7 - i * 0.25, last ? "Quad.easeOut" : "Linear");
      at = next;
    }
    await this.fade(ball);
  }

  private sink(ball: Phaser.GameObjects.Arc, at: Point, duration: number): Promise<void> {
    return this.tween({
      targets: ball,
      x: at.x,
      y: at.y,
      scale: SINK_SCALE,
      alpha: SINK_ALPHA,
      duration,
      ease: "Quad.easeIn",
    });
  }

  private fade(ball: Phaser.GameObjects.Arc): Promise<void> {
    return this.tween({ targets: ball, alpha: 0, duration: 200 });
  }

  /** Orbit the rim with a shrinking radius, then drop in. `from` and `center` are canvas pixels. */
  private async rattle(ball: Phaser.GameObjects.Arc, center: Point, from: Point): Promise<void> {
    const start = Math.atan2(from.y - center.y, from.x - center.x);
    const r0 = Math.max(Math.hypot(from.x - center.x, from.y - center.y), 2 * U);
    const progress = { t: 0 };
    await this.tween({
      targets: progress,
      t: 1,
      duration: 750,
      ease: "Sine.easeOut",
      onUpdate: () => {
        const angle = start + progress.t * Math.PI * 3.5;
        const radius = r0 * (1 - progress.t * 0.85);
        ball.setPosition(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
      },
    });
    await this.sink(ball, center, 160);
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }
}
