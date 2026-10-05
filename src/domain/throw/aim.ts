import type { Point } from "../geometry";
import { BOUNCE_TOUCHDOWN, BOUNCE_WINDOW, MAX_PULL, MAX_RANGE } from "./constants";
import type { Aim } from "./types";

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

/** Where a bounce shot touches the table on its way to `landing`. */
export function touchdown(origin: Point, landing: Point): Point {
  return {
    x: origin.x + (landing.x - origin.x) * BOUNCE_TOUCHDOWN,
    y: origin.y + (landing.y - origin.y) * BOUNCE_TOUCHDOWN,
  };
}

export function inBounceWindow(power: number): boolean {
  return power >= BOUNCE_WINDOW[0] && power <= BOUNCE_WINDOW[1];
}
