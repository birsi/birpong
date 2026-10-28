import Phaser from "phaser";
import type { Shot, Side, State } from "../domain/engine";
import type { Aim, ThrowResult } from "../domain/throw";
import { readPalette } from "./palette";
import { AimOverlay } from "./parts/AimOverlay";
import { Backdrop } from "./parts/Backdrop";
import { BallFlight } from "./parts/BallFlight";
import { CupLayer } from "./parts/CupLayer";
import { DragInput } from "./parts/DragInput";

export interface SceneView {
  state: State;
  shot: Shot;
  /** False while a ball is in flight or the game is over. */
  canThrow: boolean;
  names: [string, string];
}

export interface SceneCallbacks {
  /** Called while dragging (aim) and when the drag ends (null). */
  onAim(aim: Aim | null): void;
  onThrow(aim: Aim): void;
}

/**
 * The table seen from above. It only draws what the controller tells it and reports what the
 * player does; it never decides rules.
 */
export class TableScene extends Phaser.Scene {
  private view: SceneView | null = null;
  private backdrop!: Backdrop;
  private cups!: CupLayer;
  private aim!: AimOverlay;
  private balls!: BallFlight;
  private drag!: DragInput;

  constructor(private readonly callbacks: SceneCallbacks) {
    super("table");
  }

  create(): void {
    const palette = readPalette();
    this.backdrop = new Backdrop(this, palette);
    this.cups = new CupLayer(this, palette);
    this.aim = new AimOverlay(this, palette);
    this.balls = new BallFlight(this, palette, this.cups);
    this.drag = new DragInput(this, {
      grabbableSide: () => (this.view?.canThrow ? this.view.state.thrower : null),
      onAim: (aim) => {
        if (this.view) this.aim.draw(aim, this.view.shot, this.view.state);
        this.callbacks.onAim(aim);
      },
      onThrow: (aim) => this.callbacks.onThrow(aim),
    });
    if (this.view) this.setView(this.view);
  }

  /** Show the given state. Safe to call before the scene has started; it is applied on create. */
  setView(view: SceneView): void {
    this.view = view;
    if (!this.cups) return;
    if (!view.canThrow) this.drag.cancel();
    this.backdrop.setNames(view.names);
    this.cups.sync(view.state);
    this.balls.highlight(view.canThrow ? view.state.thrower : null);
    // Redraw an aim in progress for a changed shot type.
    this.aim.draw(this.drag.current, view.shot, view.state);
  }

  /** Show an aim that is not being dragged (the CPU's), or clear it with null. */
  previewAim(aim: Aim | null, shot: Shot): void {
    if (this.view) this.aim.draw(aim, shot, this.view.state);
  }

  playFlight(side: Side, result: ThrowResult, shot: Shot): Promise<void> {
    return this.balls.play(side, result, shot);
  }
}
