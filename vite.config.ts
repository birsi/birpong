import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Phaser's package "exports" hides its internals, so this one pure module (no browser access)
// is aliased by path. That lets the throw model use Phaser's RandomDataGenerator under plain Node.
const rng = fileURLToPath(new URL("./node_modules/phaser/src/math/random-data-generator/RandomDataGenerator.js", import.meta.url));

export default defineConfig({
  resolve: { alias: { "phaser-rng": rng } },
  optimizeDeps: { include: ["phaser-rng"] },
});
