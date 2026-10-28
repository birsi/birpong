import Phaser from "phaser";
import type { CpuLevel } from "../../domain/cpu";
import type { State } from "../../domain/engine";
import type { MatchRecord } from "../../domain/stats";
import { createGame } from "../../game/createGame";
import { TableScene } from "../../game/TableScene";
import { levelLabel } from "../../match/narration";
import { button, el } from "../../ui/dom";
import { resultView } from "../screenModels";
import type { Navigator, Screen } from "../types";

export interface ResultData {
  record: MatchRecord;
  /** The final state, drawn as the table. */
  state: State;
  nickname: string;
  level: CpuLevel;
}

/** Who won, the final table, and how each side did. */
export class ResultScreen implements Screen {
  private readonly game: Phaser.Game;

  constructor(
    root: HTMLElement,
    private readonly nav: Navigator,
    data: ResultData,
  ) {
    const view = resultView(data.record);
    const page = el("div", "page");

    const header = el("header", "topbar");
    header.append(
      el("span", "wordmark", "BIRPONG"),
      el("span", "chip", `Solo · CPU ${data.level}`),
    );

    const headline = el("div", "headline");
    headline.append(
      el("h1", `display display--big${view.won ? " display--accent" : ""}`, view.title),
    );
    const score = el("div", "count");
    score.append(el("span", "count__n", view.score), el("span", "count__l", "cups sunk"));
    headline.append(score);

    const arena = el("div", "arena");
    arena.setAttribute("role", "img");
    arena.ariaLabel = "The table at the end of the match";
    const scene = new TableScene({ onAim: () => {}, onThrow: () => {} });
    scene.setView({
      state: data.state,
      shot: "air",
      canThrow: false,
      names: ["You", "CPU"],
    });
    page.append(
      header,
      headline,
      arena,
      this.table(view, data.nickname, levelLabel(data.level)),
      this.actions(data),
    );
    root.replaceChildren(page);
    this.game = createGame(arena, scene);
  }

  destroy(): void {
    this.game.destroy(true);
  }

  private table(view: ReturnType<typeof resultView>, nickname: string, opponent: string) {
    const table = el("table", "table table--result");
    const head = el("tr");
    head.append(
      el("th", undefined, "Match"),
      el("th", "num", nickname),
      el("th", "num", `CPU ${opponent}`),
    );
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    for (const row of view.rows) {
      const tr = el("tr");
      tr.append(el("td", undefined, row.label), el("td", "num", row.you), el("td", "num", row.opp));
      body.append(tr);
    }
    table.append(body);
    return table;
  }

  private actions(data: ResultData): HTMLElement {
    const row = el("div", "topbar");
    row.append(el("span", "muted", "Saved to your stats on this device."));
    const buttons = el("div", "inline");
    buttons.append(
      button("btn", "Home", () => this.nav.home()),
      button("btn", "Stats", () => this.nav.stats()),
      button("btn btn--primary", "REMATCH", () => this.nav.firstThrow(data.level)),
    );
    row.append(buttons);
    return row;
  }
}
