import type { CpuLevel } from "../../domain/cpu";
import { beats, initialState, reduce, type Rps, type Side } from "../../domain/engine";
import { createRng } from "../../domain/throw";
import { levelLabel } from "../../match/narration";
import { button, el } from "../../ui/dom";
import type { Navigator, Screen } from "../types";

const CHOICES: Rps[] = ["rock", "paper", "scissors"];

/** Rock, paper, scissors against the CPU, best of one; a tie is replayed. */
export class FirstThrowScreen implements Screen {
  private readonly rng = createRng(Date.now());
  private readonly choices = new Map<Rps, HTMLButtonElement>();
  private readonly cpuPick = el("div", "pick pick--cpu", "?");
  private readonly verdict = el("section", "card card--verdict");
  private locked = false;

  constructor(
    root: HTMLElement,
    private readonly nav: Navigator,
    private readonly level: CpuLevel,
    nickname: string,
  ) {
    const page = el("div", "page");
    const header = el("header", "topbar");
    const brand = el("div", "inline");
    brand.append(el("span", "wordmark", "BIRPONG"), el("span", "chip", `Solo · CPU ${this.level}`));
    header.append(
      brand,
      button("btn", "Back", () => nav.home()),
    );

    const you = el("section", "card");
    const youHead = el("div", "who");
    youHead.append(el("span", "tag", "YOU"), el("span", "who__name", nickname));
    const picks = el("div", "picks");
    for (const choice of CHOICES) {
      const b = button("pick", choice.toUpperCase(), () => this.play(choice));
      this.choices.set(choice, b);
      picks.append(b);
    }
    you.append(youHead, picks);

    const cpu = el("section", "card card--cpu");
    const cpuHead = el("div", "who");
    cpuHead.append(el("span", "tag tag--b", "CPU"), el("span", "who__name", levelLabel(level)));
    cpu.append(cpuHead, this.cpuPick);

    const row = el("div", "grid grid--rps");
    row.append(you, cpu);
    this.verdict.hidden = true;
    page.append(
      header,
      el("h1", "display", "WHO THROWS FIRST"),
      el("p", "muted", "Rock, paper, scissors. Best of one. A tie is replayed."),
      row,
      this.verdict,
    );
    root.replaceChildren(page);
  }

  destroy(): void {}

  private play(mine: Rps): void {
    if (this.locked) return;
    const theirs = this.rng.pick(CHOICES);
    for (const [choice, b] of this.choices) b.ariaPressed = String(choice === mine);
    this.cpuPick.textContent = theirs.toUpperCase();
    this.cpuPick.classList.add("pick--shown");

    const decided = reduce(initialState(), { type: "rps", choices: [mine, theirs] });
    if (decided.phase === "rps") return this.showTie();
    this.locked = true;
    this.showWinner(decided.first as Side, mine, theirs);
  }

  private showTie(): void {
    this.verdict.hidden = false;
    this.verdict.replaceChildren(
      el("h2", "display display--small", "TIE"),
      el("p", "muted", "Pick again."),
    );
  }

  private showWinner(first: Side, mine: Rps, theirs: Rps): void {
    const youFirst = first === 0;
    const [winning, losing] = youFirst ? [mine, theirs] : [theirs, mine];
    const reason = beats(winning, losing) ? `${winning} beats ${losing}` : "";
    const text = `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. ${youFirst ? "CPU gets" : "You get"} the re-roll at the end.`;

    const words = el("div", "stack");
    words.append(
      el(
        "h2",
        "display display--small display--accent",
        youFirst ? "YOU THROW FIRST" : "CPU THROWS FIRST",
      ),
      el("p", "muted", text),
    );
    this.verdict.hidden = false;
    this.verdict.replaceChildren(
      words,
      button("btn btn--primary", "START MATCH", () => this.nav.match(this.level, first)),
    );
  }
}
