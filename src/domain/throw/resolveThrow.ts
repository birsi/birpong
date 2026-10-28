import type { Point } from "../geometry";
import type { Cup, Shot, Side } from "../engine";
import { inBounceWindow, nominalLanding } from "./aim";
import {
  CUP_CORE,
  CUP_RADIUS,
  DEFLECT_MAX,
  DEFLECT_MIN,
  KICK_JITTER,
  RICOCHET_CHANCE,
  RIM_IN_INNER,
  RIM_IN_OUTER,
  RING_RADIUS,
} from "./constants";
import { nearestCup, ricochetCup, type CupHit } from "./cups";
import { exitPath, inRack } from "./rackExit";
import { gaussian, type Rng } from "./rng";
import type { Aim, ThrowResult } from "./types";

/** Nominal landing point plus Gaussian scatter; bounce shots scatter about twice as much. */
function scatter(nominal: Point, shot: Shot, rng: Rng): Point {
  const sigma = RING_RADIUS[shot] / 2;
  return { x: nominal.x + gaussian(rng) * sigma, y: nominal.y + gaussian(rng) * sigma };
}

/** Chance that a ball on the rim rattles in: high near the core, low at the edge. */
function chanceToRattleIn(dist: number): number {
  const edge = (dist - CUP_CORE) / (CUP_RADIUS - CUP_CORE);
  return RIM_IN_INNER + (RIM_IN_OUTER - RIM_IN_INNER) * edge;
}

/** A ball on the cup rim: rattles in, ricochets into a neighbour, or bounces away. */
function resolveRim(
  landing: Point,
  cup: CupHit,
  defender: Side,
  cups: readonly Cup[],
  rng: Rng,
): ThrowResult {
  const base = { landing, touched: cup.id };
  if (rng.frac() < chanceToRattleIn(cup.dist)) {
    return { ...base, target: cup.id, contact: "rattle-in", deflect: null, bounces: [] };
  }

  // Kicked away from the cup centre, with a little sideways jitter.
  const away =
    Math.atan2(landing.y - cup.center.y, landing.x - cup.center.x) +
    (rng.frac() - 0.5) * KICK_JITTER;
  const neighbour = ricochetCup(defender, cups, cup, away);
  if (neighbour && rng.frac() < RICOCHET_CHANCE) {
    return {
      ...base,
      target: neighbour.id,
      contact: "ricochet",
      deflect: neighbour.center,
      bounces: [],
    };
  }

  const travel = DEFLECT_MIN + rng.frac() * (DEFLECT_MAX - DEFLECT_MIN);
  const deflect = {
    x: landing.x + Math.cos(away) * travel,
    y: landing.y + Math.sin(away) * travel,
  };
  return { ...base, target: null, contact: "bounce-out", deflect: null, bounces: [deflect] };
}

/** A ball that did not drop in and is still inside the rack bounces out of it. */
function bounceOutOfRack(result: ThrowResult, defender: Side, rng: Rng): ThrowResult {
  if (result.target !== null) return result;
  const last = result.bounces.at(-1) ?? result.landing;
  if (!inRack(defender, last)) return result;
  return { ...result, bounces: [...result.bounces, ...exitPath(defender, last, rng)] };
}

function resolveContact(
  landing: Point,
  aim: Aim,
  shot: Shot,
  defender: Side,
  cups: readonly Cup[],
  rng: Rng,
): ThrowResult {
  const miss: ThrowResult = {
    landing,
    target: null,
    contact: "none",
    touched: null,
    deflect: null,
    bounces: [],
  };

  // A bounce outside the power window dies on the table or clears the rack.
  if (shot === "bounce" && !inBounceWindow(aim.power)) return miss;

  const cup = nearestCup(defender, cups, landing);
  if (!cup) return miss;
  if (cup.dist <= CUP_CORE) {
    return { ...miss, target: cup.id, contact: "clean", touched: cup.id };
  }
  return resolveRim(landing, cup, defender, cups, rng);
}

/** Turn an aim into what happens: where the ball lands and what it does at the cups. */
export function resolveThrow(
  origin: Point,
  aim: Aim,
  shot: Shot,
  defender: Side,
  cups: readonly Cup[],
  rng: Rng,
): ThrowResult {
  const landing = scatter(nominalLanding(origin, aim), shot, rng);
  const result = resolveContact(landing, aim, shot, defender, cups, rng);
  return bounceOutOfRack(result, defender, rng);
}
