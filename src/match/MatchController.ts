import {
  opponent,
  reduce,
  secondCupCandidates,
  type Shot,
  type Side,
  type State,
} from "../domain/engine";
import type { Aim } from "../domain/throw";
import { createGame } from "../game/createGame";
import { TableScene } from "../game/TableScene";
import { OpponentLeft } from "../online/OnlineSession";
import { MatchPage } from "../ui/components/MatchPage";
import { ScoreCard } from "../ui/components/ScoreCard";
import { ShotPanel } from "../ui/components/ShotPanel";
import { ThrowLog } from "../ui/components/ThrowLog";
import { TurnCard } from "../ui/components/TurnCard";
import type { MatchDriver, ResolvedThrow } from "./drivers";
import { rimNote, turnSummary, YOU, type Names } from "./narration";
import { newMatch } from "./newMatch";
import { logRows, scoreView, turnView } from "./viewModels";

/** How long the opponent's aim is shown before the ball is thrown. */
const OPPONENT_AIM_MS = 700;
/** Time to read the final result before the result screen opens. */
const FINISH_MS = 1600;

export interface MatchCallbacks {
  /** Called once when the match is over, with the final state. */
  onFinished(state: State): void;
  onLeave(): void;
  /** Online only: the other player left before the match was over. */
  onOpponentLeft(): void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs one match, solo or online. It owns the game state and wires the pieces together: the rules
 * (domain), the table (Phaser scene) and the panels (DOM components). Where a throw's outcome
 * comes from is the driver's business. State flows one way: throw -> driver -> reduce -> render.
 */
export class MatchController {
  private readonly narrationNames: Names;
  private state: State;
  private shot: Shot = "air";
  /** Power of the aim being dragged, 0 when not dragging. */
  private power = 0;
  private busy = false;
  private finished = false;
  private disposed = false;
  /** News from the last throw, shown in the turn card until the next one. */
  private note = "";

  private readonly scores: [ScoreCard, ScoreCard];
  private readonly turn = new TurnCard();
  private readonly shotPanel = new ShotPanel((shot) => this.selectShot(shot));
  private readonly log = new ThrowLog();
  private readonly scene: TableScene;
  private readonly game: Phaser.Game;

  constructor(
    root: HTMLElement,
    first: Side,
    private readonly driver: MatchDriver,
    private readonly callbacks: MatchCallbacks,
  ) {
    this.state = newMatch(first);
    const local = driver.localSide;
    this.narrationNames = local === 0 ? [YOU, driver.opponentName] : [driver.opponentName, YOU];
    this.scores = [
      new ScoreCard(`${this.cardName(0)} cups`),
      new ScoreCard(`${this.cardName(1)} cups`),
    ];

    const page = new MatchPage(
      root,
      {
        scoreA: this.scores[0],
        turn: this.turn,
        scoreB: this.scores[1],
        shotPanel: this.shotPanel,
        log: this.log,
      },
      { mode: driver.modeLabel, onLeave: () => callbacks.onLeave() },
    );
    this.scene = new TableScene({
      onAim: (aim) => this.onAim(aim),
      onThrow: (aim) => void this.localThrow(aim),
    });
    this.game = createGame(page.arena, this.scene);
    this.render();
    void this.next();
  }

  /** Stop everything: used when leaving the screen. */
  destroy(): void {
    this.disposed = true;
    this.driver.destroy();
    this.game.destroy(true);
  }

  private get localTurn(): boolean {
    return this.state.phase !== "over" && this.state.thrower === this.driver.localSide;
  }

  private cardName(side: Side): string {
    return side === this.driver.localSide ? this.driver.nickname : this.driver.opponentCardName;
  }

  private selectShot(shot: Shot): void {
    this.shot = shot;
    this.render();
  }

  private onAim(aim: Aim | null): void {
    this.power = aim?.power ?? 0;
    this.shotPanel.update({ shot: this.shot, power: this.power, enabled: this.localTurn });
  }

