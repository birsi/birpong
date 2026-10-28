import { CUPS_PER_SIDE, slotPosition } from "../domain/engine";
import type { MatchRecord, OpponentRecord, SideSummary, Totals } from "../domain/stats";

const percent = (part: number, whole: number): string =>
  whole ? `${Math.round((part / whole) * 100)}%` : "–";

// --- Result screen -----------------------------------------------------

export interface ResultRow {
  label: string;
  you: string;
  opp: string;
}

export interface ResultView {
  title: string;
  won: boolean;
  /** Cups sunk by you and by the opponent. */
  score: string;
  rows: ResultRow[];
}

export function resultView(record: MatchRecord): ResultView {
  const won = record.result === "win";
  const { you, opp } = record;
  const row = (label: string, pick: (s: SideSummary) => string): ResultRow => ({
    label,
    you: pick(you),
    opp: pick(opp),
  });
  return {
    title: won ? "YOU WIN" : "YOU LOSE",
    won,
    score: `${you.cupsSunk} : ${opp.cupsSunk}`,
    rows: [
      row("Throws", (s) => String(s.throws)),
      row("Hits", (s) => String(s.hits)),
      row("Hit rate", (s) => percent(s.hits, s.throws)),
      row("Bounce hits", (s) => String(s.bounceHits)),
      row("Balls back", (s) => String(s.ballsBack)),
      row("Best streak", (s) => String(s.bestStreak)),
    ],
  };
}

// --- Stats screen ------------------------------------------------------

export interface Tile {
  label: string;
  value: string;
}

export interface RackCup {
  slot: number;
  /** Share of your hits in percent, rounded. */
  percent: number;
  /** 0 to 1 within the pyramid, for placing the cup. */
  x: number;
  y: number;
  /** 0 to 1: how hot this cup is compared with the hottest one. */
  heat: number;
}

export interface RecentRow {
  date: string;
  opponent: string;
  mode: string;
  result: "W" | "L";
  cups: string;
  hitRate: string;
}

export interface StatsView {
  tiles: Tile[];
  rack: RackCup[];
  recent: RecentRow[];
  empty: boolean;
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

/** The opponent's rack as seen from your end: the tip points toward you, on the left. */
function rackLayout(share: readonly number[]): RackCup[] {
  const points = Array.from({ length: CUPS_PER_SIDE }, (_, slot) => slotPosition(1, slot));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const hottest = Math.max(...share, 0);
  return points.map((p, slot) => ({
    slot,
    percent: Math.round((share[slot] ?? 0) * 100),
    x: (p.x - x0) / (x1 - x0),
    y: (p.y - y0) / (y1 - y0),
    heat: hottest ? (share[slot] ?? 0) / hottest : 0,
  }));
}

export function statsView(totals: Totals): StatsView {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return {
    empty: totals.matches === 0,
    tiles: [
      { label: "Matches", value: String(totals.matches) },
      { label: "Wins", value: String(totals.wins) },
      { label: "Win rate", value: pct(totals.winRate) },
      { label: "Hit rate", value: pct(totals.hitRate) },
      { label: "Balls back", value: String(totals.ballsBack) },
      { label: "Best streak", value: String(totals.bestStreak) },
    ],
    rack: rackLayout(totals.rackShare),
    recent: totals.recent.map((r) => ({
      date: formatDate(r.date),
      opponent: r.opponent,
      mode: r.mode === "online" ? "Online" : "Solo",
      result: r.result === "win" ? "W" : "L",
      cups: `${r.you.cupsSunk} : ${r.opp.cupsSunk}`,
      hitRate: percent(r.you.hits, r.you.throws),
    })),
  };
}

// --- Records (local leaderboard) ---------------------------------------

export interface RecordsRow {
  opponent: string;
  mode: string;
  played: number;
  won: number;
  lost: number;
  winRate: string;
  /** 0 to 1, for the bar. */
  winShare: number;
  lastPlayed: string;
}

export function recordsView(rows: readonly OpponentRecord[]): RecordsRow[] {
  return rows.map((r) => ({
    opponent: r.opponent,
    mode: r.mode === "online" ? "Online" : "Solo",
    played: r.played,
    won: r.won,
    lost: r.lost,
    winRate: `${Math.round(r.winRate * 100)}%`,
    winShare: r.winRate,
    lastPlayed: formatDate(r.lastPlayed),
  }));
}
