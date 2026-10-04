import { slotPosition } from "../engine/rack";
import type { Cup, Shot, Side } from "../engine/types";
import { gaussian, type Rng } from "./rng";

export interface Point {
  x: number;
  y: number;
}

/** Distances are in cm on the 240 x 60 table; every number here is a placeholder to tune. */
export const MAX_RANGE = 330;
export const MAX_PULL = 18;
export const MIN_POWER = 0.05;
export const CUP_RADIUS = 4.3;
/** A landing within this distance of a cup centre drops in cleanly. Between it and CUP_RADIUS is the rim. */
export const CUP_CORE = 2.6;
/** Chance a rim landing rattles in: this at the edge of the core, falling to RIM_IN_EDGE at the outer rim. */
export const RIM_IN_INNER = 0.75;
export const RIM_IN_OUTER = 0.2;
/** How far a ball that bounces off the rim travels, in cm. */
export const DEFLECT_MIN = 6;
export const DEFLECT_MAX = 14;
/** Chance that a ball bouncing off the rim kicks into a neighbouring cup instead of away. */
export const RICOCHET_CHANCE = 0.12;
/** Only cups this close to the rim cup (cm, centre to centre) can be reached; the rack spacing is 9.2. */
export const RICOCHET_REACH = 13;
/** The neighbour must lie within this angle (rad) of the kick direction. */
export const RICOCHET_ARC = 0.7;
export const BOUNCE_WINDOW: readonly [number, number] = [0.64, 0.78];
/** Landing ring radius shown to the player; scatter sigma is half of it. */
export const RING_RADIUS: Record<Shot, number> = { air: 6, bounce: 12.5 };
/** Where the bounce touches the table, as a share of the way to the landing point. */
export const BOUNCE_TOUCHDOWN = 0.667;

export const BALL_START: Record<Side, Point> = {
  0: { x: -13, y: 38 },
  1: { x: 253, y: 38 },
};

export interface Aim {
  /** Unit vector the ball is thrown along. */
  dir: Point;
  /** 0 to 1. */
  power: number;
  /** Where the pull-back handle is drawn, clamped to MAX_PULL. */
  handle: Point;
}

/** Drag back from the ball: the throw goes the opposite way, the pull length sets the power. */
export function aimFromPull(origin: Point, pointer: Point): Aim | null {
  const vx = pointer.x - origin.x;
  const vy = pointer.y - origin.y;
  const len = Math.hypot(vx, vy);
  if (len === 0) return null;
  const pull = Math.min(len, MAX_PULL);
  const ux = vx / len;
  const uy = vy / len;
  return {
    dir: { x: -ux, y: -uy },
    power: pull / MAX_PULL,
    handle: { x: origin.x + ux * pull, y: origin.y + uy * pull },
  };
}

/** Landing point with no scatter. */
export function nominalLanding(origin: Point, aim: Aim): Point {
  const d = aim.power * MAX_RANGE;
  return { x: origin.x + aim.dir.x * d, y: origin.y + aim.dir.y * d };
}

export function touchdown(origin: Point, landing: Point): Point {
  return {
    x: origin.x + (landing.x - origin.x) * BOUNCE_TOUCHDOWN,
    y: origin.y + (landing.y - origin.y) * BOUNCE_TOUCHDOWN,
  };
}

export function inBounceWindow(power: number): boolean {
  return power >= BOUNCE_WINDOW[0] && power <= BOUNCE_WINDOW[1];
}

/** Nearest standing cup whose opening contains the landing point, or null (used for the aim preview). */
export function findCup(defender: Side, cups: readonly Cup[], landing: Point): number | null {
  let best: number | null = null;
  let bestDist = CUP_RADIUS;
  for (const cup of cups) {
    const p = slotPosition(defender, cup.slot);
    const d = Math.hypot(p.x - landing.x, p.y - landing.y);
    if (d <= bestDist) {
      best = cup.id;
      bestDist = d;
    }
  }
  return best;
}