  /** After every throw: report the end of the match, or wait for the opponent's turn. */
  private async next(): Promise<void> {
    if (this.disposed) return;
    if (this.state.phase === "over") {
      if (!this.finished) {
        this.finished = true;
        await sleep(FINISH_MS);
        if (!this.disposed) this.callbacks.onFinished(this.state);
      }
      return;
    }
    if (!this.localTurn) await this.opponentTurn();
  }

  private async localThrow(aim: Aim): Promise<void> {
    const shot = this.shot;
    this.note = "";
    this.busy = true;
    this.render();
    await this.resolveAndPlay(() => this.driver.localThrow(this.state, shot, aim));
  }

  private async opponentTurn(): Promise<void> {
    this.busy = true;
    this.render();
    await this.resolveAndPlay(() => this.driver.opponentThrow(this.state));
  }

  /** Get a throw from the driver, show it, apply it, then carry on with the next turn. */
  private async resolveAndPlay(resolve: () => Promise<ResolvedThrow>): Promise<void> {
    let thrown: ResolvedThrow;
    try {
      thrown = await resolve();
    } catch (error) {
      if (error instanceof OpponentLeft && !this.disposed) this.callbacks.onOpponentLeft();
      else if (!(error instanceof OpponentLeft)) throw error;
      return;
    }
    if (this.disposed) return;

    if (thrown.preview) {
      this.scene.previewAim(thrown.preview, thrown.shot);
      await sleep(OPPONENT_AIM_MS);
      this.scene.previewAim(null, thrown.shot);
      if (this.disposed) return;
    }
    this.note = "";
    this.render();
    await this.scene.playFlight(thrown.side, thrown.result, thrown.shot);
    if (this.disposed) return;

    let second: number | undefined;
    try {
      second = await this.pickSecondCup(thrown);
    } catch (error) {
      if (error instanceof OpponentLeft && !this.disposed) this.callbacks.onOpponentLeft();
      else if (!(error instanceof OpponentLeft)) throw error;
      return;
    }
    if (this.disposed) return;
    this.busy = false;

    const before = this.state;
    this.state = reduce(before, {
      type: "throw",
      shot: thrown.shot,
      target: thrown.result.target,
      second,
    });
    this.note = [
      rimNote(thrown.result.contact),
      turnSummary(before, this.state, this.narrationNames),
    ]
      .filter(Boolean)
      .join(" ");
    this.render();
    await this.next();
  }

  /**
   * After a bounce hit the thrower chooses the second cup: the local player clicks one, an online
   * opponent sends their choice. Returns undefined when there is nothing to choose (one or no
   * cup left to take) or the CPU threw, and the rules take the nearest cup.
   */
  private async pickSecondCup(thrown: ResolvedThrow): Promise<number | undefined> {
    const { side, shot, result } = thrown;
    if (shot !== "bounce" || result.target === null) return undefined;
    const candidates = secondCupCandidates(this.state, result.target).map((c) => c.id);
    if (candidates.length < 2) return undefined;

    if (side === this.driver.localSide) {
      this.note = "Bounce hit! Click the second cup.";
      this.render();
      const cup = await this.scene.chooseSecondCup(opponent(side), result.target, candidates);
      this.driver.sendPick(cup);
      return cup;
    }
    if (this.driver.mode === "online") {
      this.note = `${this.driver.opponentName} is choosing the second cup.`;
      this.render();
    }
    const cup = await this.driver.opponentPick();
    return cup !== undefined && candidates.includes(cup) ? cup : undefined;
  }

  private render(): void {
    const { state, shot, driver } = this;
    const local = driver.localSide;
    for (const side of [0, 1] as const) {
      const mine = side === local;
      this.scores[side].update(
        scoreView(state, side, this.cardName(side), mine ? "YOU" : driver.opponentTag, mine),
      );
    }
    this.turn.update(turnView(state, shot, this.note, this.narrationNames, this.localTurn));
    this.log.update(logRows(state, this.narrationNames));
    this.shotPanel.update({ shot, power: this.power, enabled: this.localTurn && !this.busy });
    this.scene.setView({
      state,
      shot,
      canThrow: this.localTurn && !this.busy,
      names: [...this.narrationNames],
    });
  }
}
