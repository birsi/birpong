import { describe, expect, it } from "vitest";
import { makeRack } from "../engine";
import { inBounceWindow, aimFromPull, nominalLanding } from "./aim";
import { BALL_START, MAX_PULL, MAX_RANGE } from "./constants";
import { nearestCup } from "./cups";
import { inRack } from "./rackExit";
import { resolveThrow } from "./resolveThrow";
import { createRng } from "./rng";

const origin = BALL_START[0];

describe("aimFromPull", () => {
  it("throws opposite to the pull", () => {
    const aim = aimFromPull(origin, { x: origin.x - 9, y: origin.y })!;
    expect(aim.dir.x).toBeCloseTo(1);
    expect(aim.dir.y).toBeCloseTo(0);
    expect(aim.power).toBeCloseTo(0.5);
  });
  it("clamps power and the handle at the maximum pull", () => {
    const aim = aimFromPull(origin, { x: origin.x - 100, y: origin.y })!;
    expect(aim.power).toBe(1);
    expect(aim.handle.x).toBeCloseTo(origin.x - MAX_PULL);
  });
  it("returns null with no pull", () => {
    expect(aimFromPull(origin, origin)).toBeNull();
  });
});

describe("landing", () => {
  it("scales range with power", () => {
    const aim = aimFromPull(origin, { x: origin.x - MAX_PULL / 2, y: origin.y })!;
    expect(nominalLanding(origin, aim).x).toBeCloseTo(origin.x + MAX_RANGE / 2);
  });
  it("finds the cup under the landing point, nearest first", () => {
    const cups = makeRack(10);
    expect(nearestCup(1, cups, { x: 240 - 31.9, y: 30 })?.id).toBe(0);
    expect(nearestCup(1, cups, { x: 120, y: 30 })).toBeNull();
  });
  it("knows the bounce window", () => {
    expect(inBounceWindow(0.7)).toBe(true);
    expect(inBounceWindow(0.5)).toBe(false);
    expect(inBounceWindow(0.9)).toBe(false);
  });
});

describe("resolveThrow", () => {
  const cups = makeRack(10);
  // Pull so the throw is aimed straight at the tip of the right rack.
  const tip = { x: 240 - 31.9, y: 30 };
  const aimAt = (power: number) => {
    const dx = tip.x - origin.x;
    const dy = tip.y - origin.y;
    const len = Math.hypot(dx, dy);
    return aimFromPull(origin, {
      x: origin.x - (dx / len) * MAX_PULL * power,
      y: origin.y - (dy / len) * MAX_PULL * power,
    })!;
  };
  const exact = (dist: number) => dist / MAX_RANGE;

  it("is reproducible for a seed", () => {
    const aim = aimAt(exact(Math.hypot(tip.x - origin.x, tip.y - origin.y)));
    const a = resolveThrow(origin, aim, "air", 1, cups, createRng(7));
    const b = resolveThrow(origin, aim, "air", 1, cups, createRng(7));
    expect(a).toEqual(b);
  });
  it("hits the targeted cup more often with air than with bounce", () => {
    const power = exact(Math.hypot(tip.x - origin.x, tip.y - origin.y));
    const aim = aimAt(power);
    const rate = (shot: "air" | "bounce") => {
      const rng = createRng(1);
      let hits = 0;
      for (let i = 0; i < 2000; i++) {
        if (resolveThrow(origin, aim, shot, 1, cups, rng).target !== null) hits++;
      }
      return hits / 2000;
    };
    expect(power).toBeGreaterThan(0.64);
    expect(power).toBeLessThan(0.78);
    expect(rate("air")).toBeGreaterThan(rate("bounce"));
    expect(rate("bounce")).toBeGreaterThan(0.05);
  });
  it("never hits with a bounce outside the window", () => {
    const aim = aimAt(0.9);
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      expect(resolveThrow(origin, aim, "bounce", 1, cups, rng).target).toBeNull();
    }
  });
});

