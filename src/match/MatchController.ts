import { chooseThrow } from "../domain/cpu";
import { opponent, reduce, type Shot, type State } from "../domain/engine";
import { BALL_START, createRng, resolveThrow, type Aim, type Rng } from "../domain/throw";
import { createGame } from "../game/createGame";
import { TableScene } from "../game/TableScene";
import { MatchPage } from "../ui/components/MatchPage";
import { ScoreCard } from "../ui/components/ScoreCard";
import { ShotPanel } from "../ui/components/ShotPanel";
import { ThrowLog } from "../ui/components/ThrowLog";
import { TurnCard } from "../ui/components/TurnCard";
import { levelLabel, rimNote, turnSummary, YOU, type Names } from "./narration";
import { newMatch } from "./newMatch";
import { CPU, HUMAN, type MatchSetup } from "./types";
import { logRows, scoreView, turnView } from "./viewModels";

/** Pauses that make the CPU's turn readable. */
const CPU_THINK_MS = 600;
const CPU_AIM_MS = 700;
/** Time to read the final result before the result screen opens. */
const FINISH_MS = 1600;

export interface MatchCallbacks {
  /** Called once when the match is over, with the final state. */
  onFinished(state: State): void;
  onLeave(): void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs a solo match against the CPU. It owns the game state and wires the pieces together: the
 * rules (domain), the table (Phaser scene) and the panels (DOM components). State flows one way:
 * input -> reduce -> render.
 */
export class MatchController {
  private readonly rng: Rng;
  private readonly narrationNames: Names = [YOU, "CPU"];
  private state: State;
  private shot: Shot = "air";
  /** Power of the aim being dragged, 0 when not dragging. */
  private power = 0;
  private busy = false;
  private finished = false;
  private disposed = false;
  /** News from the last throw, shown in the turn card until the next one. */
  private note = "";

  private readonly scoreA: ScoreCard;
  private readonly scoreB = new ScoreCard("CPU cups");
  private readonly turn = new TurnCard();
  private readonly shotPanel = new ShotPanel((shot) => this.selectShot(shot));
  private readonly log = new ThrowLog();
  private readonly scene: TableScene;
  private readonly game: Phaser.Game;

  constructor(
    root: HTMLElement,
    private readonly setup: MatchSetup,
    private readonly callbacks: MatchCallbacks,
  ) {
    this.rng = createRng(setup.seed);
    this.state = newMatch(setup.first);
    this.scoreA = new ScoreCard(`${setup.nickname} cups`);

    const page = new MatchPage(
      root,
      {
        scoreA: this.scoreA,
        turn: this.turn,
        scoreB: this.scoreB,
        shotPanel: this.shotPanel,
        log: this.log,
      },
      {
        mode: `Solo · CPU ${setup.level}`,
        onLeave: () => callbacks.onLeave(),
      },
    );
    this.scene = new TableScene({
      onAim: (aim) => this.onAim(aim),
      onThrow: (aim) => void this.playThrow(aim, this.shot),
    });
    this.game = createGame(page.arena, this.scene);
    this.render();
    void this.next();
  }

  /** Stop everything: used when leaving the screen. */
  destroy(): void {
    this.disposed = true;
    this.game.destroy(true);
  }

  private get humanTurn(): boolean {
    return this.state.phase !== "over" && this.state.thrower === HUMAN;
  }

  private selectShot(shot: Shot): void {
    this.shot = shot;
    this.render();
  }

  private onAim(aim: Aim | null): void {
    this.power = aim?.power ?? 0;
    this.shotPanel.update({ shot: this.shot, power: this.power, enabled: this.humanTurn });
  }

  /** After every throw: report the end of the match, or let the CPU take its turn. */
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
    if (this.state.thrower === CPU) await this.cpuTurn();
  }

  private async cpuTurn(): Promise<void> {
    this.busy = true;
    this.render();
    await sleep(CPU_THINK_MS);
    if (this.disposed) return;
    const choice = chooseThrow(this.state, CPU, this.setup.level, this.rng);
    this.scene.previewAim(choice.aim, choice.shot);
    await sleep(CPU_AIM_MS);
    if (this.disposed) return;
    this.scene.previewAim(null, choice.shot);
    await this.playThrow(choice.aim, choice.shot);
  }

  private async playThrow(aim: Aim, shot: Shot): Promise<void> {
    const side = this.state.thrower;
    const defender = opponent(side);
    const result = resolveThrow(
      BALL_START[side],
      aim,
      shot,
      defender,
      this.state.cups[defender],
      this.rng,
    );

    this.note = "";
    this.busy = true;
    this.render();
    await this.scene.playFlight(side, result, shot);
    if (this.disposed) return;
    this.busy = false;

    const before = this.state;
    this.state = reduce(before, { type: "throw", shot, target: result.target });
    this.note = [rimNote(result.contact), turnSummary(before, this.state, this.narrationNames)]
      .filter(Boolean)
      .join(" ");
    this.render();
    await this.next();
  }

  private render(): void {
    const { state, shot, setup } = this;
    const cardNames: Names = [setup.nickname, levelLabel(setup.level)];
    this.scoreA.update(scoreView(state, HUMAN, cardNames[0]));
    this.scoreB.update(scoreView(state, CPU, cardNames[1]));
    this.turn.update(turnView(state, shot, this.note, this.narrationNames, this.humanTurn));
    this.log.update(logRows(state, this.narrationNames));
    this.shotPanel.update({ shot, power: this.power, enabled: this.humanTurn && !this.busy });
    this.scene.setView({
      state,
      shot,
      canThrow: this.humanTurn && !this.busy,
      names: ["You", "CPU"],
    });
  }
}
