import type { MatchRecord } from "../domain/stats";
import { safeStorage } from "./safeStorage";

/** Where finished matches are kept. A server-backed store can replace this later. */
export interface StatsStore {
  load(): MatchRecord[];
  add(record: MatchRecord): void;
  clear(): void;
}

const KEY = "birpong.matches";
const VERSION = 1;
export const MAX_RECORDS = 500;

interface Saved {
  version: number;
  matches: MatchRecord[];
}

const looksLikeRecord = (value: unknown): value is MatchRecord => {
  const r = value as Partial<MatchRecord> | null;
  return (
    typeof r === "object" &&
    r !== null &&
    typeof r.id === "string" &&
    typeof r.date === "string" &&
    (r.result === "win" || r.result === "loss") &&
    typeof r.you === "object" &&
    r.you !== null &&
    Array.isArray(r.you.rackHits)
  );
};

/** Matches saved in `localStorage`, newest last. Tolerates missing, blocked or corrupt storage. */
export class LocalStatsStore implements StatsStore {
  constructor(private readonly storage: Storage | null = safeStorage()) {}

  load(): MatchRecord[] {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return [];
      const saved = JSON.parse(raw) as Partial<Saved>;
      if (saved.version !== VERSION || !Array.isArray(saved.matches)) return [];
      return saved.matches.filter(looksLikeRecord);
    } catch {
      return [];
    }
  }

  add(record: MatchRecord): void {
    const matches = [...this.load(), record].slice(-MAX_RECORDS);
    this.save(matches);
  }

  clear(): void {
    this.save([]);
  }

  private save(matches: MatchRecord[]): void {
    try {
      const saved: Saved = { version: VERSION, matches };
      this.storage?.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Storage full or blocked: the match is simply not remembered.
    }
  }
}

/** Keeps matches in memory only; used in tests. */
export class MemoryStatsStore implements StatsStore {
  private records: MatchRecord[] = [];

  load(): MatchRecord[] {
    return [...this.records];
  }

  add(record: MatchRecord): void {
    this.records.push(record);
  }

  clear(): void {
    this.records = [];
  }
}
