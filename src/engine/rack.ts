import type { Cup, Side } from "./types";

export const TABLE_W = 240;
export const TABLE_H = 60;
export const CUPS_PER_SIDE = 10;

/** Left rack slot positions in cm (SPEC "Table geometry"), indexed by slot from the tip. */
const LEFT_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [31.9, 30.0],
  [23.93, 25.4],
  [23.93, 34.6],
  [15.97, 20.8],
  [15.97, 30.0],
  [15.97, 39.2],
  [8.0, 16.2],
  [8.0, 25.4],
  [8.0, 34.6],
  [8.0, 43.8],
];

/** Side 0 owns the left end, side 1 the right end (mirrored). */
export function slotPosition(side: Side, slot: number): { x: number; y: number } {
  const p = LEFT_SLOTS[slot];
  if (!p) throw new RangeError(`bad slot ${slot}`);
  return { x: side === 0 ? p[0] : TABLE_W - p[0], y: p[1] };
}

/** `count` cups packed against the tip: slots 0..count-1. */
export function makeRack(count: number): Cup[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, slot: i }));
}

/** Re-form a rack of 6, 3 or 1 cups into a pyramid anchored at the tip. */
export function reRack(cups: Cup[]): Cup[] {
  if (![6, 3, 1].includes(cups.length)) return cups;
  const ordered = [...cups].sort((a, b) => a.slot - b.slot);
  return ordered.map((c, i) => ({ id: c.id, slot: i }));
}

export function distance(side: Side, a: Cup, b: Cup): number {
  const pa = slotPosition(side, a.slot);
  const pb = slotPosition(side, b.slot);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}