describe("cup rim", () => {
  const cups = makeRack(10);
  const tip = { x: 240 - 31.9, y: 30 };
  // Aim at the tip cup; scatter decides whether the ball lands in the core, on the rim or away.
  const landAt = (offset: number, seed: number) => {
    const dx = tip.x + offset - origin.x;
    const dy = tip.y - origin.y;
    const len = Math.hypot(dx, dy);
    const aim = aimFromPull(origin, {
      x: origin.x - (dx / len) * MAX_PULL * (len / MAX_RANGE),
      y: origin.y - (dy / len) * MAX_PULL * (len / MAX_RANGE),
    })!;
    return resolveThrow(origin, aim, "air", 1, cups, createRng(seed));
  };

  it("reports a clean, rattle-in or bounce-out contact consistently with the target", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const r = landAt(0, seed);
      seen.add(r.contact);
      if (r.contact === "clean" || r.contact === "rattle-in" || r.contact === "ricochet")
        expect(r.target).not.toBeNull();
      if (r.contact === "bounce-out") {
        expect(r.target).toBeNull();
        expect(r.touched).not.toBeNull();
        expect(r.bounces.length).toBeGreaterThan(0);
      }
      if (r.contact === "none") expect(r.touched).toBeNull();
    }
    for (const c of ["clean", "rattle-in", "bounce-out", "none"]) expect(seen.has(c)).toBe(true);
  });

  it("sometimes ricochets into a different, neighbouring cup, rarely", () => {
    let ricochets = 0;
    let bounces = 0;
    for (let seed = 1; seed <= 6000; seed++) {
      const r = landAt(0, seed);
      if (r.contact === "bounce-out") bounces++;
      if (r.contact !== "ricochet") continue;
      ricochets++;
      expect(r.target).not.toBeNull();
      expect(r.target).not.toBe(r.touched);
      expect(r.deflect).not.toBeNull();
    }
    expect(ricochets).toBeGreaterThan(0);
    expect(ricochets).toBeLessThan(bounces);
  });

  it("rim landings drop in less often than centre landings", () => {
    const rate = (contacts: string[]) =>
      contacts.filter((c) => c === "rattle-in" || c === "clean").length / contacts.length;
    const all: string[] = [];
    for (let seed = 1; seed <= 2000; seed++) all.push(landAt(0, seed).contact);
    const touched = all.filter((c) => c !== "none");
    // Fewer than all touches are hits, because some bounce out.
    expect(rate(touched)).toBeLessThan(1);
    expect(rate(touched)).toBeGreaterThan(0.5);
  });
});

describe("missing inside the rack", () => {
  const cups = makeRack(10);
  const tip = { x: 240 - 31.9, y: 30 };
  const aimAtTip = () => {
    const dx = tip.x - origin.x;
    const dy = tip.y - origin.y;
    const len = Math.hypot(dx, dy);
    return aimFromPull(origin, {
      x: origin.x - (dx / len) * MAX_PULL * (len / MAX_RANGE),
      y: origin.y - (dy / len) * MAX_PULL * (len / MAX_RANGE),
    })!;
  };

  it("knows the rack area", () => {
    expect(inRack(1, tip)).toBe(true);
    expect(inRack(1, { x: 120, y: 30 })).toBe(false);
    expect(inRack(0, { x: 20, y: 30 })).toBe(true);
    expect(inRack(0, tip)).toBe(false);
  });

  it("bounces every miss that stays in the rack out of it, and only those", () => {
    let leftRack = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const r = resolveThrow(origin, aimAtTip(), "air", 1, cups, createRng(seed));
      const last = r.bounces.at(-1);
      if (r.target !== null) {
        expect(r.bounces).toHaveLength(0);
      } else if (last) {
        leftRack++;
        expect(inRack(1, last)).toBe(false);
        expect(last.y).toBeGreaterThanOrEqual(0);
        expect(last.y).toBeLessThanOrEqual(60);
      } else {
        expect(inRack(1, r.landing)).toBe(false);
      }
    }
    expect(leftRack).toBeGreaterThan(0);
  });
});
