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

/**
 * The start screen. A name comes first: nothing else can be used until the player has chosen one,
 * so nobody ends up playing as a nameless guest.
 */
export class HomeScreen implements Screen {
  private level: CpuLevel = DEFAULT_LEVEL;
  private readonly levelButtons = new Map<CpuLevel, HTMLButtonElement>();
  /** The cards that need a name. */
  private readonly lockedCards: HTMLElement[] = [];
  private readonly nameCard = el("section", "card card--profile");
  private readonly nameLabel = el("span", "label");
  private readonly nameInput = el("input", "field field--name");
  private readonly nameHint = el("p", "hint");
  private readonly inviteButton: HTMLButtonElement | null;
  /** Set once the player has tried to go on, or typed, without a valid name: errors show then. */
  private attempted = false;
  private updateJoin: () => void = () => {};

  constructor(
    root: HTMLElement,
    private readonly nav: Navigator,
    private readonly profile: ProfileStore,
    options: HomeOptions = {},
  ) {
    this.inviteButton = options.invite
      ? button("btn btn--primary", `JOIN ROOM ${options.invite}`, () => {
          if (this.named) this.nav.joinRoom(options.invite!);
          else this.demandName();
        })
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
      this.attempted = true;
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

  private get named(): boolean {
    return this.profile.nickname() !== null;
  }

  /** The player tried to go on without a name: say so and put the cursor in the name field. */
  private demandName(): void {
    this.attempted = true;
    this.refresh();
    this.nameInput.focus();
    this.nameCard.classList.remove("card--shake");
    void this.nameCard.offsetWidth; // restart the animation
    this.nameCard.classList.add("card--shake");
  }

  /** Show the name state and mark the cards that need a name as locked. */
  private refresh(): void {
    const typed = checkNickname(this.nameInput.value);
    const named = this.named;
    const showError = !typed.ok && this.attempted;

    this.nameCard.classList.toggle("card--needed", !named);
    this.nameLabel.textContent = named ? "Playing as" : "Who are you?";
    this.nameInput.classList.toggle("field--invalid", showError);
    this.nameInput.setAttribute("aria-invalid", String(showError));
    this.nameHint.classList.toggle("hint--error", showError);
    this.nameHint.setAttribute("role", showError ? "alert" : "status");

    if (typed.ok)
      this.nameHint.textContent = "Saved. Stats are kept under this name on this device.";
    else if (showError) this.nameHint.textContent = typed.reason;
    else this.nameHint.textContent = "Pick a name to play. No guests.";

    for (const card of this.lockedCards) card.classList.toggle("card--locked", !named);
    this.updateJoin();
  }

  // --- Modes --------------------------------------------------------------

  private modes(): HTMLElement {
    const row = el("div", "grid grid--2");
    row.append(this.soloCard(), this.onlineCard());
    return row;
  }

  /**
   * Without a name nothing in a card works: any click or focus inside it asks for the name
   * instead. (Disabled buttons would just ignore the click and leave the player guessing.)
   */
  private needsName(card: HTMLElement): HTMLElement {
    this.lockedCards.push(card);
    card.addEventListener(
      "click",
      (e) => {
        if (this.named) return;
        e.preventDefault();
        e.stopPropagation();
        this.demandName();
      },
      true,
    );
    card.addEventListener("focusin", () => {
      if (!this.named) this.demandName();
    });
    return card;
  }

  private soloCard(): HTMLElement {
    const card = this.needsName(el("section", "card card--mode"));
    const levels = el("div", "segmented");
    for (const level of CPU_LEVELS) {
      const b = button("segmented__item", levelLabel(level), () => {
        this.level = level;
        this.renderLevels();
      });
      this.levelButtons.set(level, b);
      levels.append(b);
    }
    card.append(
      el("h2", "display", "SOLO"),
      el("p", "muted", "You against the CPU. You throw both balls."),
      el("span", "label", "CPU level"),
      levels,
      button("btn btn--primary btn--block", "START MATCH", () => this.nav.firstThrow(this.level)),
    );
    return card;
  }

  private onlineCard(): HTMLElement {
    const card = this.needsName(el("section", "card card--mode"));
    const code = el("input", "field field--code");
    code.placeholder = "K7QM";
    code.maxLength = 8;
    code.autocomplete = "off";
    code.ariaLabel = "Room code";
    const join = el("button", "btn", "JOIN");
    const submit = () => {
      if (isRoomCode(code.value)) this.nav.joinRoom(code.value);
    };
    this.updateJoin = () => {
      // Without a name the button stays clickable so it can ask for one.
      join.disabled = this.named && !isRoomCode(code.value);
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
      button("btn btn--primary btn--block", "CREATE ROOM", () => this.nav.createRoom()),
    );
    return card;
  }

  private renderLevels(): void {
    for (const [level, b] of this.levelButtons) b.ariaPressed = String(level === this.level);
  }
}
