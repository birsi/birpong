import type Phaser from "phaser";
import { rackOutline } from "../../domain/engine";
import type { Point } from "../../domain/geometry";
import { SCENE_H, SCENE_W, TABLE_X, TABLE_Y, U, toPx } from "../layout";
import { toCssColor, type Palette } from "../palette";

/** The static picture: throwing zones, table, centre circle, rack outlines and the side labels. */
export class Backdrop {
  private readonly labels: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private names: [string, string] = ["", ""];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly palette: Palette,
  ) {
    this.drawTable();
    this.labels = [this.label(3.6, 0), this.label(SCENE_W - 3.6, 1)];
    // Redraw once web fonts are loaded so the labels do not stay in the fallback font.
    void document.fonts.ready.then(() => this.applyNames());
  }

  setNames(names: [string, string]): void {
    this.names = names;
    this.applyNames();
  }

  private applyNames(): void {
    this.labels[0].setText(this.names[0].toUpperCase());
    this.labels[1].setText(this.names[1].toUpperCase());
  }

  private label(x: number, originX: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x * U, 3.5 * U, "", {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: `${2.7 * U}px`,
        color: toCssColor(this.palette.text),
      })
      .setOrigin(originX, 0);
  }

  private drawTable(): void {
    const c = this.palette;
    const g = this.scene.add.graphics();

    g.fillStyle(c.surface).fillRect(0, 0, SCENE_W * U, SCENE_H * U);
    g.lineStyle(0.25 * U, c.muted);
    for (const x of [TABLE_X, TABLE_X + 240]) {
      this.dashedLine(g, { x: x * U, y: 0 }, { x: x * U, y: SCENE_H * U });
    }

    g.fillStyle(c.ground).fillRect(TABLE_X * U, TABLE_Y * U, 240 * U, 60 * U);
    g.lineStyle(0.5 * U, c.text).strokeRect(TABLE_X * U, TABLE_Y * U, 240 * U, 60 * U);

    g.lineStyle(0.4 * U, c.raised);
    for (const x of [60, 120, 180]) {
      const top = toPx({ x, y: 0 });
      g.lineBetween(top.x, top.y, top.x, top.y + 60 * U);
    }

    const mid = toPx({ x: 120, y: 30 });
    g.fillStyle(c.ground).fillCircle(mid.x, mid.y, 9 * U);
    g.lineStyle(0.4 * U, c.muted).strokeCircle(mid.x, mid.y, 9 * U);

    for (const side of [0, 1] as const) {
      const [a, b, tip] = rackOutline(side).map(toPx) as [Point, Point, Point];
      g.strokeTriangle(a.x, a.y, b.x, b.y, tip.x, tip.y);
    }
  }

  private dashedLine(g: Phaser.GameObjects.Graphics, a: Point, b: Point): void {
    const dash = 1 * U;
    const gap = 1.5 * U;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < length; d += dash + gap) {
      const t0 = d / length;
      const t1 = Math.min(d + dash, length) / length;
      g.lineBetween(
        a.x + (b.x - a.x) * t0,
        a.y + (b.y - a.y) * t0,
        a.x + (b.x - a.x) * t1,
        a.y + (b.y - a.y) * t1,
      );
    }
  }
}
