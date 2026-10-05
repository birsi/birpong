import { initialState, reduce, type Rps, type State } from "../domain/engine";
import type { Rng } from "../domain/throw";

const CHOICES: Rps[] = ["rock", "paper", "scissors"];

/** A fresh match with the first thrower decided by rock, paper, scissors (ties replayed). */
export function newMatch(rng: Rng): State {
  let state = initialState();
  while (state.phase === "rps") {
    state = reduce(state, { type: "rps", choices: [rng.pick(CHOICES), rng.pick(CHOICES)] });
  }
  return state;
}
