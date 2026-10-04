import Phaser from "phaser";
import { CUPS_PER_SIDE, slotPosition } from "../engine/rack";
import type { Cup, Shot, Side, State } from "../engine/types";
import {
  BALL_START,
  CUP_RADIUS,
  type ThrowResult,
  MIN_POWER,
  RING_RADIUS,
  aimFromPull,
  findCup,
  nominalLanding,
  touchdown,
  type Aim,
  type Point,
} from "../throw/model";

/** Scene units are cm on the table plus a margin; one unit is U pixels of the (scaled-to-fit) canvas. */
export const U = 8;
export const SCENE_W = 300;
export const SCENE_H = 70;
const TABLE_X = 30;
const TABLE_Y = 5;
const BALL_R = 2.2;
const GRAB_RADIUS = 16; // cm around the ball where a drag may start

export interface SceneView {
  state: State;
  shot: Shot;
  /** False while a ball is in flight or the game is over. */
  canThrow: boolean;
  labels: [string, string];
}

export interface SceneCallbacks {
  /** Called while dragging (aim) and when the drag ends (null). */
  onAim(aim: Aim | null): void;
  onThrow(aim: Aim): void;
}

const toPx = (p: Point): Point => ({ x: (p.x + TABLE_X) * U, y: (p.y + TABLE_Y) * U });
const toCm = (x: number, y: number): Point => ({ x: x / U - TABLE_X, y: y / U - TABLE_Y });

const cssColor = (name: string): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return parseInt(raw.replace("#", ""), 16);
};

export class TableScene extends Phaser.Scene {
  private view: SceneView | null = null;
  private colors!: Record<"surface" | "raised" | "muted" | "text" | "strong" | "accent" | "ground", number>;
  private cups = new Map<string, { body: Phaser.GameObjects.Arc; dot: Phaser.GameObjects.Arc }>();
  private holes!: Phaser.GameObjects.Graphics;
  private aimLayer!: Phaser.GameObjects.Graphics;
  private targetRing!: Phaser.GameObjects.Arc;
  private balls!: Record<Side, { body: Phaser.GameObjects.Arc; ring: Phaser.GameObjects.Arc }>;
  private flightBall!: Phaser.GameObjects.Arc;
  private labels!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private drag: Aim | null = null;
  private ready = false;

  constructor(private readonly callbacks: SceneCallbacks) {
    super("table");
  }

  create(): void {
    const css = (n: string) => cssColor(`--color-${n}`);
    this.colors = {
      surface: css("surface"),
      raised: css("surface-raised"),
      muted: css("text-muted"),
      text: css("text"),
      strong: css("text-strong"),
      accent: css("accent"),
      ground: css("ground-top"),
    };
    const c = this.colors;

    this.drawTable();
    this.holes = this.add.graphics();

    const lw = 0.75 * U;
    for (const side of [0, 1] as const) {
      for (let id = 0; id < CUPS_PER_SIDE; id++) {
        const body = this.add.circle(0, 0, CUP_RADIUS * U - lw / 2, c.surface).setStrokeStyle(lw, c.strong);
        const dot = this.add.circle(0, 0, (CUP_RADIUS / 4) * U, c.strong);
        this.cups.set(`${side}:${id}`, { body, dot });
      }
    }
    this.targetRing = this.add.circle(0, 0, (CUP_RADIUS + 0.9) * U).setStrokeStyle(0.45 * U, c.accent).setVisible(false);
    this.aimLayer = this.add.graphics();

    const ball = (side: Side) => {
      const pos = toPx(BALL_START[side]);
      const ring = this.add.circle(pos.x, pos.y, (BALL_R + 0.7) * U).setStrokeStyle(0.5 * U, c.accent);
      const body = this.add.circle(pos.x, pos.y, BALL_R * U, c.strong);
      return { body, ring };
    };
    this.balls = { 0: ball(0), 1: ball(1) };
    this.flightBall = this.add.circle(0, 0, BALL_R * U, c.strong).setVisible(false).setDepth(10);

    const label = (x: number, align: number) =>
      this.add
        .text(x * U, 3.5 * U, "", { fontFamily: '"JetBrains Mono", monospace', fontSize: `${2.7 * U}px`, color: "#d4d4d8" })
        .setOrigin(align, 0);
    this.labels = [label(3.6, 0), label(SCENE_W - 3.6, 1)];
    // Redraw once web fonts are loaded so the labels do not stay in the fallback font.
    void document.fonts.ready.then(() => this.applyLabels());

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on("pointerup", () => this.onUp());
    this.input.on("pointerupoutside", () => this.onUp());

    this.ready = true;
    if (this.view) this.setView(this.view);
  }

