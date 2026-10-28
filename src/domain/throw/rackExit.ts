import { rackOutline, type Side } from "../engine";
import type { Point } from "../geometry";
import { EXIT_EXTRA_MAX, EXIT_EXTRA_MIN, EXIT_SPREAD, TABLE_MARGIN } from "./constants";
import type { Rng } from "./rng";

const cross = (a: Point, b: Point, p: Point): number =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** Whether a point is inside the triangle drawn around a side's rack. */
export function inRack(side: Side, point: Point): boolean {
  const [a, b, c] = rackOutline(side);
  const signs = [cross(a, b, point), cross(b, c, point), cross(c, a, point)];
  return signs.every((s) => s >= 0) || signs.every((s) => s <= 0);
}

/**
 * Where a ball that missed inside the rack goes next: it knocks about between the cups, then
 * leaves the rack toward the middle of the table. Returns the hops, the last one outside the rack.
 */
export function exitPath(side: Side, from: Point, rng: Rng): Point[] {
  const toward = side === 0 ? 0 : Math.PI; // toward the centre line
  const angle = toward + (rng.frac() - 0.5) * EXIT_SPREAD;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const at = (d: number): Point => ({
    x: from.x + dir.x * d,
    y: Math.min(60 - TABLE_MARGIN, Math.max(TABLE_MARGIN, from.y + dir.y * d)),
  });

  let out = 0;
  while (inRack(side, at(out)) && out < 80) out += 1;
  const extra = EXIT_EXTRA_MIN + rng.frac() * (EXIT_EXTRA_MAX - EXIT_EXTRA_MIN);
  return [at(out * 0.5), at(out + extra)];
}
