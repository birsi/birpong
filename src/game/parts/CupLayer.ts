import type Phaser from "phaser";
import { CUPS_PER_SIDE, slotPosition, type Side, type State } from "../../domain/engine";
import type { Point } from "../../domain/geometry";
import { CUP_RADIUS } from "../../domain/throw";
import { U, toPx } from "../layout";
import type { Palette } from "../palette";

const RIM_WIDTH = 0.75 * U;
const SLIDE_MS = 250;

interface CupObject {
  body: Phaser.GameObjects.Arc;
  /** White dot shown inside a cup that was hit this turn. */
  dot: Phaser.GameObjects.Arc;
}

/** Draws every cup of both racks, and the dashed outlines where cups have been removed. */
export class CupLayer {
  private readonly cups = new Map<string, CupObject>();
  private readonly holes: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly palette: Palette,
  ) {
    this.holes = scene.add.graphics();
    for (const side of [0, 1] as const) {
      for (let id = 0; id < CUPS_PER_SIDE; id++) {
        this.cups.set(this.key(side, id), {
          body: scene.add
            .circle(0, 0, CUP_RADIUS * U - RIM_WIDTH / 2, palette.surface)
            .setStrokeStyle(RIM_WIDTH, palette.strong),
          dot: scene.add.circle(0, 0, (CUP_RADIUS / 4) * U, palette.strong),
        });
      }
    }
  }

  /** Centre of a cup in canvas pixels, if it is still on the table. */
  positionOf(side: Side, id: number): Point | null {
    const cup = this.cups.get(this.key(side, id));
    return cup?.body.visible ? { x: cup.body.x, y: cup.body.y } : null;
  }

  /** A short shake, e.g. when a ball clips the rim. */
  wobble(side: Side, id: number, peak: number, repeat = 1): void {
    const cup = this.cups.get(this.key(side, id));
    if (!cup) return;
    this.scene.tweens.add({
      targets: cup.body,
      scale: peak,
      duration: 70,
      yoyo: true,
      repeat,
      ease: "Sine.easeOut",
    });
  }

  /** Bring the cups in line with the engine state. */
  sync(state: State): void {
    for (const side of [0, 1] as const) {
      const standing = new Map(state.cups[side].map((cup) => [cup.id, cup]));
      for (let id = 0; id < CUPS_PER_SIDE; id++) {
        const object = this.cups.get(this.key(side, id))!;
        const cup = standing.get(id);
        if (!cup) {
          object.body.setVisible(false);
          object.dot.setVisible(false);
          continue;
        }
        const hit = side !== state.thrower && state.pending.includes(id);
        this.place(object, toPx(slotPosition(side, cup.slot)));
        this.paint(object, hit);
      }
    }
    this.drawHoles(state);
  }

  private place(object: CupObject, to: Point): void {
    const moved = object.body.x !== to.x || object.body.y !== to.y;
    if (object.body.visible && moved) {
      // Re-rack: slide the cup (and its hit dot) to the new slot.
      this.scene.tweens.add({
        targets: [object.body, object.dot],
        x: to.x,
        y: to.y,
        duration: SLIDE_MS,
        ease: "Sine.easeInOut",
      });
    } else {
      object.body.setPosition(to.x, to.y);
      object.dot.setPosition(to.x, to.y);
    }
  }

  private paint(object: CupObject, hit: boolean): void {
    const { accent, surface, strong } = this.palette;
    object.body.setVisible(true).setFillStyle(hit ? accent : surface);
    object.body.setStrokeStyle(RIM_WIDTH, hit ? accent : strong);
    object.dot.setVisible(hit);
  }

  private drawHoles(state: State): void {
    this.holes.clear().lineStyle(1, this.palette.muted);
    for (const side of [0, 1] as const) {
      const occupied = new Set(state.cups[side].map((cup) => cup.slot));
      for (let slot = 0; slot < CUPS_PER_SIDE; slot++) {
        if (!occupied.has(slot)) this.dashedCircle(toPx(slotPosition(side, slot)), CUP_RADIUS * U);
      }
    }
  }

  private dashedCircle(center: Point, radius: number): void {
    const segments = 16;
    for (let i = 0; i < segments; i += 2) {
      this.holes.beginPath();
      this.holes.arc(
        center.x,
        center.y,
        radius,
        (i / segments) * Math.PI * 2,
        ((i + 1) / segments) * Math.PI * 2,
      );
      this.holes.strokePath();
    }
  }

  private key(side: Side, id: number): string {
    return `${side}:${id}`;
  }
}
