import { initialState, reduce, type Rps, type Shot, type Side } from "../domain/engine";
import type { Aim, ThrowResult } from "../domain/throw";
import { Emitter, Inbox } from "./emitter";
import type { PeerId, RoomLink } from "./link";
import type { Message } from "./protocol";

export type Role = "host" | "guest";

/** Where the room is: waiting for the other player, both here, turned away, or over. */
export type Status = "waiting" | "connected" | "full" | "closed";

export interface RpsState {
  mine: Rps | null;
  theirs: Rps | null;
  /** Set once both have picked: who throws first, or null after a tie (pick again). */
  first: Side | null;
}

export class OpponentLeft extends Error {
  constructor() {
    super("The other player left the room.");
  }
}

export interface ThrowRequest {
  shot: Shot;
  aim: Aim;
}

export interface Outcome {
  side: Side;
  shot: Shot;
  result: ThrowResult;
}

const sideOf = (role: Role): Side => (role === "host" ? 0 : 1);

/**
 * One player's end of an online room. It speaks the protocol over a `RoomLink` and keeps what the
 * screens need: who is here, the rock-paper-scissors picks, throw requests and outcomes, rematch.
 * The host is side 0 and the only one that rolls throw outcomes. No DOM, no Phaser.
 */
export class OnlineSession {
  readonly localSide: Side;
  private _status: Status = "waiting";
  private _opponentName: string | null = null;
  private opponent: PeerId | null = null;
  private _rps: RpsState = { mine: null, theirs: null, first: null };
  private rematchMine = false;
  private rematchTheirs = false;

  /** Fires whenever status, opponent or the rock-paper-scissors state changes. */
  readonly changed = new Emitter();
  /** Fires on both sides when the match starts, with who throws first. */
  readonly started = new Emitter<Side>();
  /** Fires when both players have asked for a rematch. */
  readonly rematch = new Emitter();

