import { CUPS_PER_SIDE, slotPosition } from "../engine/rack";
import type { Shot, Side, State } from "../engine/types";
import { CUP_RADIUS, RING_RADIUS, type Point } from "../throw/model";

/** The scene is 300 x 70 units; the 240 x 60 cm table sits inside it at (30, 5), one unit per cm. */
export const SCENE_W = 300;
export const SCENE_H = 70;
export const TABLE_X = 30;
export const TABLE_Y = 5;

export interface AimView {
  side: Side;
  ball: Point;
  handle: Point;
  landing: Point;
  shot: Shot;
  touchdown: Point;
  /** Cup id currently under the landing point on the defender's rack. */
  targetCup: number | null;
}

export interface SceneView {
  state: State;
  /** Fixed ball positions at rest, per side. */
  balls: { side: Side; pos: Point }[];
  aim: AimView | null;
  /** Ball in flight, drawn on top of everything. */
  flight: { pos: Point; scale: number } | null;
  labels: [string, string];
}

interface Colors {
  surface: string;
  raised: string;
  muted: string;
  text: string;
  strong: string;
  accent: string;
  ground: string;
}

let colors: Colors | null = null;
function palette(): Colors {
  if (colors) return colors;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  colors = {
    surface: v("--color-surface"),
    raised: v("--color-surface-raised"),
    muted: v("--color-text-muted"),
    text: v("--color-text"),
    strong: v("--color-text-strong"),
    accent: v("--color-accent"),
    ground: v("--color-ground-top"),
  };
  return colors;
}

export function toScene(p: Point): Point {
  return { x: p.x + TABLE_X, y: p.y + TABLE_Y };
}

export function fromScene(p: Point): Point {
  return { x: p.x - TABLE_X, y: p.y - TABLE_Y };
}

export function draw(ctx: CanvasRenderingContext2D, cssWidth: number, view: SceneView): void {
  const c = palette();
  const s = cssWidth / SCENE_W;
  const px = (v: number) => v * s;
  ctx.clearRect(0, 0, cssWidth, px(SCENE_H));
  ctx.lineCap = "round";

  const circle = (p: Point, r: number) => {
    const q = toScene(p);
    ctx.beginPath();
    ctx.arc(px(q.x), px(q.y), px(r), 0, Math.PI * 2);
  };

  // Backdrop with the throwing zones
  ctx.fillStyle = c.surface;
  ctx.fillRect(0, 0, px(SCENE_W), px(SCENE_H));
  ctx.strokeStyle = c.muted;
  ctx.lineWidth = Math.max(1, px(0.25));
  ctx.setLineDash([px(1), px(1.5)]);
  for (const x of [30, 270]) {
    ctx.beginPath();
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), px(SCENE_H));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = c.text;
  ctx.font = `${Math.max(10, px(2.7))}px "JetBrains Mono", monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(view.labels[0].toUpperCase(), px(3.6), px(3.5));
  ctx.textAlign = "right";
  ctx.fillText(view.labels[1].toUpperCase(), px(SCENE_W - 3.6), px(3.5));

  // Table
  ctx.fillStyle = c.ground;
  ctx.fillRect(px(TABLE_X), px(TABLE_Y), px(240), px(60));
  ctx.strokeStyle = c.text;
  ctx.lineWidth = 2;
  ctx.strokeRect(px(TABLE_X), px(TABLE_Y), px(240), px(60));

  ctx.strokeStyle = c.raised;
  ctx.lineWidth = Math.max(1, px(0.4));
  for (const x of [60, 120, 180]) {
    const a = toScene({ x, y: 0 });
    ctx.beginPath();
    ctx.moveTo(px(a.x), px(a.y));
    ctx.lineTo(px(a.x), px(a.y + 60));
    ctx.stroke();
  }
  ctx.strokeStyle = c.muted;
  circle({ x: 120, y: 30 }, 9);
  ctx.fillStyle = c.ground;
  ctx.fill();
  ctx.stroke();
  for (const tri of [
    [
      [2.2, 6.15],
      [2.2, 53.85],
      [43.5, 30],
    ],
    [
      [237.8, 6.15],
      [237.8, 53.85],
      [196.5, 30],
    ],
  ] as const) {
    ctx.beginPath();
    tri.forEach(([x, y], i) => {
      const q = toScene({ x, y });
      if (i === 0) ctx.moveTo(px(q.x), px(q.y));
      else ctx.lineTo(px(q.x), px(q.y));
    });
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  // Cups
  const cupLine = Math.max(2, px(0.75));
  for (const side of [0, 1] as const) {
    const standing = view.state.cups[side];
    const occupied = new Set(standing.map((cup) => cup.slot));
    for (let slot = 0; slot < CUPS_PER_SIDE; slot++) {
      if (occupied.has(slot)) continue;
      const p = slotPosition(side, slot);
      circle(p, CUP_RADIUS);
      ctx.strokeStyle = c.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([px(0.8), px(0.8)]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const cup of standing) {
      const p = slotPosition(side, cup.slot);
      const hit = side !== view.state.thrower && view.state.pending.includes(cup.id);
      circle(p, CUP_RADIUS - cupLine / (2 * s));
      ctx.fillStyle = hit ? c.accent : c.surface;
      ctx.fill();
      ctx.strokeStyle = hit ? c.accent : c.strong;
      ctx.lineWidth = cupLine;
      ctx.stroke();
      if (hit) {
        circle(p, CUP_RADIUS / 4);
        ctx.fillStyle = c.strong;
        ctx.fill();
      }
      if (view.aim && view.aim.side !== side && view.aim.targetCup === cup.id) {
        circle(p, CUP_RADIUS + 0.9);
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = Math.max(1.5, px(0.45));
        ctx.stroke();
      }
    }
  }

  // Aim line, landing ring, bounce marker, pull handle
  if (view.aim) {
    const a = view.aim;
    const from = toScene(a.ball);
    const to = toScene(a.landing);
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = Math.max(2, px(0.55));
    ctx.setLineDash([0.01, px(1.8)]);
    ctx.beginPath();
    ctx.moveTo(px(from.x), px(from.y));
    ctx.lineTo(px(to.x), px(to.y));
    ctx.stroke();
    ctx.setLineDash([]);

    circle(a.landing, RING_RADIUS[a.shot]);
    if (a.shot === "bounce") {
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.14;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = Math.max(1.5, px(0.45));
    ctx.stroke();

    if (a.shot === "bounce") {
      circle(a.touchdown, 1.8);
      ctx.fillStyle = c.ground;
      ctx.fill();
      ctx.stroke();
    }

    const h = toScene(a.handle);
    ctx.strokeStyle = c.strong;
    ctx.lineWidth = Math.max(1.5, px(0.4));
    ctx.beginPath();
    ctx.moveTo(px(from.x), px(from.y));
    ctx.lineTo(px(h.x), px(h.y));
    ctx.stroke();
    circle(a.handle, 1.5);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.stroke();
  }

  // Balls at rest
  for (const { side, pos } of view.balls) {
    const active = view.aim?.side === side || (!view.flight && side === view.state.thrower);
    circle(pos, 2.2);
    ctx.fillStyle = c.strong;
    ctx.fill();
    if (active) {
      circle(pos, 2.2 + 0.7);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = Math.max(1.5, px(0.5));
      ctx.stroke();
    }
  }

  if (view.flight) {
    circle(view.flight.pos, 2.2 * view.flight.scale);
    ctx.fillStyle = c.strong;
    ctx.fill();
  }
}
