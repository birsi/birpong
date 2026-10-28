// Only this one Phaser module is imported at runtime: it has no browser dependencies, so the
// throw model still runs under Vitest and Node. Importing "phaser" itself would touch `window`.
import RandomDataGenerator from "phaser-rng";

export type Rng = Phaser.Math.RandomDataGenerator;

/** Seeded generator: the same seed always gives the same sequence. */
export function createRng(seed: string | number): Rng {
  return new RandomDataGenerator([String(seed)]);
}

/** Standard normal sample (Box-Muller). Phaser's own `normal()` is uniform in [-1, 1], not Gaussian. */
export function gaussian(rng: Rng): number {
  const u = 1 - rng.frac(); // avoid log(0)
  const v = rng.frac();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
