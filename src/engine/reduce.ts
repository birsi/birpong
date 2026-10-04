import { CUPS_PER_SIDE, distance, makeRack, reRack } from "./rack";
import type { Action, Rps, Side, State } from "./types";

const BEATS: Record<Rps, Rps> = { rock: "scissors", paper: "rock", scissors: "paper" };
const SUDDEN_DEATH_CUPS = 3;

export function initialState(): State {
  return {
    phase: "rps",
    cups: [makeRack(CUPS_PER_SIDE), makeRack(CUPS_PER_SIDE)],
    first: null,
    thrower: 0,
    ballsThrown: 0,
    hitsInRound: 0,
    ballsBackUsed: false,
    pending: [],
    suddenDeath: false,
    winner: null,
    log: [],
  };
}

const other = (s: Side): Side => (s === 0 ? 1 : 0);

export function reduce(state: State, action: Action): State {
  if (state.phase === "over") throw new Error("game is over");
  if (action.type === "rps") return reduceRps(state, action.choices);
  if (state.phase === "rps") throw new Error("throw before first-throw decided");
  return reduceThrow(state, action.shot, action.target);
}

function reduceRps(state: State, [a, b]: [Rps, Rps]): State {
  if (state.phase !== "rps") throw new Error("rps only before the match");
  if (a === b) return state; // tie is replayed
  const winner: Side = BEATS[a] === b ? 0 : 1;
  return { ...state, phase: "throwing", first: winner, thrower: winner };
}

function reduceThrow(state: State, shot: "air" | "bounce", target: number | null): State {
  const defender = other(state.thrower);
  const rack = state.cups[defender];

  let marked: number[] = [];
  let slot: number | null = null;
  const hit = target !== null;
  if (target !== null) {
    const cup = rack.find((c) => c.id === target);
    if (!cup) throw new Error(`no cup ${target} on side ${defender}`);
    slot = cup.slot;
    marked.push(cup.id);
    if (shot === "bounce") {
      // Second cup: nearest standing cup that is not already hit this turn.
      const taken = new Set([...state.pending, cup.id]);
      const next = rack
        .filter((c) => !taken.has(c.id))
        .sort((p, q) => distance(defender, p, cup) - distance(defender, q, cup))[0];
      if (next) marked.push(next.id);
    }
  }
  const pending = [...state.pending];
  const newlyMarked = marked.filter((id) => !pending.includes(id));
  pending.push(...newlyMarked);

  const next: State = {
    ...state,
    pending,
    ballsThrown: state.ballsThrown + 1,
    hitsInRound: state.hitsInRound + (hit ? 1 : 0),
    log: [
      ...state.log,
      { side: state.thrower, shot, slot, hit, marked: newlyMarked.length },
    ],
  };
  if (next.ballsThrown < 2) return next;

  // Round finished. Balls back: both hit, once per turn (not in the last-chance re-roll).
  if (next.hitsInRound === 2 && !next.ballsBackUsed && state.phase !== "reroll") {
    return { ...next, ballsThrown: 0, hitsInRound: 0, ballsBackUsed: true };
  }
  return endTurn(next);
}

function endTurn(state: State): State {
  const defender = other(state.thrower);
  const removed = new Set(state.pending);
  const left = state.cups[defender].filter((c) => !removed.has(c.id));
  const cups: [typeof left, typeof left] = [state.cups[0], state.cups[1]];
  cups[defender] = reRack(left);

  const base: State = {
    ...state,
    cups,
    pending: [],
    ballsThrown: 0,
    hitsInRound: 0,
    ballsBackUsed: false,
  };
  const swap = { ...base, thrower: defender };

  if (state.suddenDeath) return endSuddenDeathTurn(base, swap);

  if (state.phase === "reroll") {
    // Last chance for the second side: only a full clear of the first side's rack forces sudden death.
    if (cups[defender]!.length === 0) return startSuddenDeath(swap);
    return { ...base, phase: "over", winner: state.first };
  }

  if (cups[defender]!.length === 0) {
    if (state.thrower === state.first) return { ...swap, phase: "reroll" };
    return { ...base, phase: "over", winner: state.thrower };
  }
  return swap;
}

function startSuddenDeath(state: State): State {
  return {
    ...state,
    phase: "throwing",
    suddenDeath: true,
    cups: [makeRack(SUDDEN_DEATH_CUPS), makeRack(SUDDEN_DEATH_CUPS)],
    thrower: state.first!,
  };
}

/** Sudden death: both sides get an equal number of turns; the side with more cups left wins. */
function endSuddenDeathTurn(base: State, swap: State): State {
  if (base.thrower === base.first) return swap; // the other side still owes a turn
  const [a, b] = [base.cups[0].length, base.cups[1].length];
  if (a === b) {
    // Still level: start the next pair of turns, refilling if both racks are empty.
    const next = a === 0 ? { ...swap, cups: [makeRack(SUDDEN_DEATH_CUPS), makeRack(SUDDEN_DEATH_CUPS)] as State["cups"] } : swap;
    return { ...next, thrower: base.first! };
  }
  return { ...base, phase: "over", winner: a > b ? 0 : 1 };
}
