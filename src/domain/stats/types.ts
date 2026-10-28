/** What one side did in one match. */
export interface SideSummary {
  throws: number;
  hits: number;
  bounceHits: number;
  /** Turns in which the side earned its balls back. */
  ballsBack: number;
  /** Longest run of consecutive hits. */
  bestStreak: number;
  /** Cups removed from the other side's rack. */
  cupsSunk: number;
  /** Hits per rack slot (0 = tip), counted in the formation the rack had at the time. */
  rackHits: number[];
}

/** One finished match, as saved on the device. */
export interface MatchRecord {
  id: string;
  /** ISO date and time the match ended. */
  date: string;
  mode: "solo" | "online";
  /** Display name of the opponent: "CPU medium" or the online opponent's nickname. */
  opponent: string;
  result: "win" | "loss";
  you: SideSummary;
  opp: SideSummary;
}

export interface MatchMeta {
  id: string;
  date: string;
  mode: MatchRecord["mode"];
  opponent: string;
}

export interface Totals {
  matches: number;
  wins: number;
  /** 0 to 1. */
  winRate: number;
  /** 0 to 1: hits over throws. */
  hitRate: number;
  ballsBack: number;
  bestStreak: number;
  /** Share (0 to 1) of all hits that landed in each rack slot; all zeros with no hits. */
  rackShare: number[];
  /** Newest first. */
  recent: MatchRecord[];
}
