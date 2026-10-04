import { initialState, reduce } from "../engine/reduce";
import { CUPS_PER_SIDE } from "../engine/rack";
import type { Rps, Shot, Side, State } from "../engine/types";
import { draw, fromScene, SCENE_H, SCENE_W, type AimView, type SceneView } from "../render/scene";
import {
  BALL_START,
  BOUNCE_WINDOW,
  MIN_POWER,
  aimFromPull,
  findCup,
  nominalLanding,
  resolveThrow,
  touchdown,
  type Aim,
  type Point,
} from "../throw/model";
import { mulberry32, type Rng } from "../throw/rng";

const NAMES: [string, string] = ["Player 1", "Player 2"];
const GRAB_RADIUS = 16; // cm around the ball where a drag may start
const FLIGHT_MS = 650;
const RPS: Rps[] = ["rock", "paper", "scissors"];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function mountMatch(root: HTMLElement, seed = Date.now()): void {
  const rng: Rng = mulberry32(seed);
  let state = newGame();
  let shot: Shot = "air";
  let drag: { aim: Aim } | null = null;
  let flight: { pos: Point; scale: number } | null = null;
  let note = "";

  function newGame(): State {
    let s = initialState();
    while (s.phase === "rps") {
      const pick = () => RPS[Math.floor(rng() * 3)]!;
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
  const canvas = el("canvas");
  canvas.setAttribute("role", "img");
  canvas.ariaLabel = "Beer pong table seen from above. Drag back from the glowing ball to throw.";
  arena.append(canvas);

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

  // --- Rendering -------------------------------------------------------
  const ctx = canvas.getContext("2d")!;

  function paintCanvas() {
    const w = arena.clientWidth;
    const h = (w * SCENE_H) / SCENE_W;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, view());
  }

  function view(): SceneView {
    let aim: AimView | null = null;
    if (drag && state.phase !== "over") {
      const side = state.thrower;
      const ball = BALL_START[side];
      const defender = other(side);
      const landing = nominalLanding(ball, drag.aim);
      aim = {
        side,
        ball,
        handle: drag.aim.handle,
        landing,
        shot,
        touchdown: touchdown(ball, landing),
        targetCup: findCup(defender, state.cups[defender], landing),
      };
    }
    return {
      state,
      balls: [
        { side: 0, pos: BALL_START[0] },
        { side: 1, pos: BALL_START[1] },
      ],
      aim,
      flight,
      labels: NAMES,
    };
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
    count.append(el("span", "count__n", String(state.cups[side].length)), el("span", "count__l", "cups left"));
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
        const cls = r ? (r.hit ? "turn__ball turn__ball--hit" : "turn__ball turn__ball--miss") : i === state.ballsThrown ? "turn__ball turn__ball--now" : "turn__ball";
        const text = r ? (r.hit ? `${i + 1} hit` : `${i + 1} miss`) : i === state.ballsThrown ? `${i + 1} aiming` : `${i + 1}`;
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
    if (state.phase === "reroll") return "One last turn. Clear the whole rack to force sudden death.";
    if (shot === "bounce") return "A bounce hit takes 2 cups. Land it inside the marked window.";
    return "Hit with both balls and both come back.";
  }

  function logCardUpdate() {
    logList.replaceChildren();
    for (const r of state.log.slice(-5).reverse()) {
      const li = el("li");
      const result = r.hit ? (state.pending.length && r.turn === state.turn ? "hit, cup leaves at turn end" : "hit") : "miss";
      li.append(el("span", undefined, `T${r.turn}`), el("span", undefined, NAMES[r.side]), el("span", undefined, r.shot), el("span", undefined, result));
      logList.append(li);
    }
  }

  function panelUpdate() {
    airBtn.ariaPressed = String(shot === "air");
    bounceBtn.ariaPressed = String(shot === "bounce");
    windowEl.style.display = shot === "bounce" ? "block" : "none";
    const p = drag ? drag.aim.power : 0;
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
    paintCanvas();
  }

  // --- Input -----------------------------------------------------------
  const other = (s: Side): Side => (s === 0 ? 1 : 0);

  function pointerCm(e: PointerEvent): Point {
    const r = canvas.getBoundingClientRect();
    return fromScene({
      x: ((e.clientX - r.left) / r.width) * SCENE_W,
      y: ((e.clientY - r.top) / r.height) * SCENE_H,
    });
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (flight || state.phase === "over") return;
    const p = pointerCm(e);
    const ball = BALL_START[state.thrower];
    if (Math.hypot(p.x - ball.x, p.y - ball.y) > GRAB_RADIUS) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { aim: aimFromPull(ball, p) ?? emptyAim(ball) };
    note = "";
    render();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const ball = BALL_START[state.thrower];
    drag = { aim: aimFromPull(ball, pointerCm(e)) ?? emptyAim(ball) };
    panelUpdate();
    paintCanvas();
  });

  const finish = (e: PointerEvent, cancel: boolean) => {
    if (!drag) return;
    const aim = drag.aim;
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (cancel || aim.power < MIN_POWER) {
      render();
      return;
    }
    launch(aim);
  };
  canvas.addEventListener("pointerup", (e) => finish(e, false));
  canvas.addEventListener("pointercancel", (e) => finish(e, true));

  function emptyAim(ball: Point): Aim {
    return { dir: { x: ball.x < 120 ? 1 : -1, y: 0 }, power: 0, handle: ball };
  }

  airBtn.addEventListener("click", () => setShot("air"));
  bounceBtn.addEventListener("click", () => setShot("bounce"));
  function setShot(s: Shot) {
    shot = s;
    turnCard();
    panelUpdate();
    paintCanvas();
  }
  restart.addEventListener("click", reset);
  function reset() {
    state = newGame();
    drag = null;
    flight = null;
    note = "";
    render();
  }

  // --- Throwing --------------------------------------------------------
  function launch(aim: Aim) {
    const side = state.thrower;
    const defender = other(side);
    const origin = BALL_START[side];
    const result = resolveThrow(origin, aim, shot, defender, state.cups[defender], rng);
    const thrown = shot;
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FLIGHT_MS);
      flight = {
        pos: { x: origin.x + (result.landing.x - origin.x) * t, y: origin.y + (result.landing.y - origin.y) * t },
        scale: thrown === "air" ? 1 + 0.5 * Math.sin(Math.PI * t) : t < 0.667 ? 1 + 0.4 * Math.sin((Math.PI * t) / 0.667) : 1 + 0.25 * Math.sin((Math.PI * (t - 0.667)) / 0.333),
      };
      if (t < 1) {
        paintCanvas();
        requestAnimationFrame(step);
        return;
      }
      flight = null;
      const before = state;
      state = reduce(state, { type: "throw", shot: thrown, target: result.target });
      note = describe(before, state);
      render();
    };
    flight = { pos: origin, scale: 1 };
    panelUpdate();
    requestAnimationFrame(step);
  }

  function describe(before: State, after: State): string {
    if (after.phase === "over") return "";
    if (after.phase === "reroll" && before.phase !== "reroll") return `${NAMES[before.thrower]} cleared the rack. ${NAMES[after.thrower]} gets one last turn.`;
    if (after.suddenDeath && !before.suddenDeath) return "Sudden death. New 3-cup racks.";
    if (after.thrower === before.thrower && after.ballsThrown === 0 && after.ballsBackUsed) return "Both balls hit. Balls back!";
    if (after.thrower !== before.thrower) {
      const left = after.cups[before.thrower === 0 ? 1 : 0].length;
      const lost = before.cups[before.thrower === 0 ? 1 : 0].length - left;
      return lost > 0 ? `${NAMES[before.thrower]} sank ${lost} ${lost === 1 ? "cup" : "cups"}. ${left} left.` : `${NAMES[before.thrower]} missed.`;
    }
    return "";
  }

  new ResizeObserver(paintCanvas).observe(arena);
  render();
}