  /** Push the engine state in; the scene only draws, it never decides rules. */
  setView(view: SceneView): void {
    this.view = view;
    if (!this.ready) return;
    const { state } = view;
    if (!view.canThrow) this.cancelDrag(true);

    for (const side of [0, 1] as const) {
      const standing = new Map<number, Cup>(state.cups[side].map((cup) => [cup.id, cup]));
      for (let id = 0; id < CUPS_PER_SIDE; id++) {
        const obj = this.cups.get(`${side}:${id}`)!;
        const cup = standing.get(id);
        if (!cup) {
          obj.body.setVisible(false);
          obj.dot.setVisible(false);
          continue;
        }
        const pos = toPx(slotPosition(side, cup.slot));
        if (obj.body.visible && (obj.body.x !== pos.x || obj.body.y !== pos.y)) {
          // Re-rack: slide the cup (and its hit dot) to the new slot.
          this.tweens.add({ targets: [obj.body, obj.dot], x: pos.x, y: pos.y, duration: 250, ease: "Sine.easeInOut" });
        } else {
          obj.body.setPosition(pos.x, pos.y);
          obj.dot.setPosition(pos.x, pos.y);
        }
        const hit = side !== state.thrower && state.pending.includes(id);
        obj.body.setVisible(true).setFillStyle(hit ? this.colors.accent : this.colors.surface);
        obj.body.setStrokeStyle(0.75 * U, hit ? this.colors.accent : this.colors.strong);
        obj.dot.setVisible(hit);
      }
    }

    this.holes.clear();
    this.holes.lineStyle(1, this.colors.muted);
    for (const side of [0, 1] as const) {
      const occupied = new Set(state.cups[side].map((cup) => cup.slot));
      for (let slot = 0; slot < CUPS_PER_SIDE; slot++) {
        if (!occupied.has(slot)) this.dashedCircle(toPx(slotPosition(side, slot)), CUP_RADIUS * U);
      }
    }

    for (const side of [0, 1] as const) {
      this.balls[side].ring.setVisible(view.canThrow && side === state.thrower);
    }
    this.applyLabels();
    this.drawAim();
  }

  /** Animate one throw from the thrower's ball to where it lands and what it does at the cup. */
  async playFlight(side: Side, result: ThrowResult, shot: Shot): Promise<void> {
    const origin = BALL_START[side];
    const defender: Side = side === 0 ? 1 : 0;
    const { landing } = result;
    this.balls[side].ring.setVisible(false);
    const ball = this.flightBall.setVisible(true).setAlpha(1).setScale(1);
    const hop = (from: Point, to: Point, duration: number, peak: number, ease = "Linear") =>
      new Promise<void>((resolve) => {
        const a = toPx(from);
        const b = toPx(to);
        ball.setPosition(a.x, a.y);
        this.tweens.add({ targets: ball, scale: peak, duration: duration / 2, yoyo: true, ease: "Sine.easeOut" });
        this.tweens.add({ targets: ball, x: b.x, y: b.y, duration, ease, onComplete: () => resolve() });
      });
    const tween = (config: Phaser.Types.Tweens.TweenBuilderConfig) =>
      new Promise<void>((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));

    if (shot === "air") {
      await hop(origin, landing, 650, 1.5);
    } else {
      const mid = touchdown(origin, landing);
      await hop(origin, mid, 430, 1.4);
      await hop(mid, landing, 220, 1.25);
    }

    const cup = result.touched !== null ? this.cups.get(`${defender}:${result.touched}`) : undefined;
    const cupPos = cup ? { x: cup.body.x, y: cup.body.y } : null;

    if (result.contact === "clean" && cupPos) {
      // Straight in: drop into the cup.
      await tween({ targets: ball, x: cupPos.x, y: cupPos.y, scale: 0.4, alpha: 0.2, duration: 220, ease: "Quad.easeIn" });
    } else if (result.contact === "rattle-in" && cupPos) {
      // Clips the rim, circles it, then drops in.
      await this.rattle(ball, cup!.body, cupPos, toPx(landing));
    } else if (result.contact === "bounce-out" && result.deflect && cup && cupPos) {
      // Hits the rim and kicks away.
      this.wobble(cup.body, 1.12);
      await hop(landing, result.deflect, 380, 1.7, "Quad.easeOut");
      await tween({ targets: ball, alpha: 0, duration: 200 });
    } else if (result.contact === "ricochet" && result.deflect && cup) {
      // Clips the rim and kicks into the cup next to it.
      this.wobble(cup.body, 1.12);
      const to = this.cups.get(`${defender}:${result.target}`);
      const dest = to ? { x: to.body.x, y: to.body.y } : toPx(result.deflect);
      await hop(landing, result.deflect, 300, 1.5, "Quad.easeOut");
      await tween({ targets: ball, x: dest.x, y: dest.y, scale: 0.4, alpha: 0.2, duration: 200, ease: "Quad.easeIn" });
    } else {
      await tween({ targets: ball, alpha: 0, duration: 200 });
    }
    ball.setVisible(false).setAlpha(1).setScale(1);
  }