export type Contact = "none" | "clean" | "rattle-in" | "bounce-out" | "ricochet";

export interface ThrowResult {
  landing: Point;
  /** Cup id hit, or null for a miss. */
  target: number | null;
  /** What the ball did at the nearest cup: dropped in, rattled in, bounced out, or bounced into a neighbouring cup. */
  contact: Contact;
  /** Cup id the ball touched (also set for a bounce-out, where target is null). */
  touched: number | null;
  /** Where a ball that bounced off the rim ends up (the neighbouring cup's centre for a ricochet). */
  deflect: Point | null;
}

/** Nearest cup whose rim the landing point touches, with its distance. */
function nearestCup(defender: Side, cups: readonly Cup[], landing: Point): { id: number; dist: number; center: Point } | null {
  let best: { id: number; dist: number; center: Point } | null = null;
  for (const cup of cups) {
    const center = slotPosition(defender, cup.slot);
    const dist = Math.hypot(center.x - landing.x, center.y - landing.y);
    if (dist <= CUP_RADIUS && (!best || dist < best.dist)) best = { id: cup.id, dist, center };
  }
  return best;
}

/** The standing cup nearest the kick direction, within reach of the cup that was clipped. */
function ricochetCup(
  defender: Side,
  cups: readonly Cup[],
  from: { id: number; center: Point },
  direction: number,
): { id: number; center: Point } | null {
  let best: { id: number; center: Point } | null = null;
  let bestDiff = RICOCHET_ARC;
  for (const cup of cups) {
    if (cup.id === from.id) continue;
    const center = slotPosition(defender, cup.slot);
    const dx = center.x - from.center.x;
    const dy = center.y - from.center.y;
    if (Math.hypot(dx, dy) > RICOCHET_REACH) continue;
    let diff = Math.abs(Math.atan2(dy, dx) - direction);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      best = { id: cup.id, center };
      bestDiff = diff;
    }
  }
  return best;
}

export function resolveThrow(
  origin: Point,
  aim: Aim,
  shot: Shot,
  defender: Side,
  cups: readonly Cup[],
  rng: Rng,
): ThrowResult {
  const nominal = nominalLanding(origin, aim);
  const sigma = RING_RADIUS[shot] / 2;
  const landing = {
    x: nominal.x + gaussian(rng) * sigma,
    y: nominal.y + gaussian(rng) * sigma,
  };
  const miss: ThrowResult = { landing, target: null, contact: "none", touched: null, deflect: null };
  // A bounce outside the power window dies on the table or clears the rack.
  if (shot === "bounce" && !inBounceWindow(aim.power)) return miss;

  const cup = nearestCup(defender, cups, landing);
  if (!cup) return miss;
  if (cup.dist <= CUP_CORE) return { landing, target: cup.id, contact: "clean", touched: cup.id, deflect: null };

  // Rim: the closer to the edge, the likelier the ball bounces out.
  const edge = (cup.dist - CUP_CORE) / (CUP_RADIUS - CUP_CORE);
  const chanceIn = RIM_IN_INNER + (RIM_IN_OUTER - RIM_IN_INNER) * edge;
  if (rng() < chanceIn) return { landing, target: cup.id, contact: "rattle-in", touched: cup.id, deflect: null };

  // Away from the cup centre, with a little sideways jitter.
  const away = Math.atan2(landing.y - cup.center.y, landing.x - cup.center.x) + (rng() - 0.5) * 0.8;
  const neighbour = ricochetCup(defender, cups, cup, away);
  if (neighbour && rng() < RICOCHET_CHANCE) {
    return { landing, target: neighbour.id, contact: "ricochet", touched: cup.id, deflect: neighbour.center };
  }
  const travel = DEFLECT_MIN + rng() * (DEFLECT_MAX - DEFLECT_MIN);
  const deflect = { x: landing.x + Math.cos(away) * travel, y: landing.y + Math.sin(away) * travel };
  return { landing, target: null, contact: "bounce-out", touched: cup.id, deflect };
}
