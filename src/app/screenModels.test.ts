import { describe, expect, it } from "vitest";
import { aggregate, type MatchRecord } from "../domain/stats";
import { resultView, statsView } from "./screenModels";

const record = (over: Partial<MatchRecord> = {}): MatchRecord => {
  const rackHits = Array.from({ length: 10 }, () => 0);
  rackHits[0] = 3;
  rackHits[4] = 1;
  return {
    id: "a",
    date: "2026-10-04T10:00:00.000Z",
    mode: "solo",
    opponent: "CPU medium",
    result: "win",
    you: { throws: 8, hits: 4, bounceHits: 1, ballsBack: 1, bestStreak: 3, cupsSunk: 10, rackHits },
    opp: {
      throws: 0,
      hits: 0,
      bounceHits: 0,
      ballsBack: 0,
      bestStreak: 0,
      cupsSunk: 7,
      rackHits: rackHits.map(() => 0),
    },
    ...over,
  };
};

describe("resultView", () => {
  it("shows the verdict, cups sunk and a comparison row per figure", () => {
    const v = resultView(record());
    expect(v).toMatchObject({ title: "YOU WIN", won: true, score: "10 : 7" });
    expect(v.rows.find((r) => r.label === "Hit rate")).toEqual({
      label: "Hit rate",
      you: "50%",
      opp: "–",
    });
    expect(v.rows.find((r) => r.label === "Best streak")?.you).toBe("3");
  });
  it("says you lose after a loss", () => {
    expect(resultView(record({ result: "loss" }))).toMatchObject({ title: "YOU LOSE", won: false });
  });
});

describe("statsView", () => {
  it("is empty without matches", () => {
    const v = statsView(aggregate([]));
    expect(v.empty).toBe(true);
    expect(v.tiles.find((t) => t.label === "Win rate")?.value).toBe("0%");
    expect(v.rack).toHaveLength(10);
    expect(v.rack.every((c) => c.heat === 0 && c.percent === 0)).toBe(true);
  });

  it("formats tiles, the rack heat map and recent matches", () => {
    const v = statsView(aggregate([record()]));
    expect(v.empty).toBe(false);
    expect(v.tiles.map((t) => t.value)).toEqual(["1", "1", "100%", "50%", "1", "3"]);
    const tip = v.rack[0]!;
    expect(tip).toMatchObject({ percent: 75, heat: 1 });
    expect(v.rack[4]).toMatchObject({ percent: 25 });
    // The tip sits at the left of the pyramid, vertically centred.
    expect(tip.x).toBe(0);
    expect(tip.y).toBeCloseTo(0.5);
    expect(v.recent[0]).toMatchObject({
      opponent: "CPU medium",
      mode: "Solo",
      result: "W",
      cups: "10 : 7",
      hitRate: "50%",
    });
    expect(v.recent[0]?.date).toMatch(/Oct/);
  });
});
