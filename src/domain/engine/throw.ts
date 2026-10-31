import { BALLS_PER_ROUND } from "./constants";
import { cupDistance } from "./rack";
import { opponent } from "./state";
import { endTurn } from "./turn";
import type { Cup, Shot, State } from "./types";

/** Standing cups the thrower may take as the second cup of a bounce hit on `targetId`, nearest first. */
export function secondCupCandidates(state: State, targetId: number): Cup[] {
  const defender = opponent(state.thrower);
  const target = state.cups[defender].find((c) => c.id === targetId);
  if (!target) return [];
  const taken = new Set([...state.pending, targetId]);
  return state.cups[defender]
    .filter((c) => !taken.has(c.id))
    .sort((p, q) => cupDistance(defender, p, target) - cupDistance(defender, q, target));
}

/**
 * Cups newly hit by one throw: the targeted cup, plus for a bounce shot another standing cup that
 * is not already hit this turn: the one the thrower picked, or the nearest.
 */
function hitCups(state: State, shot: Shot, target: Cup, second?: number): number[] {
  const hit = [target.id];
  if (shot === "bounce") {
    const candidates = secondCupCandidates(state, target.id);
    if (second !== undefined && !candidates.some((c) => c.id === second)) {
      throw new Error(`cup ${second} cannot be the second cup`);
    }
    const picked = second ?? candidates[0]?.id;
    if (picked !== undefined) hit.push(picked);
  }
  return hit;
}

/** One ball: mark hit cups, log it and, after the second ball of a round, end the round or the turn. */
export function throwBall(
  state: State,
  shot: Shot,
  targetId: number | null,
  second?: number,
): State {
  const defender = opponent(state.thrower);
  const target = state.cups[defender].find((c) => c.id === targetId);
  if (targetId !== null && !target) throw new Error(`no cup ${targetId} on side ${defender}`);

  const marked = target ? hitCups(state, shot, target, second) : [];
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

  // Every cup left is already hit: there is nothing more to throw at, so the turn is over now
  // (no second ball, no balls back) and the cups are removed.
  const nothingLeft = state.cups[defender].every((c) => next.pending.includes(c.id));
  if (nothingLeft) return endTurn(next);

  if (next.ballsThrown < BALLS_PER_ROUND) return next;

  // Balls back: both balls hit, once per turn (not in the last-chance re-roll).
  const bothHit = next.hitsInRound === BALLS_PER_ROUND;
  if (bothHit && !next.ballsBackUsed && state.phase !== "reroll") {
    return { ...next, ballsThrown: 0, hitsInRound: 0, ballsBackUsed: true };
  }
  return endTurn(next);
}
