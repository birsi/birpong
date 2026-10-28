import type { CpuLevel } from "../domain/cpu";
import type { Side } from "../domain/engine";

/** A screen owns whatever it puts into the root element and cleans up in `destroy`. */
export interface Screen {
  destroy(): void;
}

/** Where a screen can send the player. Implemented by `App`. */
export interface Navigator {
  home(): void;
  firstThrow(level: CpuLevel): void;
  match(level: CpuLevel, first: Side): void;
  stats(): void;
}
