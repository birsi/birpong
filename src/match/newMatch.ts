import { initialState, reduce, type Side, type State } from "../domain/engine";

/** A fresh match in which `first` has won rock, paper, scissors and throws first. */
export function newMatch(first: Side): State {
  return reduce(initialState(), {
    type: "rps",
    choices: first === 0 ? ["rock", "scissors"] : ["scissors", "rock"],
  });
}