  private wobble(cup: Phaser.GameObjects.Arc, peak: number): void {
    this.tweens.add({ targets: cup, scale: peak, duration: 70, yoyo: true, repeat: 1, ease: "Sine.easeOut" });
  }

  /** Orbit the rim with a shrinking radius, then drop in. */
  private rattle(ball: Phaser.GameObjects.Arc, cupBody: Phaser.GameObjects.Arc, center: Point, from: Point): Promise<void> {
    const start = Math.atan2(from.y - center.y, from.x - center.x);
    const r0 = Math.max(Math.hypot(from.x - center.x, from.y - center.y), 2 * U);
    const state = { t: 0 };
    this.wobble(cupBody, 1.1);
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: state,
        t: 1,
        duration: 750,
        ease: "Sine.easeOut",
        onUpdate: () => {
          const angle = start + state.t * Math.PI * 3.5;
          const radius = r0 * (1 - state.t * 0.85);
          ball.setPosition(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
        },
        onComplete: () => {
          this.tweens.add({ targets: ball, x: center.x, y: center.y, scale: 0.4, alpha: 0.2, duration: 160, ease: "Quad.easeIn", onComplete: () => resolve() });
        },
      });
    });
  }

  // --- drawing -----------------------------------------------------------
  private drawTable(): void {
    const c = this.colors;
    const g = this.add.graphics();
    g.fillStyle(c.surface).fillRect(0, 0, SCENE_W * U, SCENE_H * U);
    g.lineStyle(0.25 * U, c.muted);
    for (const x of [30, 270]) this.dashedLine(g, { x: x * U, y: 0 }, { x: x * U, y: SCENE_H * U });
    g.fillStyle(c.ground).fillRect(TABLE_X * U, TABLE_Y * U, 240 * U, 60 * U);
    g.lineStyle(2 * U * 0.25, c.text).strokeRect(TABLE_X * U, TABLE_Y * U, 240 * U, 60 * U);
    g.lineStyle(0.4 * U, c.raised);
    for (const x of [60, 120, 180]) {
      const a = toPx({ x, y: 0 });
      g.lineBetween(a.x, a.y, a.x, a.y + 60 * U);
    }
    const mid = toPx({ x: 120, y: 30 });
    g.fillStyle(c.ground).fillCircle(mid.x, mid.y, 9 * U);
    g.lineStyle(0.4 * U, c.muted).strokeCircle(mid.x, mid.y, 9 * U);
    for (const tri of [
      [2.2, 6.15, 2.2, 53.85, 43.5, 30],
      [237.8, 6.15, 237.8, 53.85, 196.5, 30],
    ]) {
      const [a, b, cc] = [toPx({ x: tri[0]!, y: tri[1]! }), toPx({ x: tri[2]!, y: tri[3]! }), toPx({ x: tri[4]!, y: tri[5]! })];
      g.strokeTriangle(a.x, a.y, b.x, b.y, cc.x, cc.y);
    }
  }

  private applyLabels(): void {
    const names = this.view?.labels ?? ["", ""];
    this.labels[0].setText(names[0].toUpperCase());
    this.labels[1].setText(names[1].toUpperCase());
  }

  private dashedCircle(center: Point, radius: number): void {
    const segments = 16;
    for (let i = 0; i < segments; i += 2) {
      this.holes.beginPath();
      this.holes.arc(center.x, center.y, radius, (i / segments) * Math.PI * 2, ((i + 1) / segments) * Math.PI * 2);
      this.holes.strokePath();
    }
  }

  private dashedLine(g: Phaser.GameObjects.Graphics, a: Point, b: Point): void {
    const dash = 1 * U;
    const gap = 1.5 * U;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += dash + gap) {
      const t0 = d / len;
      const t1 = Math.min(d + dash, len) / len;
      g.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
    }
  }

  private drawAim(): void {
    const g = this.aimLayer;
    g.clear();
    this.targetRing.setVisible(false);
    const view = this.view;
    const aim = this.drag;
    if (!view || !aim) return;
    const c = this.colors;
    const side = view.state.thrower;
    const defender: Side = side === 0 ? 1 : 0;
    const ball = BALL_START[side];
    const landing = nominalLanding(ball, aim);
    const from = toPx(ball);
    const to = toPx(landing);

    // dotted aim line
    g.fillStyle(c.accent);
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const step = 1.8 * U;
    for (let d = step; d < len; d += step) {
      g.fillCircle(from.x + ((to.x - from.x) * d) / len, from.y + ((to.y - from.y) * d) / len, 0.28 * U);
    }

    // landing ring (filled and wider for bounce)
    const r = RING_RADIUS[view.shot] * U;
    if (view.shot === "bounce") g.fillStyle(c.accent, 0.14).fillCircle(to.x, to.y, r);
    g.lineStyle(0.45 * U, c.accent).strokeCircle(to.x, to.y, r);
    if (view.shot === "bounce") {
      const td = toPx(touchdown(ball, landing));
      g.fillStyle(c.ground).fillCircle(td.x, td.y, 1.8 * U);
      g.strokeCircle(td.x, td.y, 1.8 * U);
    }

    // pull-back handle
    const h = toPx(aim.handle);
    g.lineStyle(0.4 * U, c.strong).lineBetween(from.x, from.y, h.x, h.y);
    g.fillStyle(c.surface).fillCircle(h.x, h.y, 1.5 * U);
    g.strokeCircle(h.x, h.y, 1.5 * U);

    const target = findCup(defender, view.state.cups[defender], landing);
    const cup = view.state.cups[defender].find((k) => k.id === target);
    if (cup) {
      const p = toPx(slotPosition(defender, cup.slot));
      this.targetRing.setPosition(p.x, p.y).setVisible(true);
    }
  }

  // --- input -------------------------------------------------------------
  private cm(p: Phaser.Input.Pointer): Point {
    return toCm(p.worldX, p.worldY);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const view = this.view;
    if (!view?.canThrow) return;
    const ball = BALL_START[view.state.thrower];
    const at = this.cm(p);
    if (Math.hypot(at.x - ball.x, at.y - ball.y) > GRAB_RADIUS) return;
    this.setDrag(aimFromPull(ball, at) ?? { dir: { x: ball.x < 120 ? 1 : -1, y: 0 }, power: 0, handle: ball });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const view = this.view;
    if (!this.drag || !view) return;
    const ball = BALL_START[view.state.thrower];
    this.setDrag(aimFromPull(ball, this.cm(p)) ?? { dir: this.drag.dir, power: 0, handle: ball });
  }

  private onUp(): void {
    const aim = this.drag;
    if (!aim) return;
    this.cancelDrag(true);
    if (aim.power >= MIN_POWER) this.callbacks.onThrow(aim);
  }

  private setDrag(aim: Aim): void {
    this.drag = aim;
    this.callbacks.onAim(aim);
    this.drawAim();
  }

  private cancelDrag(notify: boolean): void {
    if (!this.drag) return;
    this.drag = null;
    this.drawAim();
    if (notify) this.callbacks.onAim(null);
  }
}
