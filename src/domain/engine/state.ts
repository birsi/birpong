import { CUPS_PER_SIDE } from "./constants";
import { makeRack } from "./rack";
import type { Side, State } from "./types";

export function initialState(): State {
  return {
    phase: "rps",
    cups: [makeRack(CUPS_PER_SIDE), makeRack(CUPS_PER_SIDE)],
    first: null,
    thrower: 0,
    turn: 1,
    ballsThrown: 0,
    hitsInRound: 0,
    ballsBackUsed: false,
    pending: [],
    suddenDeath: false,
    winner: null,
    log: [],
  };
}

export const opponent = (side: Side): Side => (side === 0 ? 1 : 0);
