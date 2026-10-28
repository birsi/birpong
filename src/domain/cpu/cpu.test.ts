import { describe, expect, it } from "vitest";
import { initialState, makeRack, reduce, type State } from "../engine";
import { BALL_START, aimAt, aimFromPull, createRng, resolveThrow } from "../throw";
import { chooseThrow } from "./chooseThrow";
import { CPU_LEVELS, type CpuLevel } from "./levels";

const started = (): State => reduce(initialState(), { type: "rps", choices: ["rock", "scissors"] });

/** The same match state with side 1 (the CPU) up. */
const cpuUp = (): State => ({ ...started(), thrower: 1 });

describe("aimAt", () => {
  it("round-trips with aimFromPull", () => {
    const origin = BALL_START[0];
    const aim = aimAt(origin, { x: 220, y: 33 })!;
    const again = aimFromPull(origin, aim.handle)!;
    expect(again.power).toBeCloseTo(aim.power);
    expect(again.dir.x).toBeCloseTo(aim.dir.x);
    expect(again.dir.y).toBeCloseTo(aim.dir.y);
  });
  it("is null beyond the maximum range", () => {
    expect(aimAt(BALL_START[0], { x: 400, y: 30 })).toBeNull();
  });
});

describe("chooseThrow", () => {
  it("always aims at a standing cup and is reproducible for a seed", () => {
    const state = cpuUp();
    for (const level of CPU_LEVELS) {
      const a = chooseThrow(state, 1, level, createRng(5));
      const b = chooseThrow(state, 1, level, createRng(5));
      expect(a).toEqual(b);
      expect(state.cups[0].some((c) => c.id === a.target)).toBe(true);
      expect(a.aim.power).toBeGreaterThan(0);
      expect(a.aim.power).toBeLessThanOrEqual(1);
    }
  });

  it("never picks bounce on easy", () => {
    const rng = createRng(2);
    for (let i = 0; i < 300; i++) {
      expect(chooseThrow(cpuUp(), 1, "easy", rng).shot).toBe("air");
    }
  });

  it("uses bounce sometimes on hard, and only inside the power window", () => {
    const rng = createRng(3);
    let bounces = 0;
    for (let i = 0; i < 400; i++) {
      const t = chooseThrow(cpuUp(), 1, "hard", rng);
      if (t.shot === "bounce") bounces++;
    }
    expect(bounces).toBeGreaterThan(0);
    expect(bounces).toBeLessThan(400);
  });

  it("aims at the last cup when only one is left", () => {
    const state: State = { ...cpuUp(), cups: [makeRack(1), makeRack(10)] };
    for (const level of CPU_LEVELS) {
      expect(chooseThrow(state, 1, level, createRng(1)).target).toBe(0);
    }
  });

  it("throws harder levels hit more often: easy < medium < hard", () => {
    const rate = (level: CpuLevel) => {
      const rng = createRng(11);
      const state = cpuUp();
      let hits = 0;
      const throws = 3000;
      for (let i = 0; i < throws; i++) {
        const t = chooseThrow(state, 1, level, rng);
        const r = resolveThrow(BALL_START[1], t.aim, t.shot, 0, state.cups[0], rng);
        if (r.target !== null) hits++;
      }
      return hits / throws;
    };
    const [easy, medium, hard] = [rate("easy"), rate("medium"), rate("hard")];
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
    expect(easy).toBeGreaterThan(0.02);
    expect(hard).toBeLessThan(0.7);
  });
});
