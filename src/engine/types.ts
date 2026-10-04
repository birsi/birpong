export type Side = 0 | 1;
export type Shot = "air" | "bounce";
export type Rps = "rock" | "paper" | "scissors";

/** A cup. `slot` is its position in the pyramid, counted from the tip: 0 tip, 1-2 row of 2, 3-5 row of 3, 6-9 row of 4. */
export interface Cup {
  id: number;
  slot: number;
}

export type Phase = "rps" | "throwing" | "reroll" | "over";

export interface ThrowRecord {
  side: Side;
  shot: Shot;
  /** Slot of the targeted cup, null for a miss. */
  slot: number | null;
  hit: boolean;
  /** Cups newly marked as hit by this throw. */
  marked: number;
}

export interface State {
  phase: Phase;
  /** Cups standing per side. Index = the side that owns the rack. */
  cups: [Cup[], Cup[]];
  /** Side that threw first; decides the re-roll. */
  first: Side | null;
  thrower: Side;
  /** Throws taken in the current round (0-2). */
  ballsThrown: number;
  hitsInRound: number;
  ballsBackUsed: boolean;
  /** Ids of defender cups hit this turn, removed when the turn ends. */
  pending: number[];
  suddenDeath: boolean;
  winner: Side | null;
  log: ThrowRecord[];
}

export type Action =
  | { type: "rps"; choices: [Rps, Rps] }
  | { type: "throw"; shot: Shot; target: number | null };
