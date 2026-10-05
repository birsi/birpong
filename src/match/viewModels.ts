import { CUPS_PER_SIDE, type Side, type State } from "../domain/engine";
import { BALLS_PER_ROUND } from "../domain/engine";
import { hint, turnTitle, type Names } from "./narration";
import type { Shot } from "../domain/engine";

/** One cup in the dots of a score card. */
export type DotKind = "standing" | "hit" | "gone";

export interface ScoreView {
  side: Side;
  name: string;
  tag: string;
  standing: number;
  /** Always CUPS_PER_SIDE dots: standing cups, then cups hit this turn, then removed cups. */
  dots: DotKind[];
}

export function scoreView(state: State, side: Side, names: Names): ScoreView {
  const standing = state.cups[side].length;
  // Cups hit by the thrower this turn are still on the table until the turn ends.
  const hits = side === state.thrower ? 0 : state.pending.length;
  const dots: DotKind[] = Array.from({ length: CUPS_PER_SIDE }, (_, i) =>
    i < standing - hits ? "standing" : i < standing ? "hit" : "gone",
  );
  return { side, name: names[side], tag: side === 0 ? "P1" : "P2", standing, dots };
}

export type BallKind = "hit" | "miss" | "now" | "waiting";

export interface BallView {
  kind: BallKind;
  label: string;
}

export interface TurnView {
  title: string;
  /** The balls of the current round; null once the game is over. */
  balls: BallView[] | null;
  text: string;
  over: boolean;
}

export function turnView(state: State, shot: Shot, note: string, names: Names): TurnView {
  const over = state.phase === "over";
  const thrown = state.log.slice(state.log.length - state.ballsThrown);
  const balls = over
    ? null
    : Array.from({ length: BALLS_PER_ROUND }, (_, i): BallView => {
        const n = i + 1;
        const done = thrown[i];
        if (done)
          return {
            kind: done.hit ? "hit" : "miss",
            label: `Ball ${n} ${done.hit ? "hit" : "miss"}`,
          };
        if (i === state.ballsThrown) return { kind: "now", label: `Ball ${n} aiming` };
        return { kind: "waiting", label: `Ball ${n}` };
      });
  return { title: turnTitle(state, names), balls, text: note || hint(state, shot), over };
}

export interface LogRow {
  turn: string;
  who: string;
  shot: string;
  result: string;
}

/** The last throws, newest first. */
export function logRows(state: State, names: Names, count = 5): LogRow[] {
  return state.log
    .slice(-count)
    .reverse()
    .map((r) => {
      const waiting = r.hit && state.pending.length > 0 && r.turn === state.turn;
      return {
        turn: `T${r.turn}`,
        who: names[r.side],
        shot: r.shot,
        result: r.hit ? (waiting ? "hit, cup leaves at turn end" : "hit") : "miss",
      };
    });
}
