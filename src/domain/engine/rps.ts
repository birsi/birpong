import type { Rps, Side, State } from "./types";

const BEATS: Record<Rps, Rps> = { rock: "scissors", paper: "rock", scissors: "paper" };

/** Whether `a` beats `b`. */
export const beats = (a: Rps, b: Rps): boolean => BEATS[a] === b;

/** Rock, paper, scissors for the first throw. A tie leaves the state unchanged, so it is replayed. */
export function playRps(state: State, [a, b]: [Rps, Rps]): State {
  if (state.phase !== "rps") throw new Error("rps only before the match");
  if (a === b) return state;
  const winner: Side = beats(a, b) ? 0 : 1;
  return { ...state, phase: "throwing", first: winner, thrower: winner };
}
