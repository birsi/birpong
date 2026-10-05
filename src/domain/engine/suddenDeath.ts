import { SUDDEN_DEATH_CUPS } from "./constants";
import { makeRack } from "./rack";
import type { State } from "./types";

const freshRacks = (): State["cups"] => [makeRack(SUDDEN_DEATH_CUPS), makeRack(SUDDEN_DEATH_CUPS)];

/** Fresh small racks; the side that threw first starts. */
export function startSuddenDeath(state: State): State {
  return {
    ...state,
    phase: "throwing",
    suddenDeath: true,
    cups: freshRacks(),
    thrower: state.first!,
  };
}

/**
 * End of a turn in sudden death. Both sides get an equal number of turns; after both have thrown,
 * the side with more cups left wins, and a tie starts another pair of turns.
 * `ended` is the state after the turn with cups removed; `swapped` is the same with the other side up.
 */
export function endSuddenDeathTurn(ended: State, swapped: State): State {
  if (ended.thrower === ended.first) return swapped; // the other side still owes a turn

  const [a, b] = [ended.cups[0].length, ended.cups[1].length];
  if (a !== b) return { ...ended, phase: "over", winner: a > b ? 0 : 1 };

  // Level: next pair of turns, refilling the racks if both are empty.
  const next = a === 0 ? { ...swapped, cups: freshRacks() } : swapped;
  return { ...next, thrower: ended.first! };
}
