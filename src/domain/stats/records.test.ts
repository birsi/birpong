import { describe, expect, it } from "vitest";
import { recordsByOpponent } from "./records";
import type { MatchRecord } from "./types";

const side = {
  throws: 1,
  hits: 1,
  bounceHits: 0,
  ballsBack: 0,
  bestStreak: 1,
  cupsSunk: 1,
  rackHits: Array(10).fill(0),
};
let n = 0;
const rec = (
  opponent: string,
  result: "win" | "loss",
  date: string,
  mode: MatchRecord["mode"] = "solo",
): MatchRecord => ({
  id: `m${n++}`,
  date,
  mode,
  opponent,
  result,
  you: side,
  opp: side,
});

describe("recordsByOpponent", () => {
  it("is empty without matches", () => {
    expect(recordsByOpponent([])).toEqual([]);
  });

  it("counts played, won, lost and win rate per opponent", () => {
    const rows = recordsByOpponent([
      rec("CPU easy", "win", "2026-10-01T10:00:00Z"),
      rec("CPU easy", "win", "2026-10-02T10:00:00Z"),
      rec("CPU easy", "loss", "2026-10-03T10:00:00Z"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      opponent: "CPU easy",
      mode: "solo",
      played: 3,
      won: 2,
      lost: 1,
    });
    expect(rows[0]!.winRate).toBeCloseTo(2 / 3);
    expect(rows[0]!.lastPlayed).toBe("2026-10-03T10:00:00Z");
  });

  it("lists CPU levels from easy to hard, then online players by matches played", () => {
    const rows = recordsByOpponent([
      rec("flo", "win", "2026-10-01T10:00:00Z", "online"),
      rec("CPU hard", "loss", "2026-10-02T10:00:00Z"),
      rec("anna", "win", "2026-10-03T10:00:00Z", "online"),
      rec("anna", "loss", "2026-10-04T10:00:00Z", "online"),
      rec("CPU easy", "win", "2026-10-05T10:00:00Z"),
      rec("CPU medium", "win", "2026-10-06T10:00:00Z"),
    ]);
    expect(rows.map((r) => r.opponent)).toEqual([
      "CPU easy",
      "CPU medium",
      "CPU hard",
      "anna",
      "flo",
    ]);
  });

  it("groups an online opponent's nickname without regard to case and keeps the latest spelling", () => {
    const rows = recordsByOpponent([
      rec("Flo", "win", "2026-10-01T10:00:00Z", "online"),
      rec("flo ", "loss", "2026-10-02T10:00:00Z", "online"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ opponent: "flo", played: 2, won: 1, lost: 1 });
  });

  it("does not mix an online player called like a CPU level with the CPU", () => {
    const rows = recordsByOpponent([
      rec("CPU easy", "win", "2026-10-01T10:00:00Z"),
      rec("CPU easy", "loss", "2026-10-02T10:00:00Z", "online"),
    ]);
    expect(rows.map((r) => `${r.mode}:${r.opponent}`)).toEqual([
      "solo:CPU easy",
      "online:CPU easy",
    ]);
  });

  it("breaks ties between online players by wins, then name", () => {
    const rows = recordsByOpponent([
      rec("zoe", "win", "2026-10-01T10:00:00Z", "online"),
      rec("abe", "loss", "2026-10-02T10:00:00Z", "online"),
      rec("max", "win", "2026-10-03T10:00:00Z", "online"),
    ]);
    expect(rows.map((r) => r.opponent)).toEqual(["max", "zoe", "abe"]);
  });
});
