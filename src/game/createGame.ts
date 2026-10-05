import Phaser from "phaser";
import { SCENE_H, SCENE_W, U } from "./layout";
import type { TableScene } from "./TableScene";

/** Boots Phaser inside `parent`, scaled to fit it. Physics modules are intentionally not enabled. */
export function createGame(parent: HTMLElement, scene: TableScene): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: SCENE_W * U,
    height: SCENE_H * U,
    banner: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene,
  });
}
