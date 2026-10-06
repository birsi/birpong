import type { Point } from "../geometry";
import type { Shot, Side } from "../engine";

// All distances are cm on the 240 x 60 table. Every number here is a placeholder to tune.

/** Where each player's ball rests, behind their own end of the table. */
export const BALL_START: Record<Side, Point> = {
  0: { x: -13, y: 38 },
  1: { x: 253, y: 38 },
};

// --- Aim and power
/** Distance a full-power throw travels. */
export const MAX_RANGE = 330;
/** Pull-back length that gives full power. */
export const MAX_PULL = 18;
/** Releases below this power (0 to 1) cancel the throw. */
export const MIN_POWER = 0.05;

// --- Accuracy
/** Landing ring radius shown to the player; the scatter sigma is half of it. */
export const RING_RADIUS: Record<Shot, number> = { air: 6, bounce: 12.5 };
/** A bounce only counts with power (0 to 1) inside this window. */
export const BOUNCE_WINDOW: readonly [number, number] = [0.64, 0.78];
/** Where a bounce touches the table, as a share of the way to the landing point. */
export const BOUNCE_TOUCHDOWN = 0.667;

// --- Cup and rim
export const CUP_RADIUS = 4.3;
/** A landing this close to a cup centre drops in cleanly; between it and CUP_RADIUS is the rim. */
export const CUP_CORE = 2.6;
/** Chance a rim landing rattles in: RIM_IN_INNER at the edge of the core, RIM_IN_OUTER at the rim edge. */
export const RIM_IN_INNER = 0.75;
export const RIM_IN_OUTER = 0.2;
/** How far a ball that bounces off the rim travels. */
export const DEFLECT_MIN = 6;
export const DEFLECT_MAX = 14;
/** Sideways jitter (rad, total width) of the kick direction. */
export const KICK_JITTER = 0.8;

// --- Ricochet into a neighbouring cup
export const RICOCHET_CHANCE = 0.12;
/** Only cups this close (centre to centre) to the clipped cup can be reached; rack spacing is 9.2. */
export const RICOCHET_REACH = 13;
/** The neighbour must lie within this angle (rad) of the kick direction. */
export const RICOCHET_ARC = 0.7;

// --- Missing inside the rack
/** A ball that misses inside the rack bounces out; its direction is spread over this angle (rad). */
export const EXIT_SPREAD = 1.6;
/** Extra distance (cm) the ball travels beyond the rack outline before it settles. */
export const EXIT_EXTRA_MIN = 5;
export const EXIT_EXTRA_MAX = 13;
/** Closest a bouncing ball gets to the long table edges (cm). */
export const TABLE_MARGIN = 3;
