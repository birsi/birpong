import { chooseThrow, type CpuLevel } from "../domain/cpu";
import { opponent, type Shot, type Side, type State } from "../domain/engine";
import {
  BALL_START,
  createRng,
  resolveThrow,
  type Aim,
  type Rng,
  type ThrowResult,
} from "../domain/throw";
import type { MatchRecord } from "../domain/stats";
import { OnlineSession } from "../online/OnlineSession";
import { levelLabel } from "./narration";

/** One throw with its outcome, ready to be played and applied by the controller. */
export interface ResolvedThrow {
  side: Side;
  shot: Shot;
  result: ThrowResult;
  /** The opponent's aim, when it should be shown for a moment before the ball is thrown. */
  preview: Aim | null;
}

/**
 * Where the throws of a match come from. The controller plays and applies whatever the driver
 * resolves, so solo and online matches share all the rest: the CPU lives in `SoloDriver`, the
 * network in `OnlineDriver`.
 */
export interface MatchDriver {
  /** The side the person at this screen throws for. */
  readonly localSide: Side;
  /** Your name on the score card. */
  readonly nickname: string;
  /** Opponent's name on the score card and in the match record. */
  readonly opponentCardName: string;
  /** Opponent's name in sentences ("CPU sank 1 cup"). */
  readonly opponentName: string;
  /** Short tag on the opponent's score card. */
  readonly opponentTag: string;
  /** Text in the header chip. */
  readonly modeLabel: string;
  readonly mode: MatchRecord["mode"];
  /** Opponent as saved in the match record. */
  readonly recordOpponent: string;

  /** The local player threw: resolve it. */
  localThrow(state: State, shot: Shot, aim: Aim): Promise<ResolvedThrow>;
  /** The opponent is up: resolve their next throw (rejects with `OpponentLeft` online). */
  opponentThrow(state: State): Promise<ResolvedThrow>;
  destroy(): void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The CPU pauses to "think" before aiming. */
const CPU_THINK_MS = 600;

/** You against the CPU. Everything is decided locally from one seeded generator. */
export class SoloDriver implements MatchDriver {
  readonly localSide: Side = 0;
  readonly opponentName = "CPU";
  readonly opponentTag = "CPU";
  readonly mode = "solo" as const;
  readonly opponentCardName: string;
  readonly modeLabel: string;
  readonly recordOpponent: string;
  private readonly rng: Rng;
  private disposed = false;

  constructor(
    readonly nickname: string,
    private readonly level: CpuLevel,
    seed: number,
  ) {
    this.rng = createRng(seed);
    this.opponentCardName = levelLabel(level);
    this.modeLabel = `Solo · CPU ${level}`;
    this.recordOpponent = `CPU ${level}`;
  }

  async localThrow(state: State, shot: Shot, aim: Aim): Promise<ResolvedThrow> {
    return {
      side: this.localSide,
      shot,
      result: this.resolve(state, this.localSide, shot, aim),
      preview: null,
    };
  }

  async opponentThrow(state: State): Promise<ResolvedThrow> {
    const side = opponent(this.localSide);
    await sleep(CPU_THINK_MS);
    const choice = chooseThrow(state, side, this.level, this.rng);
    const result = this.resolve(state, side, choice.shot, choice.aim);
    return { side, shot: choice.shot, result, preview: this.disposed ? null : choice.aim };
  }

  destroy(): void {
    this.disposed = true;
  }

  private resolve(state: State, side: Side, shot: Shot, aim: Aim): ThrowResult {
    const defender = opponent(side);
    return resolveThrow(BALL_START[side], aim, shot, defender, state.cups[defender], this.rng);
  }
}

/**
 * Two players over an `OnlineSession`. The host rolls every throw (its own and the guest's) and
 * sends the outcome; the guest asks the host and waits for the answer.
 */
export class OnlineDriver implements MatchDriver {
  readonly opponentTag = "OPP";
  readonly modeLabel = "Online · 1 v 1";
  readonly mode = "online" as const;
  private readonly rng = createRng(Date.now());

  constructor(
    private readonly session: OnlineSession,
    readonly nickname: string,
  ) {}

  get localSide(): Side {
    return this.session.localSide;
  }

  get opponentName(): string {
    return this.session.opponentName ?? "Opponent";
  }

  get opponentCardName(): string {
    return this.opponentName;
  }

  get recordOpponent(): string {
    return this.opponentName;
  }

  async localThrow(state: State, shot: Shot, aim: Aim): Promise<ResolvedThrow> {
    if (this.session.role === "host") return this.hostResolve(state, this.localSide, shot, aim);
    this.session.sendThrow(shot, aim);
    return this.fromOutcome(await this.session.nextOutcome());
  }

  async opponentThrow(state: State): Promise<ResolvedThrow> {
    if (this.session.role === "host") {
      const request = await this.session.nextThrowRequest();
      return this.hostResolve(state, opponent(this.localSide), request.shot, request.aim);
    }
    return this.fromOutcome(await this.session.nextOutcome());
  }

  destroy(): void {
    // The session outlives the match (rematch); screens that own it leave it.
  }

  private hostResolve(state: State, side: Side, shot: Shot, aim: Aim): ResolvedThrow {
    const defender = opponent(side);
    const result = resolveThrow(
      BALL_START[side],
      aim,
      shot,
      defender,
      state.cups[defender],
      this.rng,
    );
    this.session.sendOutcome({ side, shot, result });
    return { side, shot, result, preview: null };
  }

  private fromOutcome(outcome: { side: Side; shot: Shot; result: ThrowResult }): ResolvedThrow {
    return { ...outcome, preview: null };
  }
}
