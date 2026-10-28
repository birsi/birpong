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

/** An aim from a direction (rad) and power (0 to 1), including where the pull-back handle sits. */
export function aimFromAngle(origin: Point, angle: number, power: number): Aim {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const pull = power * MAX_PULL;
  return { dir, power, handle: { x: origin.x - dir.x * pull, y: origin.y - dir.y * pull } };
}

/** The aim that lands exactly on `point` with no scatter, or null if it is out of range. */
export function aimAt(origin: Point, point: Point): Aim | null {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const power = Math.hypot(dx, dy) / MAX_RANGE;
  if (power > 1) return null;
  return aimFromAngle(origin, Math.atan2(dy, dx), power);
}
