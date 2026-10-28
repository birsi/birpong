import { distance, type Point } from "../geometry";
import { slotPosition, type Cup, type Side } from "../engine";
import { CUP_RADIUS, RICOCHET_ARC, RICOCHET_REACH } from "./constants";

export interface CupHit {
  id: number;
  center: Point;
  /** Distance from the cup centre to the landing point. */
  dist: number;
}

/** Nearest cup whose outer rim contains `point`, or null. */
export function nearestCup(defender: Side, cups: readonly Cup[], point: Point): CupHit | null {
  let best: CupHit | null = null;
  for (const cup of cups) {
    const center = slotPosition(defender, cup.slot);
    const dist = distance(center, point);
    if (dist <= CUP_RADIUS && (!best || dist < best.dist)) best = { id: cup.id, center, dist };
  }
  return best;
}

const angleBetween = (a: number, b: number): number => {
  const diff = Math.abs(a - b);
  return diff > Math.PI ? 2 * Math.PI - diff : diff;
};

/** The standing cup nearest the kick direction, within reach of the cup that was clipped. */
export function ricochetCup(
  defender: Side,
  cups: readonly Cup[],
  from: { id: number; center: Point },
  direction: number,
): { id: number; center: Point } | null {
  let best: { id: number; center: Point } | null = null;
  let bestDiff = RICOCHET_ARC;
  for (const cup of cups) {
    if (cup.id === from.id) continue;
    const center = slotPosition(defender, cup.slot);
    if (distance(center, from.center) > RICOCHET_REACH) continue;
    const diff = angleBetween(
      Math.atan2(center.y - from.center.y, center.x - from.center.x),
      direction,
    );
    if (diff < bestDiff) {
      best = { id: cup.id, center };
      bestDiff = diff;
    }
  }
  return best;
}
