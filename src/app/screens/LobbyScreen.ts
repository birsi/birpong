import type { Rps } from "../../domain/engine";
import { inviteLink } from "../../online/roomCode";
import type { OnlineSession } from "../../online/OnlineSession";
import { button, el } from "../../ui/dom";
import type { Navigator, Screen } from "../types";

const CHOICES: Rps[] = ["rock", "paper", "scissors"];
/** A guest that hears nothing from the host for this long gives up. */
const JOIN_TIMEOUT_MS = 12_000;

const MATCH_RULES: [string, string][] = [
  ["Cups", "10 each, pyramid 4-3-2-1"],
  ["Turn", "2 balls, both yours"],
  ["Balls back", "both hit, once per turn"],
  ["Bounce", "2 cups, harder to land"],
  ["Re-rack", "at 6, 3 and 1 cups"],
  ["Re-roll", "second thrower gets a last turn"],
];

/** An online room before the match: who is here, rock, paper, scissors, and the rules. */
export class LobbyScreen implements Screen {
  private readonly seats = el("div", "grid grid--2");
  private readonly picks = new Map<Rps, HTMLButtonElement>();
  private readonly status = el("p", "muted");
  private readonly start = button("btn btn--primary btn--block", "START MATCH", () =>
    this.session.start(),
  );
  private readonly off: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    root: HTMLElement,
    private readonly nav: Navigator,
    private readonly session: OnlineSession,
    private readonly code: string,
  ) {
    const page = el("div", "page");
    const header = el("header", "topbar");
    const brand = el("div", "inline");
    brand.append(el("span", "wordmark", "BIRPONG"), el("span", "chip", "Online · 1 v 1"));
    header.append(
      brand,
      button("btn", "Leave room", () => nav.home()),
    );

    page.append(header, this.codeCard(), this.seats, this.panels(), this.start);
    root.replaceChildren(page);

    this.off.push(
      session.changed.on(() => this.render()),
      session.started.on((first) => nav.startOnline(first)),
    );
    this.render();

    // A guest that never reaches the host: wrong code, or a network WebRTC cannot cross.
    if (session.role === "guest") {
      this.timer = setTimeout(() => {
        if (session.status === "waiting")
          nav.home("Could not find that room. Check the code or try again.");
      }, JOIN_TIMEOUT_MS);
    }
  }

  destroy(): void {
    for (const off of this.off) off();
    if (this.timer) clearTimeout(this.timer);
  }

  private codeCard(): HTMLElement {
    const link = inviteLink(location.origin, this.code);
    const card = el("section", "card card--code");
    const left = el("div", "stack");
    left.append(el("span", "label", "Room code"), el("p", "display display--code", this.code));

    const right = el("div", "stack");
    const copy = button("btn btn--block", "COPY INVITE LINK", () => {
      void navigator.clipboard?.writeText(link).then(
        () => (copy.textContent = "COPIED"),
        () => (copy.textContent = "COPY FAILED"),
      );
    });
    right.append(el("p", "muted link", link), copy);
    card.append(left, right);
    return card;
  }

  private panels(): HTMLElement {
    const row = el("div", "grid grid--2");

    const first = el("section", "card card--panel-wide");
    const picks = el("div", "picks");
    for (const choice of CHOICES) {
      const b = button("pick", choice.toUpperCase(), () => this.session.pickRps(choice));
      this.picks.set(choice, b);
      picks.append(b);
    }
    first.append(
      el("h2", "display", "WHO THROWS FIRST"),
      el("p", "muted", "Rock, paper, scissors. Best of one."),
      picks,
      this.status,
    );

    const rules = el("section", "card card--panel-wide");
    const list = el("dl", "rules");
    for (const [name, text] of MATCH_RULES) {
      list.append(el("dt", undefined, name), el("dd", undefined, text));
    }
    rules.append(el("h2", "display", "MATCH RULES"), list);

    row.append(first, rules);
    return row;
  }

  private seat(tag: string, name: string, role: string, state: string, mine: boolean): HTMLElement {
    const seat = el("section", "card seat");
    const who = el("div", "who");
    who.append(el("span", mine ? "tag" : "tag tag--b", tag), el("span", "who__name", name));
    who.append(el("span", "muted", role));
    seat.append(who, el("span", "seat__state", state));
    return seat;
  }

  private render(): void {
    const { session } = this;
    if (session.status === "closed") return this.nav.home("The other player left the room.");
    if (session.status === "full") return this.nav.home("That room is full.");

    const hostRole = session.role === "host";
    const opponent = session.opponentName;
    this.seats.replaceChildren(
      this.seat("YOU", session.nickname, hostRole ? "host" : "guest", "READY", true),
      opponent
        ? this.seat("OPP", opponent, hostRole ? "guest" : "host", "JOINED", false)
        : this.seat("OPP", "Waiting for a player…", "", "", false),
    );

    const { mine, theirs, first } = session.rps;
    const connected = session.status === "connected";
    for (const [choice, b] of this.picks) {
      b.ariaPressed = String(choice === mine);
      b.disabled = !connected || first !== null;
    }

    this.status.textContent = this.rpsMessage(connected, mine, theirs, first);
    this.start.hidden = false;
    if (session.role === "host") {
      this.start.disabled = first === null || !connected;
      this.start.textContent = "START MATCH";
    } else {
      this.start.disabled = true;
      this.start.textContent =
        first === null ? "WAITING FOR THE FIRST THROW" : "WAITING FOR THE HOST TO START";
    }
  }

  private rpsMessage(
    connected: boolean,
    mine: Rps | null,
    theirs: Rps | null,
    first: 0 | 1 | null,
  ): string {
    const name = this.session.opponentName ?? "the other player";
    if (!connected) return "Waiting for the other player to join.";
    if (first !== null) {
      const youFirst = first === this.session.localSide;
      return `${mine} against ${theirs}: ${youFirst ? "you throw" : `${name} throws`} first.`;
    }
    if (mine !== null && theirs !== null) return `Both picked ${mine}. Tie, pick again.`;
    if (mine !== null) return `You picked ${mine}. Waiting for ${name}.`;
    if (theirs !== null) return `${name} has picked. Your turn.`;
    return "Pick rock, paper or scissors.";
  }
}
