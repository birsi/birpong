import type { CpuLevel } from "../domain/cpu";
import type { Side, State } from "../domain/engine";
import { summarizeMatch } from "../domain/stats";
import { OnlineDriver, SoloDriver, type MatchDriver } from "../match/drivers";
import { MatchController } from "../match/MatchController";
import { joinTrysteroRoom } from "../online/link";
import { OnlineSession } from "../online/OnlineSession";
import { generateRoomCode } from "../online/roomCode";
import { LocalProfileStore, type ProfileStore } from "../storage/ProfileStore";
import { LocalStatsStore, type StatsStore } from "../storage/StatsStore";
import { FirstThrowScreen } from "./screens/FirstThrowScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { StatsScreen } from "./screens/StatsScreen";
import type { Navigator, Screen } from "./types";

const LEFT_ROOM = "The other player left the room.";

/** The room the player is in, if any: the session and the code it was opened with. */
interface Room {
  session: OnlineSession;
  code: string;
}

/** Shows one screen at a time and moves between them. */
export class App implements Navigator {
  private current: Screen | null = null;
  private room: Room | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly profile: ProfileStore = new LocalProfileStore(),
    private readonly store: StatsStore = new LocalStatsStore(),
  ) {
    this.home();
  }

  home(notice?: string): void {
    this.leaveRoom();
    this.show(() => new HomeScreen(this.root, this, this.profile, notice));
  }

  firstThrow(level: CpuLevel): void {
    this.show(() => new FirstThrowScreen(this.root, this, level, this.profile));
  }

  match(level: CpuLevel, first: Side): void {
    const driver = new SoloDriver(this.profile.nickname(), level, Date.now());
    this.playMatch(first, driver, () => this.firstThrow(level));
  }

  stats(): void {
    this.show(() => new StatsScreen(this.root, this, this.profile, this.store));
  }

  // --- Online ------------------------------------------------------------

  createRoom(): void {
    this.openRoom(generateRoomCode(), "host");
  }

  joinRoom(code: string): void {
    this.openRoom(code, "guest");
  }

  startOnline(first: Side): void {
    const room = this.room;
    if (!room) return;
    const driver = new OnlineDriver(room.session, this.profile.nickname());
    this.playMatch(first, driver, () => this.requestRematch(room));
  }

  private openRoom(code: string, role: "host" | "guest"): void {
    this.leaveRoom();
    const session = new OnlineSession(joinTrysteroRoom(code), role, this.profile.nickname());
    this.room = { session, code };
    this.showLobby(this.room);
  }

  private showLobby({ session, code }: Room): void {
    this.show(() => new LobbyScreen(this.root, this, session, code));
  }

  /** Both players press Rematch: back to the lobby of the same room. */
  private requestRematch(room: Room): void {
    const off = room.session.rematch.on(() => {
      off();
      this.showLobby(room);
    });
    room.session.requestRematch();
  }

  private leaveRoom(): void {
    this.room?.session.leave();
    this.room = null;
  }

  // --- Matches -----------------------------------------------------------

  /** Run a match with the given driver, then save it and show the result. */
  private playMatch(first: Side, driver: MatchDriver, rematch: () => void): void {
    this.show(() => {
      const match = new MatchController(this.root, first, driver, {
        onFinished: (state) => this.finish(state, driver, rematch),
        onLeave: () => this.home(),
        onOpponentLeft: () => this.home(LEFT_ROOM),
      });
      return { destroy: () => match.destroy() };
    });
  }

  /** Save the finished match and show how it went. */
  private finish(state: State, driver: MatchDriver, rematch: () => void): void {
    const date = new Date().toISOString();
    const record = summarizeMatch(state, driver.localSide, {
      id: `${date}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      mode: driver.mode,
      opponent: driver.recordOpponent,
    });
    this.store.add(record);

    const session = this.room?.session;
    // If the other player leaves while we look at the result, there is no rematch to wait for.
    const offLeft = session?.changed.on(() => {
      if (session.status === "closed") this.home(LEFT_ROOM);
    });
    this.show(() => {
      const screen = new ResultScreen(this.root, this, {
        record,
        state,
        nickname: driver.nickname,
        opponentLabel: driver.recordOpponent,
        modeLabel: driver.modeLabel,
        localSide: driver.localSide,
        online: driver.mode === "online",
        onRematch: rematch,
      });
      return {
        destroy: () => {
          offLeft?.();
          screen.destroy();
        },
      };
    });
  }

  private show(create: () => Screen): void {
    this.current?.destroy();
    this.root.replaceChildren();
    this.current = create();
  }
}
