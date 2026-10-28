export type CpuLevel = "easy" | "medium" | "hard";

export const CPU_LEVELS: readonly CpuLevel[] = ["easy", "medium", "hard"];

export interface LevelTuning {
  /** Typical error of the CPU's aim at the landing point, in cm (on top of the throw's own scatter). */
  aimError: number;
  /** Chance of going for a bounce shot when the target is within the bounce power window. */
  bounceChance: number;
}

// Placeholders to tune together with the throw model.
export const LEVEL_TUNING: Record<CpuLevel, LevelTuning> = {
  easy: { aimError: 7, bounceChance: 0 },
  medium: { aimError: 3.5, bounceChance: 0.15 },
  hard: { aimError: 1, bounceChance: 0.35 },
};
