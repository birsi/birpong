import { slotPosition } from "../engine/rack";
import type { Cup, Shot, Side } from "../engine/types";
import { gaussian, type Rng } from "./rng";

export interface Point {
  x: number;
  y: number;
}

/** Distances are in cm on the 240 x 60 table; every number here is a placeholder to tune. */
export const MAX_RANGE = 330;
export const MAX_PULL = 18;
export const MIN_POWER = 0.05;
export const CUP_RADIUS = 4.3;
export const BOUNCE_WINDOW: readonly [number, number] = [0.64, 0.78];
/** Landing ring radius shown to the player; scatter sigma is half of it. */
export const RING_RADIUS: Record<Shot, number> = { air: 6, bounce: 12.5 };
/** Where the bounce touches the table, as a share of the way to the landing point. */
export const BOUNCE_TOUCHDOWN = 0.667;

export const BALL_START: Record<Side, Point> = {
  0: { x: -13, y: 38 },
  1: { x: 253, y: 38 },
};

export interface Aim {
  /** Unit vector the ball is thrown along. */
  dir: Point;
  /** 0 to 1. */
  power: number;
  /** Where the pull-back handle is drawn, clamped to MAX_PULL. */
  handle: Point;
}

/** Drag back from the ball: the throw goes the opposite way, the pull length sets the power. */
export function aimFromPull(origin: Point, pointer: Point): Aim | null {
  const vx = pointer.x - origin.x;
  const vy = pointer.y - origin.y;
  const len = Math.hypot(vx, vy);
  if (len === 0) return null;
  const pull = Math.min(len, MAX_PULL);
  const ux = vx / len;
  const uy = vy / len;
  return {
    dir: { x: -ux, y: -uy },
    power: pull / MAX_PULL,
    handle: { x: origin.x + ux * pull, y: origin.y + uy * pull },
  };
}

/** Landing point with no scatter. */
export function nominalLanding(origin: Point, aim: Aim): Point {
  const d = aim.power * MAX_RANGE;
  return { x: origin.x + aim.dir.x * d, y: origin.y + aim.dir.y * d };
}

export function touchdown(origin: Point, landing: Point): Point {
  return {
    x: origin.x + (landing.x - origin.x) * BOUNCE_TOUCHDOWN,
    y: origin.y + (landing.y - origin.y) * BOUNCE_TOUCHDOWN,
  };
}

export function inBounceWindow(power: number): boolean {
  return power >= BOUNCE_WINDOW[0] && power <= BOUNCE_WINDOW[1];
}

/** Nearest standing cup of `defender` whose rim contains the landing point, or null. */
export function findCup(defender: Side, cups: readonly Cup[], landing: Point): number | null {
  let best: number | null = null;
  let bestDist = CUP_RADIUS;
  for (const cup of cups) {
    const p = slotPosition(defender, cup.slot);
    const d = Math.hypot(p.x - landing.x, p.y - landing.y);
    if (d <= bestDist) {
      best = cup.id;
      bestDist = d;
    }
  }
  return best;
}

export interface ThrowResult {
  landing: Point;
  /** Cup id hit, or null for a miss. */
  target: number | null;
}

export function resolveThrow(
  origin: Point,
  aim: Aim,
  shot: Shot,
  defender: Side,
  cups: readonly Cup[],
  rng: Rng,
): ThrowResult {
  const nominal = nominalLanding(origin, aim);
  const sigma = RING_RADIUS[shot] / 2;
  const landing = {
    x: nominal.x + gaussian(rng) * sigma,
    y: nominal.y + gaussian(rng) * sigma,
  };
  // A bounce outside the power window dies on the table or clears the rack.
  if (shot === "bounce" && !inBounceWindow(aim.power)) return { landing, target: null };
  return { landing, target: findCup(defender, cups, landing) };
}
