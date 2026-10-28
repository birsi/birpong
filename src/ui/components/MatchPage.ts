import { button, el } from "../dom";
import type { ScoreCard } from "./ScoreCard";
import type { ShotPanel } from "./ShotPanel";
import type { ThrowLog } from "./ThrowLog";
import type { TurnCard } from "./TurnCard";

export const RULES_URL = "https://www.beerpongaustria.com/beer-pong-austria-game-rules/";

export interface MatchPageParts {
  scoreA: ScoreCard;
  turn: TurnCard;
  scoreB: ScoreCard;
  shotPanel: ShotPanel;
  log: ThrowLog;
}

/** The match screen skeleton: header, scoreboards, the arena for the table, and the lower panels. */
export class MatchPage {
  /** Empty container the table scene is mounted into. */
  readonly arena = el("div", "arena");

  constructor(
    root: HTMLElement,
    parts: MatchPageParts,
    header: { mode: string; onLeave: () => void },
  ) {
    this.arena.setAttribute("role", "img");
    this.arena.ariaLabel =
      "Beer pong table seen from above. Drag back from the glowing ball to throw.";

    const brand = el("div", "match__brand");
    brand.append(el("span", "wordmark", "BIRPONG"), el("span", "chip", header.mode));
    const bar = el("header", "match__bar");
    const nav = el("nav", "match__nav");
    const rules = el("a", "btn", "Rules");
    rules.href = RULES_URL;
    rules.target = "_blank";
    rules.rel = "noreferrer";
    nav.append(rules, button("btn", "Leave match", header.onLeave));
    bar.append(brand, nav);

    const scores = el("div", "row");
    scores.append(parts.scoreA.root, parts.turn.root, parts.scoreB.root);
    const lower = el("div", "row");
    lower.append(parts.shotPanel.root, parts.log.root);

    const inner = el("div", "match__inner");
    inner.append(bar, scores, this.arena, lower);
    const page = el("div", "match");
    page.append(inner);
    root.replaceChildren(page);
  }
}
