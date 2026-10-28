import { CPU_LEVELS, type CpuLevel } from "../../domain/cpu";
import { levelLabel } from "../../match/narration";
import { isRoomCode, normalizeRoomCode } from "../../online/roomCode";
import type { ProfileStore } from "../../storage/ProfileStore";
import { MAX_NICKNAME } from "../../storage/ProfileStore";
import { RULES_URL } from "../../ui/components/MatchPage";
import { createTableHero } from "../../ui/components/TableHero";
import { button, el } from "../../ui/dom";
import type { Navigator, Screen } from "../types";

const DEFAULT_LEVEL: CpuLevel = "medium";

/** Mode select: solo against the CPU, a nickname, and links to stats and rules. */
export class HomeScreen implements Screen {
  private level: CpuLevel = DEFAULT_LEVEL;
  private readonly levelButtons = new Map<CpuLevel, HTMLButtonElement>();

  constructor(
    root: HTMLElement,
    private readonly nav: Navigator,
    private readonly profile: ProfileStore,
    notice?: string,
  ) {
    const page = el("div", "page");
    if (notice) {
      const banner = el("p", "notice", notice);
      banner.setAttribute("role", "status");
      page.append(banner);
    }
    page.append(
      el("h1", "display display--hero", "BIRPONG"),
      createTableHero(),
      el(
        "p",
        "lead",
        "Beer pong from above. Ten cups, two balls per turn, Beer Pong Austria rules.",
      ),
      this.modes(),
      this.profileBar(),
    );
    root.replaceChildren(page);
    this.renderLevels();
  }

  destroy(): void {}

  private modes(): HTMLElement {
    const row = el("div", "grid grid--2");
    row.append(this.soloCard(), this.onlineCard());
    return row;
  }

  private soloCard(): HTMLElement {
    const card = el("section", "card card--mode");
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
    const card = el("section", "card card--mode");
    const code = el("input", "field field--code");
    code.placeholder = "K7QM";
    code.maxLength = 8;
    code.autocomplete = "off";
    code.ariaLabel = "Room code";
    const join = el("button", "btn", "JOIN");
    join.disabled = true;
    const submit = () => {
      if (isRoomCode(code.value)) this.nav.joinRoom(code.value);
    };
    code.addEventListener("input", () => {
      code.value = normalizeRoomCode(code.value);
      join.disabled = !isRoomCode(code.value);
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

  private profileBar(): HTMLElement {
    const bar = el("section", "card card--profile");
    const input = el("input", "field field--name");
    input.value = this.profile.nickname();
    input.maxLength = MAX_NICKNAME;
    input.ariaLabel = "Nickname";
    input.addEventListener("change", () => {
      this.profile.setNickname(input.value);
      input.value = this.profile.nickname();
    });
    const who = el("div", "stack");
    const nameRow = el("div", "inline");
    nameRow.append(input, el("span", "tag tag--guest", "GUEST"));
    who.append(
      el("span", "label", "Playing as"),
      nameRow,
      el("p", "muted", "Stats are saved on this device only."),
    );

    const rules = el("a", "btn", "Rules");
    rules.href = RULES_URL;
    rules.target = "_blank";
    rules.rel = "noreferrer";
    const links = el("nav", "inline");
    links.append(
      button("btn", "Stats", () => this.nav.stats()),
      rules,
    );
    bar.append(who, links);
    return bar;
  }

  private renderLevels(): void {
    for (const [level, b] of this.levelButtons) b.ariaPressed = String(level === this.level);
  }
}
