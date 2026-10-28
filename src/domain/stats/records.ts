import { CPU_LEVELS } from "../cpu";
import type { MatchRecord } from "./types";

/** How you have done against one opponent: a CPU level or an online player. */
export interface OpponentRecord {
  opponent: string;
  mode: MatchRecord["mode"];
  played: number;
  won: number;
  lost: number;
  /** 0 to 1. */
  winRate: number;
  /** ISO date of the latest match. */
  lastPlayed: string;
}

/** "CPU hard" -> 2, anything else -> -1. */
const cpuRank = (opponent: string): number =>
  CPU_LEVELS.findIndex((level) => opponent === `CPU ${level}`);

/** Online nicknames are matched without regard to case and surrounding spaces. */
const keyOf = (r: MatchRecord): string => `${r.mode}:${r.opponent.trim().toLowerCase()}`;

/**
 * The local leaderboard: one row per opponent met, computed from the saved matches. CPU levels come
 * first, from easy to hard; online opponents follow, the ones played most often first.
 */
export function recordsByOpponent(records: readonly MatchRecord[]): OpponentRecord[] {
  const rows = new Map<string, OpponentRecord>();
  const newestFirst = [...records].sort((a, b) => b.date.localeCompare(a.date));

  for (const r of newestFirst) {
    const key = keyOf(r);
    // Newest first, so the first match seen sets the display name and the last played date.
    const row = rows.get(key) ?? {
      opponent: r.opponent.trim(),
      mode: r.mode,
      played: 0,
      won: 0,
      lost: 0,
      winRate: 0,
      lastPlayed: r.date,
    };
    row.played++;
    if (r.result === "win") row.won++;
    else row.lost++;
    row.winRate = row.won / row.played;
    rows.set(key, row);
  }

  return [...rows.values()].sort((a, b) => {
    if (a.mode !== b.mode) return a.mode === "solo" ? -1 : 1;
    if (a.mode === "solo") return cpuRank(a.opponent) - cpuRank(b.opponent);
    return b.played - a.played || b.won - a.won || a.opponent.localeCompare(b.opponent);
  });
}
