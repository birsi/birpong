import { opponent, reduce, type Shot, type State } from "../domain/engine";
import { BALL_START, createRng, resolveThrow, type Aim, type Rng } from "../domain/throw";
import { createGame } from "../game/createGame";
import { TableScene } from "../game/TableScene";
import { MatchPage } from "../ui/components/MatchPage";
import { ScoreCard } from "../ui/components/ScoreCard";
import { ShotPanel } from "../ui/components/ShotPanel";
import { ThrowLog } from "../ui/components/ThrowLog";
import { TurnCard } from "../ui/components/TurnCard";
import { rimNote, turnSummary, type Names } from "./narration";
import { newMatch } from "./newMatch";
import { logRows, scoreView, turnView } from "./viewModels";

const NAMES: Names = ["Player 1", "Player 2"];

/**
 * Runs a hot-seat match. It owns the game state and wires the pieces together: the rules (domain),
 * the table (Phaser scene) and the panels (DOM components). State flows one way: input -> reduce ->
 * render.
 */
export class MatchController {
  private readonly rng: Rng;
  private state: State;
  private shot: Shot = "air";
  /** Power of the aim being dragged, 0 when not dragging. */
  private power = 0;
  private flying = false;
  /** News from the last throw, shown in the turn card until the next one. */
  private note = "";

  private readonly scoreA = new ScoreCard(`${NAMES[0]} cups`);
  private readonly scoreB = new ScoreCard(`${NAMES[1]} cups`);
  private readonly turn = new TurnCard(() => this.restart());
  private readonly shotPanel = new ShotPanel((shot) => this.selectShot(shot));
  private readonly log = new ThrowLog();
  private readonly scene: TableScene;

  constructor(root: HTMLElement, seed: number) {
    this.rng = createRng(seed);
    this.state = newMatch(this.rng);

    const page = new MatchPage(
      root,
      {
        scoreA: this.scoreA,
        turn: this.turn,
        scoreB: this.scoreB,
        shotPanel: this.shotPanel,
        log: this.log,
      },
      () => this.restart(),
    );
    this.scene = new TableScene({
      onAim: (aim) => this.onAim(aim),
      onThrow: (aim) => void this.playThrow(aim),
    });
    createGame(page.arena, this.scene);
    this.render();
  }

  private restart(): void {
    this.state = newMatch(this.rng);
    this.note = "";
    this.render();
  }

  private selectShot(shot: Shot): void {
    this.shot = shot;
    this.render();
  }

  private onAim(aim: Aim | null): void {
    this.power = aim?.power ?? 0;
    this.shotPanel.update({ shot: this.shot, power: this.power });
  }

  private async playThrow(aim: Aim): Promise<void> {
    const side = this.state.thrower;
    const defender = opponent(side);
    const shot = this.shot;
    const result = resolveThrow(
      BALL_START[side],
      aim,
      shot,
      defender,
      this.state.cups[defender],
      this.rng,
    );

    this.note = "";
    this.flying = true;
    this.render();
    await this.scene.playFlight(side, result, shot);
    this.flying = false;

    const before = this.state;
    this.state = reduce(before, { type: "throw", shot, target: result.target });
    this.note = [rimNote(result.contact), turnSummary(before, this.state, NAMES)]
      .filter(Boolean)
      .join(" ");
    this.render();
  }

  private render(): void {
    const { state, shot } = this;
    this.scoreA.update(scoreView(state, 0, NAMES));
    this.scoreB.update(scoreView(state, 1, NAMES));
    this.turn.update(turnView(state, shot, this.note, NAMES));
    this.log.update(logRows(state, NAMES));
    this.shotPanel.update({ shot, power: this.power });
    this.scene.setView({
      state,
      shot,
      canThrow: !this.flying && state.phase !== "over",
      names: [...NAMES],
    });
  }
}
