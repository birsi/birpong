import type { CpuLevel } from "../domain/cpu";
import type { Side, State } from "../domain/engine";
import { summarizeMatch } from "../domain/stats";
import { MatchController } from "../match/MatchController";
import { HUMAN } from "../match/types";
import { LocalProfileStore, type ProfileStore } from "../storage/ProfileStore";
import { LocalStatsStore, type StatsStore } from "../storage/StatsStore";
import { FirstThrowScreen } from "./screens/FirstThrowScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { StatsScreen } from "./screens/StatsScreen";
import type { Navigator, Screen } from "./types";

/** Shows one screen at a time and moves between them. */
export class App implements Navigator {
  private current: Screen | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly profile: ProfileStore = new LocalProfileStore(),
    private readonly store: StatsStore = new LocalStatsStore(),
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
        { onFinished: (state) => this.finish(state, level), onLeave: () => this.home() },
      );
      return { destroy: () => match.destroy() };
    });
  }

  stats(): void {
    this.show(() => new StatsScreen(this.root, this, this.profile, this.store));
  }

  /** Save the finished match and show how it went. */
  private finish(state: State, level: CpuLevel): void {
    const date = new Date().toISOString();
    const record = summarizeMatch(state, HUMAN, {
      id: `${date}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      mode: "solo",
      opponent: `CPU ${level}`,
    });
    this.store.add(record);
    this.show(
      () =>
        new ResultScreen(this.root, this, {
          record,
          state,
          nickname: this.profile.nickname(),
          level,
        }),
    );
  }

  private show(create: () => Screen): void {
    this.current?.destroy();
    this.root.replaceChildren();
    this.current = create();
  }
}
