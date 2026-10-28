import type { ScoreView } from "../../match/viewModels";
import { el } from "../dom";

/** One player's name, cup dots and cup count. Side 0 reads left to right, side 1 mirrored. */
export class ScoreCard {
  readonly root = el("section", "card card--side");

  constructor(label: string) {
    this.root.ariaLabel = label;
  }

  update(view: ScoreView): void {
    const mirrored = view.side === 1;

    const who = el("div", "who");
    const tag = el("span", view.mine ? "tag" : "tag tag--b", view.tag);
    const name = el("span", "who__name", view.name);
    who.append(...(mirrored ? [name, tag] : [tag, name]));

    const dots = el("div", "dots");
    const kinds = mirrored ? [...view.dots].reverse() : view.dots;
    for (const kind of kinds) {
      dots.append(el("span", kind === "standing" ? "dot" : `dot dot--${kind}`));
    }

    const identity = el("div", mirrored ? "stack stack--end" : "stack");
    identity.append(who, dots);

    const count = el("div", "count");
    count.append(
      el("span", "count__n", String(view.standing)),
      el("span", "count__l", "cups left"),
    );

    this.root.replaceChildren(...(mirrored ? [count, identity] : [identity, count]));
  }
}
