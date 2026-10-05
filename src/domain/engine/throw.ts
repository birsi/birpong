import { BALLS_PER_ROUND } from "./constants";
import { cupDistance } from "./rack";
import { opponent } from "./state";
import { endTurn } from "./turn";
import type { Cup, Shot, State } from "./types";

/**
 * Cups newly hit by one throw: the targeted cup, plus for a bounce shot the nearest other standing
 * cup that is not already hit this turn.
 */
function hitCups(state: State, shot: Shot, target: Cup): number[] {
  const defender = opponent(state.thrower);
  const hit = [target.id];
  if (shot === "bounce") {
    const taken = new Set([...state.pending, target.id]);
    const second = state.cups[defender]
      .filter((c) => !taken.has(c.id))
      .sort((p, q) => cupDistance(defender, p, target) - cupDistance(defender, q, target))[0];
    if (second) hit.push(second.id);
  }
  return hit;
}

/** One ball: mark hit cups, log it and, after the second ball of a round, end the round or the turn. */
export function throwBall(state: State, shot: Shot, targetId: number | null): State {
  const defender = opponent(state.thrower);
  const target = state.cups[defender].find((c) => c.id === targetId);
  if (targetId !== null && !target) throw new Error(`no cup ${targetId} on side ${defender}`);

  const marked = target ? hitCups(state, shot, target) : [];
  const newlyMarked = marked.filter((id) => !state.pending.includes(id));
  const next: State = {
    ...state,
    pending: [...state.pending, ...newlyMarked],
    ballsThrown: state.ballsThrown + 1,
    hitsInRound: state.hitsInRound + (target ? 1 : 0),
    log: [
      ...state.log,
      {
        turn: state.turn,
        side: state.thrower,
        shot,
        slot: target?.slot ?? null,
        hit: target !== undefined,
        marked: newlyMarked.length,
      },
    ],
  };
  if (next.ballsThrown < BALLS_PER_ROUND) return next;

  // Balls back: both balls hit, once per turn (not in the last-chance re-roll).
  const bothHit = next.hitsInRound === BALLS_PER_ROUND;
  if (bothHit && !next.ballsBackUsed && state.phase !== "reroll") {
    return { ...next, ballsThrown: 0, hitsInRound: 0, ballsBackUsed: true };
  }
  return endTurn(next);
}
