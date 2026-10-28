import type { TurnView } from "../../match/viewModels";
import { el } from "../dom";

/** Whose turn it is, the state of the two balls, and a line of advice or news. */
export class TurnCard {
  readonly root = el("section", "card card--turn");

  constructor() {
    this.root.ariaLabel = "Turn";
  }

  update(view: TurnView): void {
    const head = el("div", "turn__head");
    head.append(el("span", "turn__title", view.title));

    if (view.balls) {
      const balls = el("div", "turn__balls");
      for (const ball of view.balls) {
        const item = el("span", `turn__ball turn__ball--${ball.kind}`);
        item.append(el("i"), document.createTextNode(ball.label));
        balls.append(item);
      }
      head.append(balls);
    }

    this.root.replaceChildren(head, el("p", undefined, view.text));
  }
}
