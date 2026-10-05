import type { Shot } from "../../domain/engine";
import { BOUNCE_WINDOW } from "../../domain/throw";
import { powerHelp } from "../../match/narration";
import { el } from "../dom";

export interface ShotPanelView {
  shot: Shot;
  /** 0 to 1, shown while dragging. */
  power: number;
}

/** Air/bounce toggle and the power bar, with the bounce window marked. */
export class ShotPanel {
  readonly root = el("section", "card card--panel");
  private readonly buttons: Record<Shot, HTMLButtonElement>;
  private readonly value = el("span", "power__value", "0%");
  private readonly bar = el("div", "bar");
  private readonly fill = el("div", "bar__fill");
  private readonly window = el("div", "bar__window");
  private readonly help = el("p");

  constructor(onShot: (shot: Shot) => void) {
    this.root.ariaLabel = "Shot";
    this.buttons = {
      air: this.shotButton("AIR", "1 cup, straight in", () => onShot("air")),
      bounce: this.shotButton("BOUNCE", "2 cups, harder to land", () => onShot("bounce")),
    };
    const shots = el("div", "shots");
    shots.append(this.buttons.air, this.buttons.bounce);

    const track = el("div", "bar__track");
    track.append(this.fill);
    this.window.style.left = `${BOUNCE_WINDOW[0] * 100}%`;
    this.window.style.width = `${(BOUNCE_WINDOW[1] - BOUNCE_WINDOW[0]) * 100}%`;
    this.bar.setAttribute("role", "img");
    this.bar.append(track, this.window);

    const head = el("div", "power__head");
    head.append(el("span", "label", "Power"), this.value);
    const power = el("div", "power");
    power.append(head, this.bar, this.help);

    this.root.append(shots, power);
  }

  update({ shot, power }: ShotPanelView): void {
    for (const key of Object.keys(this.buttons) as Shot[]) {
      this.buttons[key].ariaPressed = String(key === shot);
    }
    const percent = Math.round(power * 100);
    this.window.style.display = shot === "bounce" ? "block" : "none";
    this.fill.style.width = `${power * 100}%`;
    this.value.textContent = `${percent}%`;
    this.bar.ariaLabel = `Power ${percent} percent`;
    this.help.textContent = powerHelp(shot);
  }

  private shotButton(name: string, description: string, onClick: () => void): HTMLButtonElement {
    const b = el("button", "shot");
    b.type = "button";
    b.append(el("span", "shot__name", name), el("span", "shot__desc", description));
    b.addEventListener("click", onClick);
    return b;
  }
}
