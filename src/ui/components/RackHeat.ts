import type { RackCup } from "../../app/screenModels";
import { el } from "../dom";

/** The opponent's rack as a pyramid; each cup shows the share of your hits it took. */
export function createRackHeat(cups: readonly RackCup[]): HTMLElement {
  const wrap = el("div", "rackheat");
  wrap.setAttribute("role", "img");
  wrap.ariaLabel = `Share of your hits per cup: ${cups.map((c) => `${c.percent}%`).join(", ")}`;
  for (const cup of cups) {
    const node = el("span", "rackheat__cup", String(cup.percent));
    node.style.left = `calc(27px + (100% - 54px) * ${cup.x})`;
    node.style.top = `calc(27px + (100% - 54px) * ${cup.y})`;
    // Hotter cups are greener; cups that took no hits stay dark.
    node.style.setProperty("--heat", `${Math.round(cup.heat * 70 + (cup.heat > 0 ? 25 : 0))}%`);
    if (cup.heat > 0.6) node.classList.add("rackheat__cup--hot");
    wrap.append(node);
  }
  return wrap;
}
