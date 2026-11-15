import { CUPS_PER_SIDE, TABLE_H, TABLE_W, rackOutline, slotPosition } from "../../domain/engine";

const NS = "http://www.w3.org/2000/svg";
const CUP_RADIUS = 4.3;
const BALL_RADIUS = 1.5;

/** How long one throw is in the air, and the breather between throws. */
const FLIGHT_MS = 950;
const PAUSE_MS = 650;
/** How often a throw lands in a cup. */
const HIT_CHANCE = 0.5;
/** How far the ball rises at the top of its arc, drawn as a lift towards the top of the table. */
const ARC_LIFT = 9;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** A top-down picture of the table with both racks full, for the home screen. A rally plays on it. */
export function createTableHero(): SVGSVGElement {
  const root = svg("svg", {
    viewBox: `-1 -1 ${TABLE_W + 2} ${TABLE_H + 2}`,
    class: "hero__table",
    role: "img",
    "aria-label": "A beer pong table seen from above with ten cups on each side",
  });
  root.append(
    svg("rect", { x: 0, y: 0, width: TABLE_W, height: TABLE_H, rx: 1, class: "hero__felt" }),
  );
  for (const x of [60, 120, 180]) {
    root.append(svg("line", { x1: x, y1: 0, x2: x, y2: TABLE_H, class: "hero__line" }));
  }
  root.append(svg("circle", { cx: 120, cy: 30, r: 9, class: "hero__circle" }));
  root.append(svg("circle", { cx: 120, cy: 30, r: 1.8, class: "hero__dot" }));

  const cups: [SVGCircleElement[], SVGCircleElement[]] = [[], []];
  for (const side of [0, 1] as const) {
    const [a, b, tip] = rackOutline(side);
    root.append(
      svg("polygon", {
        points: `${a.x},${a.y} ${b.x},${b.y} ${tip.x},${tip.y}`,
        class: "hero__rack",
      }),
    );
    for (let slot = 0; slot < CUPS_PER_SIDE; slot++) {
      const { x, y } = slotPosition(side, slot);
      const cup = svg("circle", { cx: x, cy: y, r: CUP_RADIUS - 0.4, class: "hero__cup" });
      cups[side].push(cup);
      root.append(cup);
    }
  }

  playRally(root, cups);
  return root;
}

// --- Rally -----------------------------------------------------------------

type Cups = [SVGCircleElement[], SVGCircleElement[]];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;

/**
 * Throws balls back and forth for as long as the picture is on the page. Skipped when the player
 * prefers reduced motion, or where the Web Animations API is missing (e.g. in tests).
 */
function playRally(root: SVGSVGElement, cups: Cups): void {
  if (typeof root.animate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const shadow = svg("circle", { cx: 0, cy: 0, r: BALL_RADIUS, class: "hero__shadow" });
  const ball = svg("circle", { cx: 0, cy: 0, r: BALL_RADIUS, class: "hero__ball" });
  const splash = svg("circle", { cx: 0, cy: 0, r: CUP_RADIUS, class: "hero__splash" });
  root.append(shadow, splash, ball);

  void (async () => {
    // The picture is created before it is put on the page, so give it a moment to get there.
    await wait(800);
    let thrower: 0 | 1 = 0;
    while (root.isConnected) {
      const target: 0 | 1 = thrower === 0 ? 1 : 0;
      const standing = cups[target].filter((cup) => !cup.classList.contains("hero__cup--sunk"));
      const cup = standing[Math.floor(Math.random() * standing.length)]!;
      await throwAt(thrower, cup, Math.random() < HIT_CHANCE, { ball, shadow, splash });
      if (standing.length === 1 && cup.classList.contains("hero__cup--sunk")) {
        await wait(PAUSE_MS);
        for (const c of [...cups[0], ...cups[1]]) c.classList.remove("hero__cup--sunk");
      }
      thrower = target;
      await wait(PAUSE_MS);
    }
  })();
}

interface Pieces {
  ball: SVGCircleElement;
  shadow: SVGCircleElement;
  splash: SVGCircleElement;
}

async function throwAt(
  thrower: 0 | 1,
  cup: SVGCircleElement,
  hit: boolean,
  { ball, shadow, splash }: Pieces,
): Promise<void> {
  const fromX = thrower === 0 ? 1 : TABLE_W - 1;
  const fromY = rand(18, 42);
  const cupX = Number(cup.getAttribute("cx"));
  const cupY = Number(cup.getAttribute("cy"));
  // A miss clips the rim and skips off past it.
  const angle = rand(0, Math.PI * 2);
  const toX = hit ? cupX : cupX + Math.cos(angle) * CUP_RADIUS * 1.1;
  const toY = hit ? cupY : cupY + Math.sin(angle) * CUP_RADIUS * 1.1;

  const steps = 16;
  const ballFrames: Keyframe[] = [];
  const shadowFrames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    const height = 4 * t * (1 - t); // 0 at both ends, 1 at the top of the arc
    ballFrames.push({ transform: at(x, y - height * ARC_LIFT, 1 + height * 0.9), opacity: 1 });
    shadowFrames.push({ transform: at(x, y, 1 - height * 0.4), opacity: 0.5 - height * 0.3 });
  }
  const flight = { duration: FLIGHT_MS, easing: "linear", fill: "forwards" } as const;
  await Promise.all([
    ball.animate(ballFrames, flight).finished,
    shadow.animate(shadowFrames, flight).finished,
  ]);

  if (hit) {
    cup.classList.add("hero__cup--sunk");
    const sink = { duration: 220, easing: "ease-in", fill: "forwards" } as const;
    splash.animate(
      [
        { transform: at(cupX, cupY, 0.6), opacity: 0.9 },
        { transform: at(cupX, cupY, 1.8), opacity: 0 },
      ],
      { duration: 500, easing: "ease-out", fill: "forwards" },
    );
    await Promise.all([
      ball.animate(
        [{ transform: at(cupX, cupY, 1) }, { transform: at(cupX, cupY, 0), opacity: 0 }],
        sink,
      ).finished,
      shadow.animate([{ opacity: 0.5 }, { opacity: 0 }], sink).finished,
    ]);
    return;
  }

  // Skip off the rim, carrying on in roughly the same direction, and fade away.
  const dx = Math.sign(toX - fromX) * rand(8, 16);
  const dy = (toY - cupY) * rand(1.5, 3);
  const skip = { duration: 380, easing: "ease-out", fill: "forwards" } as const;
  await Promise.all([
    ball.animate(
      [
        { transform: at(toX, toY), opacity: 1 },
        { transform: at(toX + dx / 2, toY + dy / 2 - 3, 1.3), opacity: 0.9, offset: 0.5 },
        { transform: at(toX + dx, toY + dy), opacity: 0 },
      ],
      skip,
    ).finished,
    shadow.animate(
      [
        { transform: at(toX, toY), opacity: 0.5 },
        { transform: at(toX + dx, toY + dy), opacity: 0 },
      ],
      skip,
    ).finished,
  ]);
}
