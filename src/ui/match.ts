import Phaser from "phaser";
import { TableScene, SCENE_H, SCENE_W, U } from "../game/TableScene";
import { initialState, reduce } from "../engine/reduce";
import { CUPS_PER_SIDE } from "../engine/rack";
import type { Rps, Shot, Side, State } from "../engine/types";
import { BOUNCE_WINDOW, resolveThrow, BALL_START, type Aim, type Contact } from "../throw/model";
import { createRng, type Rng } from "../throw/rng";

const NAMES: [string, string] = ["Player 1", "Player 2"];
const RPS: Rps[] = ["rock", "paper", "scissors"];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function mountMatch(root: HTMLElement, seed = Date.now()): void {
  const rng: Rng = createRng(seed);
  let state = newGame();
  let shot: Shot = "air";
  let dragPower = 0;
  let flying = false;
  let note = "";

  function newGame(): State {
    let s = initialState();
    while (s.phase === "rps") {
      const pick = () => rng.pick(RPS);
      s = reduce(s, { type: "rps", choices: [pick(), pick()] });
    }
    return s;
  }

  // --- DOM -------------------------------------------------------------
  root.replaceChildren();
  const page = el("div", "match");
  const inner = el("div", "match__inner");
  page.append(inner);
  root.append(page);

  const bar = el("header", "match__bar");
  const brand = el("div", "match__brand");
  brand.append(el("span", "wordmark", "BIRPONG"), el("span", "chip", "Hot-seat · 2 players"));
  const restart = el("button", "btn", "New match");
  restart.type = "button";
  bar.append(brand, restart);

  const cards = el("div", "row");
  const cardA = el("section", "card card--side");
  const cardTurn = el("section", "card card--turn");
  const cardB = el("section", "card card--side");
  cardA.ariaLabel = `${NAMES[0]} cups`;
  cardB.ariaLabel = `${NAMES[1]} cups`;
  cardTurn.ariaLabel = "Turn";
  cards.append(cardA, cardTurn, cardB);

  const arena = el("div", "arena");
  arena.setAttribute("role", "img");
  arena.ariaLabel = "Beer pong table seen from above. Drag back from the glowing ball to throw.";

  const lower = el("div", "row");
  const panel = el("section", "card card--panel");
  panel.ariaLabel = "Shot";
  const shots = el("div", "shots");
  const airBtn = shotButton("AIR", "1 cup, straight in");
  const bounceBtn = shotButton("BOUNCE", "2 cups, harder to land");
  shots.append(airBtn, bounceBtn);
  const power = el("div", "power");
  const powerHead = el("div", "power__head");
  const powerValue = el("span", "power__value", "0%");
  powerHead.append(el("span", "label", "Power"), powerValue);
  const barEl = el("div", "bar");
  const track = el("div", "bar__track");
  const fill = el("div", "bar__fill");
  track.append(fill);
  const windowEl = el("div", "bar__window");
  windowEl.style.left = `${BOUNCE_WINDOW[0] * 100}%`;
  windowEl.style.width = `${(BOUNCE_WINDOW[1] - BOUNCE_WINDOW[0]) * 100}%`;
  barEl.append(track, windowEl);
  const help = el("p");
  power.append(powerHead, barEl, help);
  panel.append(shots, power);

  const logCard = el("section", "card card--log log");
  logCard.ariaLabel = "Throw log";
  const logList = el("ol");
  logCard.append(el("h2", undefined, "Last throws"), logList);
  lower.append(panel, logCard);
  inner.append(bar, cards, arena, lower);

  function shotButton(name: string, desc: string): HTMLButtonElement {
    const b = el("button", "shot");
    b.type = "button";
    b.append(el("span", "shot__name", name), el("span", "shot__desc", desc));
    return b;
  }

  // --- Table scene (Phaser) -----------------------------------------------
  const scene = new TableScene({
    onAim(aim) {
      dragPower = aim ? aim.power : 0;
      panelUpdate();
    },
    onThrow(aim) {
      note = "";
      launch(aim);
    },
  });
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: arena,
    width: SCENE_W * U,
    height: SCENE_H * U,
    banner: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });

  function pushView() {
    scene.setView({ state, shot, canThrow: !flying && state.phase !== "over", labels: NAMES });
  }

  function dots(side: Side): HTMLElement {
    const wrap = el("div", "dots");
    const standing = state.cups[side].length;
    const hits = side === state.thrower ? 0 : state.pending.length;
    const items: string[] = [];
    for (let i = 0; i < CUPS_PER_SIDE; i++) {
      items.push(i < standing - hits ? "dot" : i < standing ? "dot dot--hit" : "dot dot--gone");
    }
    if (side === 1) items.reverse();
    for (const cls of items) wrap.append(el("span", cls));
    return wrap;
  }

  function sideCard(card: HTMLElement, side: Side) {
    const who = el("div", "who");
    const tag = el("span", side === 0 ? "tag" : "tag tag--b", side === 0 ? "P1" : "P2");
    const name = el("span", "who__name", NAMES[side]);
    who.append(...(side === 0 ? [tag, name] : [name, tag]));
    const left = el("div", side === 0 ? "stack" : "stack stack--end");
    left.append(who, dots(side));
    const count = el("div", "count");
    count.append(
      el("span", "count__n", String(state.cups[side].length)),
      el("span", "count__l", "cups left"),
    );
    card.replaceChildren(...(side === 0 ? [left, count] : [count, left]));
  }

  function turnCard() {
    const over = state.phase === "over";
    const title = over
      ? `${NAMES[state.winner!]} wins`.toUpperCase()
      : state.phase === "reroll"
        ? "LAST CHANCE"
        : state.suddenDeath
          ? "SUDDEN DEATH"
          : `${NAMES[state.thrower]}'s turn`.toUpperCase();
    const head = el("div", "turn__head");
    head.append(el("span", "turn__title", title));
    if (!over) {
      const balls = el("div", "turn__balls");
      const done = state.log.slice(state.log.length - state.ballsThrown);
      for (let i = 0; i < 2; i++) {
        const r = done[i];
        const cls = r
          ? r.hit
            ? "turn__ball turn__ball--hit"
            : "turn__ball turn__ball--miss"
          : i === state.ballsThrown
            ? "turn__ball turn__ball--now"
            : "turn__ball";
        const text = r
          ? r.hit
            ? `${i + 1} hit`
            : `${i + 1} miss`
          : i === state.ballsThrown
            ? `${i + 1} aiming`
            : `${i + 1}`;
        const b = el("span", cls);
        b.append(el("i"), document.createTextNode(text));
        balls.append(b);
      }
      head.append(balls);
    }
    const lines = [note || hint()];
    cardTurn.replaceChildren(head, ...lines.map((t) => el("p", undefined, t)));
    if (over) {
      const again = el("button", "btn btn--primary", "Play again");
      again.type = "button";
      again.addEventListener("click", reset);
      cardTurn.append(again);
    }
  }

  function hint(): string {
    if (state.phase === "reroll")
      return "One last turn. Clear the whole rack to force sudden death.";
    if (shot === "bounce") return "A bounce hit takes 2 cups. Land it inside the marked window.";
    return "Hit with both balls and both come back.";
  }

  function logCardUpdate() {
    logList.replaceChildren();
    for (const r of state.log.slice(-5).reverse()) {
      const li = el("li");
      const result = r.hit
        ? state.pending.length && r.turn === state.turn
          ? "hit, cup leaves at turn end"
          : "hit"
        : "miss";
      li.append(
        el("span", undefined, `T${r.turn}`),
        el("span", undefined, NAMES[r.side]),
        el("span", undefined, r.shot),
        el("span", undefined, result),
      );
      logList.append(li);
    }
  }

  function panelUpdate() {
    airBtn.ariaPressed = String(shot === "air");
    bounceBtn.ariaPressed = String(shot === "bounce");
    windowEl.style.display = shot === "bounce" ? "block" : "none";
    const p = dragPower;
    fill.style.width = `${p * 100}%`;
    powerValue.textContent = `${Math.round(p * 100)}%`;
    barEl.setAttribute("role", "img");
    barEl.ariaLabel = `Power ${Math.round(p * 100)} percent`;
    help.textContent =
      shot === "bounce"
        ? "A bounce only lands with the power inside the marked window. Too soft dies on the table, too hard clears the rack."
        : "Drag back from the ball to aim. Pull further for more power. Release to throw.";
  }

  function render() {
    sideCard(cardA, 0);
    sideCard(cardB, 1);
    turnCard();
    logCardUpdate();
    panelUpdate();
    pushView();
  }

  const other = (s: Side): Side => (s === 0 ? 1 : 0);

  airBtn.addEventListener("click", () => setShot("air"));
  bounceBtn.addEventListener("click", () => setShot("bounce"));
  function setShot(s: Shot) {
    shot = s;
    turnCard();
    panelUpdate();
    pushView();
  }
  restart.addEventListener("click", reset);
  function reset() {
    state = newGame();
    note = "";
    render();
  }

  // --- Throwing --------------------------------------------------------
  async function launch(aim: Aim) {
    const side = state.thrower;
    const defender = other(side);
    const thrown = shot;
    const result = resolveThrow(BALL_START[side], aim, thrown, defender, state.cups[defender], rng);
    flying = true;
    pushView();
    await scene.playFlight(side, result, thrown);
    flying = false;
    const before = state;
    state = reduce(state, { type: "throw", shot: thrown, target: result.target });
    note = [rimNote(result.contact), describe(before, state)].filter(Boolean).join(" ");
    render();
  }

  function rimNote(contact: Contact): string {
    if (contact === "rattle-in") return "Rattled in off the rim!";
    if (contact === "ricochet") return "Off the rim and into the next cup!";
    if (contact === "bounce-out") return "Off the rim, bounced out.";
    return "";
  }

  function describe(before: State, after: State): string {
    if (after.phase === "over") return "";
    if (after.phase === "reroll" && before.phase !== "reroll")
      return `${NAMES[before.thrower]} cleared the rack. ${NAMES[after.thrower]} gets one last turn.`;
    if (after.suddenDeath && !before.suddenDeath) return "Sudden death. New 3-cup racks.";
    if (after.thrower === before.thrower && after.ballsThrown === 0 && after.ballsBackUsed)
      return "Both balls hit. Balls back!";
    if (after.thrower !== before.thrower) {
      const left = after.cups[before.thrower === 0 ? 1 : 0].length;
      const lost = before.cups[before.thrower === 0 ? 1 : 0].length - left;
      return lost > 0
        ? `${NAMES[before.thrower]} sank ${lost} ${lost === 1 ? "cup" : "cups"}. ${left} left.`
        : `${NAMES[before.thrower]} missed.`;
    }
    return "";
  }

  render();
}
