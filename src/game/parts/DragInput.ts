import type Phaser from "phaser";
import type { Side } from "../../domain/engine";
import type { Point } from "../../domain/geometry";
import { BALL_START, MIN_POWER, aimFromPull, type Aim } from "../../domain/throw";
import { toCm } from "../layout";

/** How close to the ball (cm) a drag may start. */
const GRAB_RADIUS = 16;

export interface DragHandlers {
  /** Whose ball can be dragged right now, or null when throwing is not allowed. */
  grabbableSide(): Side | null;
  /** Called on every change of the drag (aim) and when it ends without a throw (null). */
  onAim(aim: Aim | null): void;
  onThrow(aim: Aim): void;
}

/** Pull-back-and-release input: the pull direction aims, the pull length sets the power. */
export class DragInput {
  private side: Side | null = null;
  private aim: Aim | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly handlers: DragHandlers,
  ) {
    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.start(p));
    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => this.move(p));
    scene.input.on("pointerup", () => this.release());
    scene.input.on("pointerupoutside", () => this.release());
  }

  /** The aim being dragged right now, if any. */
  get current(): Aim | null {
    return this.aim;
  }

  /** Abandon the current drag, e.g. when throwing is no longer allowed. */
  cancel(): void {
    if (!this.aim) return;
    this.side = null;
    this.aim = null;
    this.handlers.onAim(null);
  }

  private start(pointer: Phaser.Input.Pointer): void {
    const side = this.handlers.grabbableSide();
    if (side === null) return;
    const at = this.cm(pointer);
    const ball = BALL_START[side];
    if (Math.hypot(at.x - ball.x, at.y - ball.y) > GRAB_RADIUS) return;
    this.side = side;
    this.update(aimFromPull(ball, at) ?? this.idleAim(side));
  }

  private move(pointer: Phaser.Input.Pointer): void {
    if (this.side === null || !this.aim) return;
    const ball = BALL_START[this.side];
    this.update(aimFromPull(ball, this.cm(pointer)) ?? { ...this.aim, power: 0, handle: ball });
  }

  private release(): void {
    const aim = this.aim;
    if (!aim) return;
    this.side = null;
    this.aim = null;
    this.handlers.onAim(null);
    if (aim.power >= MIN_POWER) this.handlers.onThrow(aim);
  }

  private update(aim: Aim): void {
    this.aim = aim;
    this.handlers.onAim(aim);
  }

  private idleAim(side: Side): Aim {
    const ball = BALL_START[side];
    return { dir: { x: ball.x < 120 ? 1 : -1, y: 0 }, power: 0, handle: ball };
  }

  private cm(pointer: Phaser.Input.Pointer): Point {
    return toCm(pointer.worldX, pointer.worldY);
  }
}
