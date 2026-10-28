import type { Side } from "../domain/engine";
import type { CpuLevel } from "../domain/cpu";

/** The human always plays side 0 (left end) in solo mode; the CPU plays side 1. */
export const HUMAN: Side = 0;
export const CPU: Side = 1;

export interface MatchSetup {
  nickname: string;
  level: CpuLevel;
  /** Who throws first, decided on the first-throw screen. */
  first: Side;
  seed: number;
}
