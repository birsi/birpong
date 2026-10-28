import { CUPS_PER_SIDE, type Side, type State, type ThrowRecord } from "../engine";
import type { MatchMeta, MatchRecord, SideSummary } from "./types";

const emptySummary = (): SideSummary => ({
  throws: 0,
  hits: 0,
  bounceHits: 0,
  ballsBack: 0,
  bestStreak: 0,
  cupsSunk: 0,
  rackHits: Array.from({ length: CUPS_PER_SIDE }, () => 0),
});

/** What `side` did, derived from the throw log. */
export function summarizeSide(log: readonly ThrowRecord[], side: Side): SideSummary {
  const summary = emptySummary();
  const throwsPerTurn = new Map<number, number>();
  let streak = 0;

  for (const record of log) {
    if (record.side !== side) continue;
    summary.throws++;
    throwsPerTurn.set(record.turn, (throwsPerTurn.get(record.turn) ?? 0) + 1);
    summary.cupsSunk += record.marked;
    if (!record.hit) {
      streak = 0;
      continue;
    }
    summary.hits++;
    if (record.shot === "bounce") summary.bounceHits++;
    if (record.slot !== null) summary.rackHits[record.slot]!++;
    streak++;
    summary.bestStreak = Math.max(summary.bestStreak, streak);
  }

  // A turn with more than the usual two throws means both balls hit and came back.
  for (const count of throwsPerTurn.values()) if (count > 2) summary.ballsBack++;
  return summary;
}

/** A finished solo match as a record; `human` is the side the player had. */
export function summarizeMatch(state: State, human: Side, meta: MatchMeta): MatchRecord {
  if (state.phase !== "over" || state.winner === null) throw new Error("match is not over");
  const opponent: Side = human === 0 ? 1 : 0;
  return {
    ...meta,
    result: state.winner === human ? "win" : "loss",
    you: summarizeSide(state.log, human),
    opp: summarizeSide(state.log, opponent),
  };
}
