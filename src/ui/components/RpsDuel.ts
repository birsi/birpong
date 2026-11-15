import type { Rps } from "../../domain/engine";
import { button, el } from "../dom";

export const RPS_CHOICES: readonly Rps[] = ["rock", "paper", "scissors"];

const GLYPH: Record<Rps, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const UNKNOWN = "?";

/** One beat of the countdown; the hands pump once per beat. Matches `rps-pump` in the styles. */
const BEAT_MS = 420;
const COUNTDOWN = ["ROCK", "PAPER", "SCISSORS"];
const POP_MS = 450;
const RESULT_MS = 500;

/** How the duel ended, seen from the local player. */
export type RpsOutcome = "win" | "lose" | "tie";

export interface RpsDuelOptions {
  you: string;
  them: string;
  /** The other side's tag, e.g. CPU. */
  themTag?: string;
  onPick: (choice: Rps) => void;
}

interface Side {
  root: HTMLElement;
  hand: HTMLElement;
  glyph: HTMLElement;
  badge: HTMLElement;
  name: HTMLElement;
}

/** Show a hand, or the "?" while it is unknown. Only hands are marked, so only they get mirrored. */
function setGlyph(side: Side, choice: Rps | null): void {
  side.glyph.textContent = choice ? GLYPH[choice] : UNKNOWN;
  side.glyph.classList.toggle("rps__glyph--hand", choice !== null);
}

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Rock, paper, scissors as a little face-off: a hint, both hands, and the three picks. The screen
 * says what state the round is in; the duel draws it and plays the countdown and reveal.
 */
export class RpsDuel {
  readonly element = el("section", "card rps");
  private readonly hint = el("p", "rps__hint");
  private readonly call = el("div", "rps__call", "VS");
  private readonly you: Side;
  private readonly them: Side;
  private readonly picks = new Map<Rps, HTMLButtonElement>();
  /** Bumped to cancel a reveal that is still playing. */
  private run = 0;

  constructor({ you, them, themTag = "OPP", onPick }: RpsDuelOptions) {
    this.hint.setAttribute("role", "status");
    this.you = this.side(you, "YOU", "tag", false);
    this.them = this.side(them, themTag, "tag tag--b", true);

    const stage = el("div", "rps__stage");
    stage.append(this.you.root, this.call, this.them.root);

    const picks = el("div", "picks rps__picks");
    RPS_CHOICES.forEach((choice, i) => {
      const b = button("pick rps__pick", "", () => onPick(choice));
      b.style.setProperty("--i", String(i));
      b.append(
        el("span", "rps__pick-glyph", GLYPH[choice]),
        el("span", "rps__pick-label", choice.toUpperCase()),
      );
      this.picks.set(choice, b);
      picks.append(b);
    });

    this.element.append(this.hint, stage, picks);
    this.show(null, false);
  }

  /** Stop any reveal that is still playing. */
  destroy(): void {
    this.run++;
  }

  /** The other side's name, e.g. once an online opponent has joined. */
  setName(name: string): void {
    this.them.name.textContent = name;
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  /** Whether the pick buttons can be used. While they can, they pulse to ask for a pick. */
  setEnabled(enabled: boolean): void {
    for (const b of this.picks.values()) b.disabled = !enabled;
    this.element.classList.toggle("rps--your-move", enabled);
  }

  /**
   * The round before the reveal: your pick if you have made one, and whether the other side has
   * picked yet. Their pick stays hidden until `reveal`.
   */
  show(mine: Rps | null, theirsReady: boolean): void {
    this.run++;
    this.clearResult();
    this.call.textContent = "VS";
    for (const [choice, b] of this.picks) b.ariaPressed = String(choice === mine);

    setGlyph(this.you, mine);
    this.you.hand.classList.toggle("rps__hand--empty", !mine);
    this.you.hand.classList.toggle("rps__hand--locked", !!mine);

    setGlyph(this.them, null);
    this.them.hand.classList.toggle("rps__hand--thinking", !theirsReady);
    this.them.hand.classList.toggle("rps__hand--locked", theirsReady);
    this.them.badge.textContent = theirsReady ? "READY" : "";
  }

  /**
   * Count down, show both hands and mark the winner. Resolves to false if it was cut short by
   * `show` or `destroy`, so the caller knows not to carry on.
   */
  async reveal(mine: Rps, theirs: Rps, outcome: RpsOutcome): Promise<boolean> {
    const id = ++this.run;
    const alive = () => id === this.run && this.element.isConnected;
    const wait = (ms: number) =>
      new Promise<boolean>((resolve) => setTimeout(() => resolve(alive()), ms));
    for (const b of this.picks.values()) b.ariaPressed = String(b === this.picks.get(mine));
    this.clearResult();
    const hands = [this.you.hand, this.them.hand];

    if (!reducedMotion()) {
      setGlyph(this.you, "rock");
      setGlyph(this.them, "rock");
      for (const hand of hands) {
        hand.classList.remove("rps__hand--thinking", "rps__hand--empty");
        hand.classList.add("rps__hand--pump");
      }
      this.them.badge.textContent = "";
      for (const word of COUNTDOWN) {
        this.setCall(word);
        if (!(await wait(BEAT_MS))) return false;
      }
      for (const hand of hands) hand.classList.remove("rps__hand--pump");
      this.setCall("SHOOT!");
    }

    setGlyph(this.you, mine);
    setGlyph(this.them, theirs);
    for (const hand of hands) {
      hand.classList.remove("rps__hand--thinking", "rps__hand--empty", "rps__hand--locked");
      hand.classList.add("rps__hand--pop");
    }
    if (!reducedMotion() && !(await wait(POP_MS))) return false;

    if (outcome === "tie") {
      this.setCall("TIE");
      for (const hand of hands) hand.classList.add("rps__hand--tie");
    } else {
      const [winner, loser] = outcome === "win" ? [this.you, this.them] : [this.them, this.you];
      winner.hand.classList.add("rps__hand--win");
      winner.badge.textContent = "WINS";
      loser.hand.classList.add("rps__hand--lose");
      this.setCall("VS");
    }
    return reducedMotion() || wait(RESULT_MS);
  }

  private side(name: string, tag: string, tagClass: string, mirrored: boolean): Side {
    const root = el("div", mirrored ? "rps__side rps__side--them" : "rps__side");
    const hand = el("div", "rps__hand");
    const glyph = el("span", "rps__glyph", UNKNOWN);
    hand.append(glyph);
    const label = el("div", "who rps__who");
    const nameEl = el("span", "who__name", name);
    label.append(el("span", tagClass, tag), nameEl);
    const badge = el("span", "rps__badge");
    root.append(label, hand, badge);
    return { root, hand, glyph, badge, name: nameEl };
  }

  /** Change the word in the middle, replaying its pop. */
  private setCall(text: string): void {
    this.call.textContent = text;
    this.call.classList.remove("rps__call--beat");
    void this.call.offsetWidth; // restart the animation
    this.call.classList.add("rps__call--beat");
  }

  private clearResult(): void {
    for (const side of [this.you, this.them]) {
      side.hand.classList.remove(
        "rps__hand--pump",
        "rps__hand--pop",
        "rps__hand--win",
        "rps__hand--lose",
        "rps__hand--tie",
      );
      side.badge.textContent = "";
    }
    this.call.classList.remove("rps__call--beat");
  }
}
