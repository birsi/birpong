import { playRps } from "./rps";
import { throwBall } from "./throw";
import type { Action, State } from "./types";

/** The rules as a pure state machine: `(state, action) -> state`. Randomness lives outside. */
export function reduce(state: State, action: Action): State {
  if (state.phase === "over") throw new Error("game is over");
  if (action.type === "rps") return playRps(state, action.choices);
  if (state.phase === "rps") throw new Error("throw before first-throw decided");
  return throwBall(state, action.shot, action.target, action.second);
}
