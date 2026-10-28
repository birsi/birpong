import type { Shot, State } from "../domain/engine";
import { opponent } from "../domain/engine";
import type { Contact } from "../domain/throw";

export type Names = readonly [string, string];

/** The human is addressed as "You", so texts need second-person grammar. */
export const YOU = "You";
const isYou = (name: string): boolean => name === YOU;
const possessive = (name: string): string => (isYou(name) ? "Your" : `${name}'s`);
/** Present-tense verb agreeing with the name: "You get", "CPU gets". */
const verb = (name: string, base: string): string => (isYou(name) ? base : `${base}s`);

import type { CpuLevel } from "../domain/cpu";

/** "medium" -> "Medium". */
export const levelLabel = (level: CpuLevel): string =>
  level.charAt(0).toUpperCase() + level.slice(1);

/** Big heading of the turn card. */
export function turnTitle(state: State, names: Names): string {
  if (state.phase === "over") {
    const winner = names[state.winner!];
    return `${winner} ${verb(winner, "win")}`.toUpperCase();
  }
  if (state.phase === "reroll") return "LAST CHANCE";
  if (state.suddenDeath) return "SUDDEN DEATH";
  return `${possessive(names[state.thrower])} turn`.toUpperCase();
}

/** Advice under the heading while nothing else has just happened. */
export function hint(state: State, shot: Shot): string {
  if (state.phase === "reroll") return "One last turn. Clear the whole rack to force sudden death.";
  if (shot === "bounce") return "A bounce hit takes 2 cups. Land it inside the marked window.";
  return "Hit with both balls and both come back.";
}

/** Help text next to the power bar. */
export function powerHelp(shot: Shot): string {
  return shot === "bounce"
    ? "A bounce only lands with the power inside the marked window. Too soft dies on the table, too hard clears the rack."
    : "Drag back from the ball to aim. Pull further for more power. Release to throw.";
}

/** What the ball did at the rim, if anything. */
export function rimNote(contact: Contact): string {
  switch (contact) {
    case "rattle-in":
      return "Rattled in off the rim!";
    case "ricochet":
      return "Off the rim and into the next cup!";
    case "bounce-out":
      return "Off the rim, bounced out.";
    default:
      return "";
  }
}

const cups = (n: number) => `${n} ${n === 1 ? "cup" : "cups"}`;

/** What changed between two states after a throw; empty when nothing worth saying happened. */
export function turnSummary(before: State, after: State, names: Names): string {
  if (after.phase === "over") return "";
  if (after.phase === "reroll" && before.phase !== "reroll") {
    const next = names[after.thrower];
    return `${names[before.thrower]} cleared the rack. ${next} ${verb(next, "get")} one last turn.`;
  }
  if (after.suddenDeath && !before.suddenDeath) return "Sudden death. New 3-cup racks.";

  const sameThrower = after.thrower === before.thrower;
  if (sameThrower && after.ballsThrown === 0 && after.ballsBackUsed) {
    return "Both balls hit. Balls back!";
  }
  if (!sameThrower) {
    const target = opponent(before.thrower);
    const left = after.cups[target].length;
    const lost = before.cups[target].length - left;
    const who = names[before.thrower];
    return lost > 0 ? `${who} sank ${cups(lost)}. ${left} left.` : `${who} missed.`;
  }
  return "";
}
