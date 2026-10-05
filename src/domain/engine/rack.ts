import { distance, type Point } from "../geometry";
import { RERACK_COUNTS, TABLE_W } from "./constants";
import type { Cup, Side } from "./types";

/** Left rack slot positions in cm (SPEC "Table geometry"), indexed by slot from the tip. */
const LEFT_SLOTS: readonly Point[] = [
  { x: 31.9, y: 30.0 },
  { x: 23.93, y: 25.4 },
  { x: 23.93, y: 34.6 },
  { x: 15.97, y: 20.8 },
  { x: 15.97, y: 30.0 },
  { x: 15.97, y: 39.2 },
  { x: 8.0, y: 16.2 },
  { x: 8.0, y: 25.4 },
  { x: 8.0, y: 34.6 },
  { x: 8.0, y: 43.8 },
];

/** Side 0 owns the left end, side 1 the right end (mirrored). */
export function slotPosition(side: Side, slot: number): Point {
  const p = LEFT_SLOTS[slot];
  if (!p) throw new RangeError(`bad slot ${slot}`);
  return { x: side === 0 ? p.x : TABLE_W - p.x, y: p.y };
}

/** `count` cups packed against the tip: slots 0..count-1. */
export function makeRack(count: number): Cup[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, slot: i }));
}

/** Re-form a rack of 6, 3 or 1 cups into a pyramid anchored at the tip. */
export function reRack(cups: Cup[]): Cup[] {
  if (!RERACK_COUNTS.includes(cups.length)) return cups;
  const ordered = [...cups].sort((a, b) => a.slot - b.slot);
  return ordered.map((c, i) => ({ id: c.id, slot: i }));
}

export function cupDistance(side: Side, a: Cup, b: Cup): number {
  return distance(slotPosition(side, a.slot), slotPosition(side, b.slot));
}
