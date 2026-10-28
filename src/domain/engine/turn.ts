import { reRack } from "./rack";
import { opponent } from "./state";
import { endSuddenDeathTurn, startSuddenDeath } from "./suddenDeath";
import type { State } from "./types";

/** Remove the cups hit this turn, re-rack, and decide who throws next or who has won. */
export function endTurn(state: State): State {
  const defender = opponent(state.thrower);
  const removed = new Set(state.pending);
  const cups: State["cups"] = [state.cups[0], state.cups[1]];
  cups[defender] = reRack(state.cups[defender].filter((c) => !removed.has(c.id)));

  const ended: State = {
    ...state,
    cups,
    pending: [],
    ballsThrown: 0,
    hitsInRound: 0,
    ballsBackUsed: false,
  };
  const swapped: State = { ...ended, thrower: defender, turn: state.turn + 1 };
  const rackCleared = cups[defender].length === 0;

  if (state.suddenDeath) return endSuddenDeathTurn(ended, swapped);

  if (state.phase === "reroll") {
    // Last chance for the second side: only a full clear of the first side's rack forces sudden death.
    return rackCleared
      ? startSuddenDeath(swapped)
      : { ...ended, phase: "over", winner: state.first };
  }

  if (!rackCleared) return swapped;
  // The side that threw first cleared the rack: the other side gets one last turn.
  if (state.thrower === state.first) return { ...swapped, phase: "reroll" };
  return { ...ended, phase: "over", winner: state.thrower };
}
