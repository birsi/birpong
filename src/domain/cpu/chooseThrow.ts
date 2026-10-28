import { opponent, slotPosition, type Cup, type Shot, type Side, type State } from "../engine";
import { distance, type Point } from "../geometry";
import {
  BALL_START,
  MAX_RANGE,
  MIN_POWER,
  aimAt,
  aimFromAngle,
  gaussian,
  inBounceWindow,
  type Aim,
  type Rng,
} from "../throw";
import { LEVEL_TUNING, type CpuLevel } from "./levels";

export interface CpuThrow {
  shot: Shot;
  aim: Aim;
  /** The cup the CPU is aiming at. */
  target: number;
}

const TIP_SLOT = 0;
const MEDIUM_CANDIDATES = 3;

/** Cups ordered by how close they are to `point`. */
function nearest(side: Side, cups: readonly Cup[], point: Point): Cup[] {
  return [...cups].sort(
    (a, b) =>
      distance(slotPosition(side, a.slot), point) - distance(slotPosition(side, b.slot), point),
  );
}

/**
 * Which cup to aim at. Easy picks any cup; medium one of the cups nearest the tip (the front of
 * the rack); hard the cup in the middle of the cluster, so near misses still land on a neighbour.
 */
function chooseTarget(side: Side, cups: readonly Cup[], level: CpuLevel, rng: Rng): Cup {
  if (level === "easy") return rng.pick([...cups]);
  if (level === "medium") {
    const tip = slotPosition(side, TIP_SLOT);
    return rng.pick(nearest(side, cups, tip).slice(0, MEDIUM_CANDIDATES));
  }
  const points = cups.map((c) => slotPosition(side, c.slot));
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  return nearest(side, cups, centroid)[0]!;
}

/** Decide what `side` throws next: a target, a shot type and an aim with the level's error. */
export function chooseThrow(state: State, side: Side, level: CpuLevel, rng: Rng): CpuThrow {
  const defender = opponent(side);
  const cups = state.cups[defender];
  if (cups.length === 0) throw new Error("no cups to aim at");

  const origin = BALL_START[side];
  const tuning = LEVEL_TUNING[level];
  const target = chooseTarget(defender, cups, level, rng);
  const point = slotPosition(defender, target.slot);
  const perfect = aimAt(origin, point);
  if (!perfect) throw new Error("target out of range");

  const shot: Shot =
    inBounceWindow(perfect.power) && rng.frac() < tuning.bounceChance ? "bounce" : "air";

  // Aim error in cm at the target becomes an angle error and a power error.
  const range = distance(origin, point);
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
  const err = tuning.aimError;
  const aim = aimFromAngle(
    origin,
    angle + (gaussian(rng) * err) / range,
    Math.min(1, Math.max(MIN_POWER, perfect.power + (gaussian(rng) * err) / MAX_RANGE)),
  );
  return { shot, aim, target: target.id };
}
