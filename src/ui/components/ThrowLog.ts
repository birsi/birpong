import type { LogRow } from "../../match/viewModels";
import { el } from "../dom";

/** The most recent throws, newest first. */
export class ThrowLog {
  readonly root = el("section", "card card--log log");
  private readonly list = el("ol");

  constructor() {
    this.root.ariaLabel = "Throw log";
    this.root.append(el("h2", undefined, "Last throws"), this.list);
  }

  update(rows: LogRow[]): void {
    this.list.replaceChildren(
      ...rows.map((row) => {
        const item = el("li");
        item.append(
          el("span", undefined, row.turn),
          el("span", undefined, row.who),
          el("span", undefined, row.shot),
          el("span", undefined, row.result),
        );
        return item;
      }),
    );
  }
}
