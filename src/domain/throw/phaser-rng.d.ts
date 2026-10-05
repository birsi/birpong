declare module "phaser-rng" {
  import type Phaser from "phaser";
  const RandomDataGenerator: typeof Phaser.Math.RandomDataGenerator;
  export default RandomDataGenerator;
}
