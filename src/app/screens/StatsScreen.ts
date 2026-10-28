import { aggregate, recordsByOpponent } from "../../domain/stats";
import type { ProfileStore } from "../../storage/ProfileStore";
import type { StatsStore } from "../../storage/StatsStore";
import { createRackHeat } from "../../ui/components/RackHeat";
import { button, el } from "../../ui/dom";
import { recordsView, statsView, type RecordsRow } from "../screenModels";
import type { Navigator, Screen } from "../types";

/**
 * The player's stats on this device. Two tabs: "My stats" (totals, where hits land, recent
 * matches) and "Records", the local leaderboard with one row per opponent.
 */
export class StatsScreen implements Screen {
  constructor(root: HTMLElement, nav: Navigator, profile: ProfileStore, stats: StatsStore) {
    const matches = stats.load();
    const view = statsView(aggregate(matches));
    const records = recordsView(recordsByOpponent(matches));
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

    const tiles = el("div", "tiles");
    for (const tile of view.tiles) {
      const card = el("div", "card tile");
      card.append(el("span", "label", tile.label), el("span", "display display--big", tile.value));
      tiles.append(card);
    }
    const mineView = el("div", "stats-section");
    mineView.append(tiles, this.panels(view));
    const recordsPanelEl = this.recordsPanel(records);

    const tabs = el("div", "inline");
    const mine = el("button", "segmented__item segmented__item--tab", "My stats");
    const board = el("button", "segmented__item segmented__item--tab", "Records");
    const show = (tab: "mine" | "records") => {
      mineView.hidden = tab !== "mine";
      recordsPanelEl.hidden = tab !== "records";
      mine.ariaPressed = String(tab === "mine");
      board.ariaPressed = String(tab === "records");
    };
    mine.addEventListener("click", () => show("mine"));
    board.addEventListener("click", () => show("records"));
    tabs.append(mine, board);
    show("mine");

    page.append(header, top, tabs, mineView, recordsPanelEl);
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

  /** The local leaderboard: how you have done against each CPU level and each online opponent. */
  private recordsPanel(rows: readonly RecordsRow[]): HTMLElement {
    const panel = el("section", "card card--panel-wide stats-section");
    panel.append(
      el("h2", "display", "RECORDS PER OPPONENT"),
      el("p", "muted", "How you have done against each opponent you have met, on this device."),
    );
    if (rows.length === 0) {
      panel.append(
        el("p", "muted", "No records yet. Finish a match and your opponent will show up here."),
      );
      return panel;
    }

    const table = el("table", "table");
    const head = el("tr");
    for (const h of ["Opponent", "Mode", "Played", "Won", "Lost", "Win rate", "Last played"]) {
      head.append(el("th", undefined, h));
    }
    const thead = el("thead");
    thead.append(head);
    table.append(thead);

    const body = el("tbody");
    for (const r of rows) {
      const bar = el("span", "meter");
      const fill = el("i");
      fill.style.width = `${Math.round(r.winShare * 100)}%`;
      bar.append(fill);
      const rateBox = el("div", "rate");
      rateBox.append(el("span", undefined, r.winRate), bar);
      const rate = el("td");
      rate.append(rateBox);

      const tr = el("tr");
      tr.append(
        el("td", "who__name", r.opponent),
        el("td", undefined, r.mode),
        el("td", undefined, String(r.played)),
        el("td", "win", String(r.won)),
        el("td", "loss", String(r.lost)),
        rate,
        el("td", undefined, r.lastPlayed),
      );
      body.append(tr);
    }
    table.append(body);
    panel.append(table);
    return panel;
  }
}
