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
  /** The neighbouring cup's centre when the ball ricochets into it, otherwise null. */
  deflect: Point | null;
  /**
   * Hops a missed ball makes after landing, the last being where it comes to rest. A ball that
   * misses inside the rack bounces off the cups until it is out of the rack area.
   */
  bounces: Point[];
}
