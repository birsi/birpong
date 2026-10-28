import type Phaser from "phaser";
import { slotPosition, opponent, type Shot, type State } from "../../domain/engine";
import {
  BALL_START,
  RING_RADIUS,
  nearestCup,
  nominalLanding,
  touchdown,
  type Aim,
} from "../../domain/throw";
import { U, toPx } from "../layout";
import type { Palette } from "../palette";

const DOT_SPACING = 1.8 * U;
const TOUCHDOWN_RADIUS = 1.8 * U;
const HANDLE_RADIUS = 1.5 * U;

/** What the player sees while dragging: aim line, landing ring, bounce marker, pull handle, target cup. */
export class AimOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly targetRing: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    private readonly palette: Palette,
  ) {
    this.graphics = scene.add.graphics();
    this.targetRing = scene.add
      .circle(0, 0, (4.3 + 0.9) * U)
      .setStrokeStyle(0.45 * U, palette.accent)
      .setVisible(false);
  }

  clear(): void {
    this.graphics.clear();
    this.targetRing.setVisible(false);
  }

  draw(aim: Aim | null, shot: Shot, state: State): void {
    this.clear();
    if (!aim) return;
    const { accent, ground, strong, surface } = this.palette;
    const g = this.graphics;
    const side = state.thrower;
    const origin = BALL_START[side];
    const landing = nominalLanding(origin, aim);
    const from = toPx(origin);
    const to = toPx(landing);

    this.dottedLine(from, to);

    // Landing ring: filled and wider for a bounce, which also gets a touchdown marker.
    const radius = RING_RADIUS[shot] * U;
    if (shot === "bounce") g.fillStyle(accent, 0.14).fillCircle(to.x, to.y, radius);
    g.lineStyle(0.45 * U, accent).strokeCircle(to.x, to.y, radius);
    if (shot === "bounce") {
      const td = toPx(touchdown(origin, landing));
      g.fillStyle(ground).fillCircle(td.x, td.y, TOUCHDOWN_RADIUS);
      g.strokeCircle(td.x, td.y, TOUCHDOWN_RADIUS);
    }

    // Pull-back handle
    const handle = toPx(aim.handle);
    g.lineStyle(0.4 * U, strong).lineBetween(from.x, from.y, handle.x, handle.y);
    g.fillStyle(surface).fillCircle(handle.x, handle.y, HANDLE_RADIUS);
    g.strokeCircle(handle.x, handle.y, HANDLE_RADIUS);

    this.highlightTarget(state, landing);
  }

  private dottedLine(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    this.graphics.fillStyle(this.palette.accent);
    for (let d = DOT_SPACING; d < length; d += DOT_SPACING) {
      this.graphics.fillCircle(
        from.x + ((to.x - from.x) * d) / length,
        from.y + ((to.y - from.y) * d) / length,
        0.28 * U,
      );
    }
  }

  /** Ring around the cup the current aim would land on. */
  private highlightTarget(state: State, landing: { x: number; y: number }): void {
    const defender = opponent(state.thrower);
    const hit = nearestCup(defender, state.cups[defender], landing);
    const cup = state.cups[defender].find((c) => c.id === hit?.id);
    if (!cup) return;
    const at = toPx(slotPosition(defender, cup.slot));
    this.targetRing.setPosition(at.x, at.y).setVisible(true);
  }
}
