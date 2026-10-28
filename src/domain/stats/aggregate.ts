import { CUPS_PER_SIDE } from "../engine";
import type { MatchRecord, Totals } from "./types";

const RECENT = 5;

/** Totals over all saved matches, from the player's side. */
export function aggregate(records: readonly MatchRecord[]): Totals {
  const sum = (pick: (r: MatchRecord) => number) => records.reduce((acc, r) => acc + pick(r), 0);
  const throws = sum((r) => r.you.throws);
  const hits = sum((r) => r.you.hits);
  const wins = records.filter((r) => r.result === "win").length;

  const rackHits = Array.from({ length: CUPS_PER_SIDE }, (_, slot) =>
    sum((r) => r.you.rackHits[slot] ?? 0),
  );
  const rackTotal = rackHits.reduce((a, b) => a + b, 0);

  return {
    matches: records.length,
    wins,
    winRate: records.length ? wins / records.length : 0,
    hitRate: throws ? hits / throws : 0,
    ballsBack: sum((r) => r.you.ballsBack),
    bestStreak: records.reduce((best, r) => Math.max(best, r.you.bestStreak), 0),
    rackShare: rackHits.map((n) => (rackTotal ? n / rackTotal : 0)),
    recent: [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT),
  };
}
