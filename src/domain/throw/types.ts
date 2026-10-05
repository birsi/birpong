import type { Point } from "../geometry";

export interface Aim {
  /** Unit vector the ball is thrown along. */
  dir: Point;
  /** 0 to 1. */
  power: number;
  /** Where the pull-back handle is drawn, clamped to MAX_PULL. */
  handle: Point;
}

/** What the ball did at the nearest cup. */
export type Contact = "none" | "clean" | "rattle-in" | "bounce-out" | "ricochet";

export interface ThrowResult {
  landing: Point;
  /** Cup id hit, or null for a miss. */
  target: number | null;
  contact: Contact;
  /** Cup id the ball touched (also set for a bounce-out, where target is null). */
  touched: number | null;
  /** Where a ball that bounced off the rim ends up (the neighbouring cup's centre for a ricochet). */
  deflect: Point | null;
}
