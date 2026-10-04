import { describe, expect, it } from "vitest";
import { makeRack, reRack, slotPosition } from "./rack";
import { initialState, reduce } from "./reduce";
import type { Action, State } from "./types";

const play = (s: State, ...a: Action[]) => a.reduce(reduce, s);
const started = (): State => reduce(initialState(), { type: "rps", choices: ["rock", "scissors"] });
const air = (target: number | null): Action => ({ type: "throw", shot: "air", target });
const bounce = (target: number | null): Action => ({ type: "throw", shot: "bounce", target });
const withCups = (s: State, side: 0 | 1, n: number): State => {
  const cups: State["cups"] = [s.cups[0], s.cups[1]];
  cups[side] = makeRack(n);
  return { ...s, cups };
};

describe("setup", () => {
  it("starts with 10 cups per side in a 4-3-2-1 pyramid", () => {
    const s = initialState();
    expect(s.cups[0]).toHaveLength(10);
    const xs = s.cups[0].map((c) => slotPosition(0, c.slot).x);
    const rows = [...new Set(xs)].map((x) => xs.filter((v) => v === x).length).sort();
    expect(rows).toEqual([1, 2, 3, 4]);
  });
  it("mirrors the right rack", () => {
    expect(slotPosition(1, 0).x).toBeCloseTo(240 - 31.9);
  });
  it("replays an rps tie and lets the winner throw first", () => {
    const tie = reduce(initialState(), { type: "rps", choices: ["rock", "rock"] });
    expect(tie.phase).toBe("rps");
    const s = reduce(tie, { type: "rps", choices: ["rock", "paper"] });
    expect(s.thrower).toBe(1);
    expect(s.first).toBe(1);
  });
});

describe("turns", () => {
  it("keeps hit cups on the table until the turn is complete", () => {
    const s = play(started(), air(0));
    expect(s.cups[1]).toHaveLength(10);
    expect(s.pending).toEqual([0]);
    const e = play(s, air(null));
    expect(e.cups[1]).toHaveLength(9);
    expect(e.thrower).toBe(1);
  });
  it("air hit removes 1 cup, bounce hit removes 2", () => {
    expect(play(started(), air(0), air(null)).cups[1]).toHaveLength(9);
    expect(play(started(), bounce(0), air(null)).cups[1]).toHaveLength(8);
  });
  it("bounce picks the nearest other cup", () => {
    const s = play(started(), bounce(0));
    expect(s.pending).toHaveLength(2);
    const slots = s.pending.map((id) => s.cups[1].find((c) => c.id === id)!.slot).sort();
    expect(slots).toEqual([0, 1]);
  });
  it("gives balls back once when both balls hit", () => {
    let s = play(started(), air(0), air(1));
    expect(s.thrower).toBe(0);
    expect(s.ballsBackUsed).toBe(true);
    s = play(s, air(2), air(3));
    expect(s.thrower).toBe(1);
    expect(s.cups[1]).toHaveLength(6 - 0);
  });
  it("same cup twice removes one cup and still gives balls back", () => {
    const s = play(started(), air(0), air(0));
    expect(s.thrower).toBe(0);
    const e = play(s, air(null), air(null));
    expect(e.cups[1]).toHaveLength(9);
  });
});

describe("re-rack", () => {
  it.each([6, 3, 1])("re-forms %i cups against the tip", (n) => {
    const scattered = makeRack(10).slice(10 - n);
    const r = reRack(scattered);
    expect(r.map((c) => c.slot)).toEqual(Array.from({ length: n }, (_, i) => i));
  });
  it("re-racks after a turn leaves 6", () => {
    let s = withCups(started(), 1, 8);
    s = play(s, bounce(5), air(null));
    expect(s.cups[1].map((c) => c.slot)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("ending", () => {
  it("ends when the second side clears the rack", () => {
    let s = started();
    s = { ...s, first: 1, thrower: 0 };
    s = withCups(s, 1, 1);
    s = play(s, air(0), air(null));
    expect(s.phase).toBe("over");
    expect(s.winner).toBe(0);
  });
  it("gives the other side one last turn after the first side clears", () => {
    let s = withCups(started(), 1, 1);
    s = play(s, air(0), air(null));
    expect(s.phase).toBe("reroll");
    expect(s.thrower).toBe(1);
    const e = play(s, air(null), air(null));
    expect(e.phase).toBe("over");
    expect(e.winner).toBe(0);
  });
  it("re-roll does not give balls back", () => {
    let s = withCups(started(), 1, 1);
    s = play(s, air(0), air(null));
    s = withCups(s, 0, 5);
    const e = play(s, air(0), air(1));
    expect(e.phase).toBe("over");
  });
  it("goes to sudden death when the re-roll clears the rack", () => {
    let s = withCups(started(), 1, 1);
    s = play(s, air(0), air(null));
    s = withCups(s, 0, 2);
    s = play(s, air(0), air(1));
    expect(s.phase).toBe("throwing");
    expect(s.suddenDeath).toBe(true);
    expect(s.cups[0]).toHaveLength(3);
    expect(s.thrower).toBe(0);
  });
  it("sudden death: equal turns, then the side with more cups wins", () => {
    let s = withCups(started(), 1, 1);
    s = play(s, air(0), air(null));
    s = withCups(s, 0, 2);
    s = play(s, air(0), air(1)); // sudden death starts, side 0 throws
    s = play(s, air(0), air(null)); // side 0 removes one of side 1's cups
    expect(s.phase).toBe("throwing");
    s = play(s, air(null), air(null)); // side 1 misses
    expect(s.phase).toBe("over");
    expect(s.winner).toBe(0);
  });
  it("rejects throws after the game is over", () => {
    let s = withCups(started(), 1, 1);
    s = play(s, air(0), air(null));
    s = play(s, air(null), air(null));
    expect(() => reduce(s, air(null))).toThrow();
  });
});
