import { CUPS_PER_SIDE, TABLE_H, TABLE_W, rackOutline, slotPosition } from "../../domain/engine";

const NS = "http://www.w3.org/2000/svg";
const CUP_RADIUS = 4.3;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** A static top-down picture of the table with both racks full, for the home screen. */
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
      root.append(svg("circle", { cx: x, cy: y, r: CUP_RADIUS - 0.4, class: "hero__cup" }));
    }
  }
  return root;
}