  private readonly throwRequests = new Inbox<ThrowRequest>();
  private readonly outcomes = new Inbox<Outcome>();
  private readonly picks = new Inbox<number>();
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly link: RoomLink,
    readonly role: Role,
    readonly nickname: string,
  ) {
    this.localSide = sideOf(role);
    this.unsubscribe.push(
      link.onMessage((message, from) => this.receive(message, from)),
      link.onPeerLeave((peer) => this.peerLeft(peer)),
    );
    // The guest introduces itself to whoever is in the room.
    if (role === "guest") {
      this.unsubscribe.push(
        link.onPeerJoin((peer) => link.send({ t: "hello", nickname: this.nickname }, peer)),
      );
    }
  }

  get status(): Status {
    return this._status;
  }

  get opponentName(): string | null {
    return this._opponentName;
  }

  get rps(): RpsState {
    return this._rps;
  }

  // --- First throw ------------------------------------------------------

  /** Pick rock, paper or scissors. After a tie this starts a new round. */
  pickRps(choice: Rps): void {
    if (this._status !== "connected" || this._rps.first !== null) return;
    this.restartAfterTie();
    if (this._rps.mine !== null) return; // already picked, waiting for the other player
    this._rps = { ...this._rps, mine: choice };
    this.link.send({ t: "rps", choice }, this.opponent ?? undefined);
    this.settleRps();
  }

  /** Host only, once the first throw is decided: tell the guest and start. */
  start(): void {
    const first = this._rps.first;
    if (this.role !== "host" || first === null || this._status !== "connected") return;
    this.link.send({ t: "start", first }, this.opponent ?? undefined);
    this.started.emit(first);
  }

  // --- Match ------------------------------------------------------------

  /** Guest: ask the host to resolve a throw. */
  sendThrow(shot: Shot, aim: Aim): void {
    this.link.send({ t: "throw", shot, aim }, this.opponent ?? undefined);
  }

  /** Host: tell the guest what happened to a throw (its own or the guest's). */
  sendOutcome(outcome: Outcome): void {
    this.link.send({ t: "outcome", ...outcome }, this.opponent ?? undefined);
  }

  /** Host: the guest's next throw request. Rejects with `OpponentLeft`. */
  nextThrowRequest(): Promise<ThrowRequest> {
    return this.throwRequests.next();
  }

  /** Guest: the next outcome from the host. Rejects with `OpponentLeft`. */
  nextOutcome(): Promise<Outcome> {
    return this.outcomes.next();
  }

  /** The local thrower's second cup after a bounce hit. */
  sendPick(cup: number): void {
    this.link.send({ t: "pick", cup }, this.opponent ?? undefined);
  }

  /** The other player's second cup after their bounce hit. Rejects with `OpponentLeft`. */
  nextPick(): Promise<number> {
    return this.picks.next();
  }

  // --- After the match --------------------------------------------------

  requestRematch(): void {
    this.rematchMine = true;
    this.link.send({ t: "rematch" }, this.opponent ?? undefined);
    this.settleRematch();
  }

  leave(): void {
    this.close(false);
    this.link.leave();
  }

  // --- Incoming ---------------------------------------------------------

  private receive(message: Message, from: PeerId): void {
    if (message.t === "hello") return this.onHello(message.nickname, from);
    if (message.t === "welcome" && this.role === "guest")
      return this.onWelcome(message.nickname, from);
    if (message.t === "full" && this.role === "guest" && this._status === "waiting") {
      this._status = "full";
      this.changed.emit();
      return;
    }
    if (from !== this.opponent) return; // only the other player may talk to us from here on

    switch (message.t) {
      case "rps":
        this.onRps(message.choice);
        break;
      case "start":
        if (this.role === "guest") this.started.emit(message.first);
        break;
      case "throw":
        if (this.role === "host") this.throwRequests.push({ shot: message.shot, aim: message.aim });
        break;
      case "outcome":
        if (this.role === "guest") {
          this.outcomes.push({ side: message.side, shot: message.shot, result: message.result });
        }
        break;
      case "pick":
        this.picks.push(message.cup);
        break;
      case "rematch":
        this.rematchTheirs = true;
        this.settleRematch();
        break;
    }
  }

  private onHello(nickname: string, from: PeerId): void {
    if (this.role !== "host") return;
    if (this.opponent !== null && this.opponent !== from) {
      this.link.send({ t: "full" }, from);
      return;
    }
    this.opponent = from;
    this._opponentName = nickname;
    this._status = "connected";
    this.link.send({ t: "welcome", nickname: this.nickname }, from);
    this.changed.emit();
  }

  private onWelcome(nickname: string, from: PeerId): void {
    if (this.opponent !== null) return;
    this.opponent = from;
    this._opponentName = nickname;
    this._status = "connected";
    this.changed.emit();
  }

  private peerLeft(peer: PeerId): void {
    if (peer === this.opponent) this.close(true);
  }

  private close(notify: boolean): void {
    if (this._status === "closed") return;
    this._status = "closed";
    const gone = new OpponentLeft();
    this.throwRequests.close(gone);
    this.outcomes.close(gone);
    this.picks.close(gone);
    for (const off of this.unsubscribe) off();
    if (notify) this.changed.emit();
  }

  // --- Rock, paper, scissors -------------------------------------------

  private onRps(choice: Rps): void {
    if (this._rps.first !== null) return; // already decided
    this.restartAfterTie();
    this._rps = { ...this._rps, theirs: choice };
    this.settleRps();
  }

  /** After a tie both picks are cleared as soon as someone picks again. */
  private restartAfterTie(): void {
    if (this._rps.first === null && this._rps.mine !== null && this._rps.theirs !== null) {
      this._rps = { mine: null, theirs: null, first: null };
    }
  }

  private settleRps(): void {
    const { mine, theirs } = this._rps;
    if (mine !== null && theirs !== null) {
      const choices: [Rps, Rps] = this.role === "host" ? [mine, theirs] : [theirs, mine];
      const decided = reduce(initialState(), { type: "rps", choices });
      this._rps = { mine, theirs, first: decided.phase === "rps" ? null : decided.first };
    }
    this.changed.emit();
  }

  private settleRematch(): void {
    if (!(this.rematchMine && this.rematchTheirs)) return;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this._rps = { mine: null, theirs: null, first: null };
    this.rematch.emit();
    this.changed.emit();
  }
}
