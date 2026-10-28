import type { CpuLevel } from "../domain/cpu";
import type { Side } from "../domain/engine";
import { MatchController } from "../match/MatchController";
import { LocalProfileStore, type ProfileStore } from "../storage/ProfileStore";
import { FirstThrowScreen } from "./screens/FirstThrowScreen";
import { HomeScreen } from "./screens/HomeScreen";
import type { Navigator, Screen } from "./types";

/** Shows one screen at a time and moves between them. */
export class App implements Navigator {
  private current: Screen | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly profile: ProfileStore = new LocalProfileStore(),
  ) {
    this.home();
  }

  home(): void {
    this.show(() => new HomeScreen(this.root, this, this.profile));
  }

  firstThrow(level: CpuLevel): void {
    this.show(() => new FirstThrowScreen(this.root, this, level, this.profile));
  }

  match(level: CpuLevel, first: Side): void {
    this.show(() => {
      const match = new MatchController(
        this.root,
        { nickname: this.profile.nickname(), level, first, seed: Date.now() },
        { onFinished: () => this.home(), onLeave: () => this.home() },
      );
      return { destroy: () => match.destroy() };
    });
  }

  stats(): void {
    this.home();
  }

  private show(create: () => Screen): void {
    this.current?.destroy();
    this.root.replaceChildren();
    this.current = create();
  }
}
