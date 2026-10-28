import { describe, expect, it } from "vitest";
import { initialState, reduce, type Action, type State, type ThrowRecord } from "../engine";
import { aggregate } from "./aggregate";
import { summarizeMatch, summarizeSide } from "./summarizeMatch";
import type { MatchMeta, MatchRecord } from "./types";

const meta: MatchMeta = {
  id: "m1",
  date: "2026-10-04T10:00:00.000Z",
  mode: "solo",
  opponent: "CPU easy",
};

const rec = (r: Partial<ThrowRecord>): ThrowRecord => ({
  turn: 1,
  side: 0,
  shot: "air",
  slot: null,
  hit: false,
  marked: 0,
  ...r,
});

describe("summarizeSide", () => {
  it("counts throws, hits, bounce hits, cups sunk and rack positions", () => {
    const log = [
      rec({ hit: true, slot: 0, marked: 1 }),
      rec({ shot: "bounce", hit: true, slot: 4, marked: 2 }),
      rec({ turn: 2, side: 1, hit: true, slot: 1, marked: 1 }),
      rec({ turn: 3, hit: false }),
    ];
    const s = summarizeSide(log, 0);
    expect(s).toMatchObject({ throws: 3, hits: 2, bounceHits: 1, cupsSunk: 3, bestStreak: 2 });
    expect(s.rackHits[0]).toBe(1);
    expect(s.rackHits[4]).toBe(1);
    expect(summarizeSide(log, 1).hits).toBe(1);
  });

  it("finds the best streak across turns and resets on a miss", () => {
    const log = [
      rec({ hit: true, slot: 0 }),
      rec({ hit: false }),
      rec({ turn: 2, hit: true, slot: 0 }),
      rec({ turn: 2, hit: true, slot: 1 }),
      rec({ turn: 2, hit: true, slot: 2 }),
    ];
    expect(summarizeSide(log, 0).bestStreak).toBe(3);
  });

  it("counts a turn with more than two throws as balls back", () => {
    const log = [
      rec({ hit: true, slot: 0 }),
      rec({ hit: true, slot: 1 }),
      rec({ hit: false }),
      rec({ hit: false }),
      rec({ turn: 2, side: 1 }),
      rec({ turn: 2, side: 1 }),
    ];
    expect(summarizeSide(log, 0).ballsBack).toBe(1);
    expect(summarizeSide(log, 1).ballsBack).toBe(0);
  });
});

describe("summarizeMatch", () => {
  const play = (state: State, ...actions: Action[]) => actions.reduce(reduce, state);

  /** Side 0 clears side 1's single cup with its first ball, side 1 then misses the re-roll. */
  const finished = (): State => {
    const start = reduce(initialState(), { type: "rps", choices: ["rock", "scissors"] });
    const lastCup = { ...start, cups: [start.cups[0], start.cups[1].slice(0, 1)] as State["cups"] };
    return play(
      lastCup,
      { type: "throw", shot: "air", target: 0 }, // clears the rack at once: no second ball
      { type: "throw", shot: "air", target: null },
      { type: "throw", shot: "air", target: null },
    );
  };

  it("records a win with both sides' numbers", () => {
    const record = summarizeMatch(finished(), 0, meta);
    expect(record).toMatchObject({ result: "win", opponent: "CPU easy", id: "m1" });
    expect(record.you).toMatchObject({ throws: 1, hits: 1, cupsSunk: 1 });
    expect(record.opp).toMatchObject({ throws: 2, hits: 0, cupsSunk: 0 });
  });

  it("records a loss from the other side's view", () => {
    expect(summarizeMatch(finished(), 1, meta).result).toBe("loss");
  });

  it("refuses a match that is not over", () => {
    expect(() => summarizeMatch(initialState(), 0, meta)).toThrow();
  });
});

describe("aggregate", () => {
  const record = (over: Partial<MatchRecord> & { hits?: number; throws?: number }): MatchRecord => {
    const { hits = 4, throws = 10, ...rest } = over;
    const rackHits = Array.from({ length: 10 }, () => 0);
    rackHits[0] = hits;
    return {
      ...meta,
      result: "win",
      you: { throws, hits, bounceHits: 0, ballsBack: 1, bestStreak: 2, cupsSunk: 10, rackHits },
      opp: {
        throws: 0,
        hits: 0,
        bounceHits: 0,
        ballsBack: 0,
        bestStreak: 0,
        cupsSunk: 5,
        rackHits,
      },
      ...rest,
    };
  };

  it("is all zeros without matches", () => {
    const t = aggregate([]);
    expect(t).toMatchObject({ matches: 0, wins: 0, winRate: 0, hitRate: 0, bestStreak: 0 });
    expect(t.rackShare.every((s) => s === 0)).toBe(true);
    expect(t.recent).toEqual([]);
  });

  it("totals matches, wins and rates over the player's side", () => {
    const t = aggregate([
      record({ id: "a", date: "2026-10-01T00:00:00Z", hits: 4, throws: 10 }),
      record({ id: "b", date: "2026-10-03T00:00:00Z", result: "loss", hits: 2, throws: 10 }),
    ]);
    expect(t.matches).toBe(2);
    expect(t.wins).toBe(1);
    expect(t.winRate).toBeCloseTo(0.5);
    expect(t.hitRate).toBeCloseTo(0.3);
    expect(t.ballsBack).toBe(2);
    expect(t.rackShare[0]).toBe(1);
    expect(t.recent.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("limits recent matches to five, newest first", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      record({ id: `m${i}`, date: `2026-10-0${i + 1}T00:00:00Z` }),
    );
    const t = aggregate(many);
    expect(t.recent).toHaveLength(5);
    expect(t.recent[0]?.id).toBe("m7");
  });
});
