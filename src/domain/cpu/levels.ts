export type CpuLevel = "easy" | "medium" | "hard";

export const CPU_LEVELS: readonly CpuLevel[] = ["easy", "medium", "hard"];

export interface LevelTuning {
  /** Typical error of the CPU's aim at the landing point, in cm (on top of the throw's own scatter). */
  aimError: number;
  /** Chance of going for a bounce shot when the target is within the bounce power window. */
  bounceChance: number;
}

// Tuned by simulating full matches between the levels (500 games each, alternating first throw):
// per ball against a full rack easy sinks about 0.41 cups, medium 0.53, hard 0.74; easy beats
// medium in about 31% of matches, medium beats hard in about 38%, easy beats hard in about 16%.
export const LEVEL_TUNING: Record<CpuLevel, LevelTuning> = {
  easy: { aimError: 3.5, bounceChance: 0 },
  medium: { aimError: 2, bounceChance: 0.25 },
  hard: { aimError: 1, bounceChance: 0.35 },
};
