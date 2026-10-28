import { CPU_LEVELS, type CpuLevel } from "../../domain/cpu";
import { levelLabel } from "../../match/narration";
import { isRoomCode, normalizeRoomCode } from "../../online/roomCode";
import { MAX_NICKNAME, checkNickname, type ProfileStore } from "../../storage/ProfileStore";
import { RULES_URL } from "../../ui/components/MatchPage";
import { createTableHero } from "../../ui/components/TableHero";
import { button, el } from "../../ui/dom";
import type { Navigator, Screen } from "../types";

const DEFAULT_LEVEL: CpuLevel = "medium";

export interface HomeOptions {
  /** Why the player is back here, e.g. a room that ended. */
  notice?: string;
  /** A room code from an invite link, waiting for the player to pick a name. */
  invite?: string;
}

type Lockable = HTMLButtonElement | HTMLInputElement;

/**
 * The start screen. A name comes first: nothing else can be used until the player has chosen one,
 * so nobody ends up playing as a nameless guest.
 */
export class HomeScreen implements Screen {
  private level: CpuLevel = DEFAULT_LEVEL;
  private readonly levelButtons = new Map<CpuLevel, HTMLButtonElement>();
  /** Everything that needs a name. */
  private readonly locked: Lockable[] = [];
  private readonly lockedCards: HTMLElement[] = [];
  private readonly nameCard = el("section", "card card--profile");
  private readonly nameLabel = el("span", "label");
  private readonly nameInput = el("input", "field field--name");
  private readonly nameHint = el("p", "hint");
  private readonly inviteButton: HTMLButtonElement | null;
  private updateJoin: () => void = () => {};

  constructor(
    root: HTMLElement,
    private readonly nav: Navigator,
    private readonly profile: ProfileStore,
    options: HomeOptions = {},
  ) {
    this.inviteButton = options.invite
      ? button("btn btn--primary", `JOIN ROOM ${options.invite}`, () =>
          this.nav.joinRoom(options.invite!),
        )
      : null;

    const page = el("div", "page");
    if (options.notice) {
      const banner = el("p", "notice", options.notice);
      banner.setAttribute("role", "status");
      page.append(banner);
    }
    page.append(
      el("h1", "display display--hero", "BIRPONG"),
      createTableHero(),
      this.profileCard(),
      this.modes(),
    );
    root.replaceChildren(page);
    this.renderLevels();
    this.refresh();
    if (!this.profile.nickname()) this.nameInput.focus();
  }

  destroy(): void {}

  // --- Name ---------------------------------------------------------------

  private profileCard(): HTMLElement {
    const input = this.nameInput;
    input.value = this.profile.nickname() ?? "";
    input.maxLength = MAX_NICKNAME + 4; // spaces are collapsed before the length check
    input.placeholder = "Your name";
    input.autocomplete = "username";
    input.ariaLabel = "Your name";
    // Valid names are saved as you type, which unlocks the rest of the screen.
    input.addEventListener("input", () => {
      this.profile.setNickname(input.value);
      this.refresh();
    });

    const who = el("div", "stack stack--grow");
    who.append(this.nameLabel, input, this.nameHint);

    const rules = el("a", "btn", "Rules");
    rules.href = RULES_URL;
    rules.target = "_blank";
    rules.rel = "noreferrer";
    const links = el("nav", "inline");
    if (this.inviteButton) links.append(this.inviteButton);
    links.append(
      button("btn", "Stats", () => this.nav.stats()),
      rules,
    );

    this.nameCard.append(who, links);
    return this.nameCard;
  }

  /** Show the name state and lock or unlock everything that needs a name. */
  private refresh(): void {
    const saved = this.profile.nickname();
    const typed = checkNickname(this.nameInput.value);
    const named = saved !== null;

    this.nameCard.classList.toggle("card--needed", !named);
    this.nameLabel.textContent = named ? "Playing as" : "Who are you?";
    this.nameHint.classList.toggle("hint--error", !typed.ok && this.nameInput.value.trim() !== "");

    if (typed.ok) {
      this.nameHint.textContent = "Saved. Stats are kept under this name on this device.";
    } else if (this.nameInput.value.trim() === "") {
      this.nameHint.textContent = "Pick a name to play. No guests.";
    } else {
      this.nameHint.textContent = typed.reason;
    }

    for (const item of this.locked) item.disabled = !named;
    for (const card of this.lockedCards) card.classList.toggle("card--locked", !named);
    this.updateJoin();
    if (this.inviteButton) this.inviteButton.disabled = !named;
  }

  // --- Modes --------------------------------------------------------------

  private modes(): HTMLElement {
    const row = el("div", "grid grid--2");
    row.append(this.soloCard(), this.onlineCard());
    return row;
  }

  private lock<T extends Lockable>(item: T): T {
    this.locked.push(item);
    return item;
  }

  private soloCard(): HTMLElement {
    const card = el("section", "card card--mode");
    this.lockedCards.push(card);
    const levels = el("div", "segmented");
    for (const level of CPU_LEVELS) {
      const b = this.lock(
        button("segmented__item", levelLabel(level), () => {
          this.level = level;
          this.renderLevels();
        }),
      );
      this.levelButtons.set(level, b);
      levels.append(b);
    }
    card.append(
      el("h2", "display", "SOLO"),
      el("p", "muted", "You against the CPU. You throw both balls."),
      el("span", "label", "CPU level"),
      levels,
      this.lock(
        button("btn btn--primary btn--block", "START MATCH", () => this.nav.firstThrow(this.level)),
      ),
    );
    return card;
  }

  private onlineCard(): HTMLElement {
    const card = el("section", "card card--mode");
    this.lockedCards.push(card);
    const code = this.lock(el("input", "field field--code"));
    code.placeholder = "K7QM";
    code.maxLength = 8;
    code.autocomplete = "off";
    code.ariaLabel = "Room code";
    const join = el("button", "btn", "JOIN");
    const submit = () => {
      if (isRoomCode(code.value)) this.nav.joinRoom(code.value);
    };
    this.updateJoin = () => {
      join.disabled = code.disabled || !isRoomCode(code.value);
    };
    code.addEventListener("input", () => {
      code.value = normalizeRoomCode(code.value);
      this.updateJoin();
    });
    code.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    join.addEventListener("click", submit);
    const joinRow = el("div", "inline");
    joinRow.append(code, join);
    card.append(
      el("h2", "display", "ONLINE"),
      el("p", "muted", "One on one. Share a room code, no account needed."),
      el("span", "label", "Room code"),
      joinRow,
      this.lock(button("btn btn--primary btn--block", "CREATE ROOM", () => this.nav.createRoom())),
    );
    return card;
  }

  private renderLevels(): void {
    for (const [level, b] of this.levelButtons) b.ariaPressed = String(level === this.level);
  }
}
