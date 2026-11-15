import type { CpuLevel } from "../../domain/cpu";
import { beats, initialState, reduce, type Rps, type Side } from "../../domain/engine";
import { createRng } from "../../domain/throw";
import { levelLabel } from "../../match/narration";
import { RPS_CHOICES, RpsDuel } from "../../ui/components/RpsDuel";
import { button, el } from "../../ui/dom";
import type { Navigator, Screen } from "../types";

/** How long the CPU "thinks" before the countdown starts. */
const CPU_THINK_MS = 700;

/** Rock, paper, scissors against the CPU, best of one; a tie is replayed. */
export class FirstThrowScreen implements Screen {
  private readonly rng = createRng(Date.now());
  private readonly duel: RpsDuel;
  private readonly verdict = el("section", "card card--verdict");
  private locked = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

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

    this.duel = new RpsDuel({
      you: nickname,
      them: levelLabel(level),
      themTag: "CPU",
      onPick: (choice) => this.play(choice),
    });
    this.duel.setHint("Your move: pick rock, paper or scissors below.");
    this.duel.setEnabled(true);

    this.verdict.hidden = true;
    page.append(
      header,
      el("h1", "display", "WHO THROWS FIRST"),
      el(
        "p",
        "muted",
        "Rock beats scissors, scissors beats paper, paper beats rock. The winner throws first; a tie is replayed.",
      ),
      this.duel.element,
      this.verdict,
    );
    root.replaceChildren(page);
  }

  destroy(): void {
    this.duel.destroy();
    if (this.timer) clearTimeout(this.timer);
  }

  private play(mine: Rps): void {
    if (this.locked) return;
    this.locked = true;
    this.verdict.hidden = true;
    this.duel.setEnabled(false);
    this.duel.show(mine, false);
    this.duel.setHint(`You picked ${mine}. The CPU is choosing…`);

    this.timer = setTimeout(() => void this.settle(mine), CPU_THINK_MS);
  }

  private async settle(mine: Rps): Promise<void> {
    const theirs = this.rng.pick([...RPS_CHOICES]);
    const decided = reduce(initialState(), { type: "rps", choices: [mine, theirs] });
    const tie = decided.phase === "rps";
    const outcome = tie ? "tie" : decided.first === 0 ? "win" : "lose";
    this.duel.setHint("");
    if (!(await this.duel.reveal(mine, theirs, outcome))) return;

    if (tie) {
      this.locked = false;
      this.duel.setEnabled(true);
      this.duel.setHint(`Both picked ${mine}. Pick again.`);
      return this.showTie();
    }
    this.duel.setHint(`${mine} against ${theirs}.`);
    this.showWinner(decided.first as Side, mine, theirs);
  }

  private showTie(): void {
    this.verdict.hidden = false;
    this.verdict.replaceChildren(
      el("h2", "display display--small", "TIE"),
      el("p", "muted", "Same pick on both sides. Choose again to settle it."),
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
