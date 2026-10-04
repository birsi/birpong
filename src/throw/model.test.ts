import { describe, expect, it } from "vitest";
import { makeRack } from "../engine/rack";
import {
  BALL_START,
  MAX_PULL,
  MAX_RANGE,
  aimFromPull,
  findCup,
  inBounceWindow,
  nominalLanding,
  resolveThrow,
} from "./model";
import { mulberry32 } from "./rng";

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
    expect(findCup(1, cups, { x: 240 - 31.9, y: 30 })).toBe(0);
    expect(findCup(1, cups, { x: 120, y: 30 })).toBeNull();
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
    const a = resolveThrow(origin, aim, "air", 1, cups, mulberry32(7));
    const b = resolveThrow(origin, aim, "air", 1, cups, mulberry32(7));
    expect(a).toEqual(b);
  });
  it("hits the targeted cup more often with air than with bounce", () => {
    const power = exact(Math.hypot(tip.x - origin.x, tip.y - origin.y));
    const aim = aimAt(power);
    const rate = (shot: "air" | "bounce") => {
      const rng = mulberry32(1);
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
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      expect(resolveThrow(origin, aim, "bounce", 1, cups, rng).target).toBeNull();
    }
  });
});
