import { aggregate } from "../../domain/stats";
import type { ProfileStore } from "../../storage/ProfileStore";
import type { StatsStore } from "../../storage/StatsStore";
import { createRackHeat } from "../../ui/components/RackHeat";
import { button, el } from "../../ui/dom";
import { statsView } from "../screenModels";
import type { Navigator, Screen } from "../types";

/** The player's stats on this device: totals, where hits land in the rack, recent matches. */
export class StatsScreen implements Screen {
  constructor(root: HTMLElement, nav: Navigator, profile: ProfileStore, stats: StatsStore) {
    const view = statsView(aggregate(stats.load()));
    const page = el("div", "page page--wide");

    const header = el("header", "topbar");
    header.append(
      el("span", "wordmark", "BIRPONG"),
      button("btn", "Home", () => nav.home()),
    );

    const who = el("div", "inline");
    who.append(
      el("h1", "display display--big", (profile.nickname() ?? "Your stats").toUpperCase()),
      el("span", "tag tag--guest", "GUEST"),
    );
    const note = el("p", "muted", "Stats are saved on this device only.");
    const top = el("div", "topbar topbar--top");
    top.append(who, note);

    const tabs = el("div", "inline");
    const mine = el("button", "segmented__item segmented__item--tab", "My stats");
    mine.ariaPressed = "true";
    const board = el("button", "segmented__item segmented__item--tab", "Records");
    board.disabled = true;
    tabs.append(mine, board);

    const tiles = el("div", "tiles");
    for (const tile of view.tiles) {
      const card = el("div", "card tile");
      card.append(el("span", "label", tile.label), el("span", "display display--big", tile.value));
      tiles.append(card);
    }

    page.append(header, top, tabs, tiles, this.panels(view));
    root.replaceChildren(page);
  }

  destroy(): void {}

  private panels(view: ReturnType<typeof statsView>): HTMLElement {
    const row = el("div", "grid grid--stats");

    const hits = el("section", "card card--panel-wide");
    hits.append(
      el("h2", "display", "WHERE YOU HIT"),
      el("p", "muted", "Share of your hits per cup, in percent. Your side is on the left."),
      createRackHeat(view.rack),
    );

    const recent = el("section", "card card--panel-wide");
    recent.append(el("h2", "display", "RECENT MATCHES"));
    if (view.empty) {
      recent.append(
        el("p", "muted", "No matches yet. Play one against the CPU and it will show up here."),
      );
    } else {
      const table = el("table", "table");
      const head = el("tr");
      for (const h of ["Date", "Opponent", "Mode", "Result", "Cups", "Hit rate"])
        head.append(el("th", undefined, h));
      const thead = el("thead");
      thead.append(head);
      table.append(thead);
      const body = el("tbody");
      for (const r of view.recent) {
        const tr = el("tr");
        const result = el("td", r.result === "W" ? "win" : "loss", r.result);
        tr.append(
          el("td", undefined, r.date),
          el("td", undefined, r.opponent),
          el("td", undefined, r.mode),
          result,
          el("td", undefined, r.cups),
          el("td", undefined, r.hitRate),
        );
        body.append(tr);
      }
      table.append(body);
      recent.append(table);
    }
    row.append(hits, recent);
    return row;
  }
}
