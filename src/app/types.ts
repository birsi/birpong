import type { CpuLevel } from "../domain/cpu";
import type { Side } from "../domain/engine";

/** A screen owns whatever it puts into the root element and cleans up in `destroy`. */
export interface Screen {
  destroy(): void;
}

/** Where a screen can send the player. Implemented by `App`. */
export interface Navigator {
  /** The start screen, optionally with a message (e.g. why a room ended). */
  home(notice?: string): void;
  firstThrow(level: CpuLevel): void;
  match(level: CpuLevel, first: Side): void;
  stats(): void;
  createRoom(): void;
  joinRoom(code: string): void;
  /** Both players are in the lobby and the first throw is decided: begin the online match. */
  startOnline(first: Side): void;
}
