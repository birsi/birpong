import type { Point } from "../domain/geometry";

/**
 * The scene is 300 x 70 units: the 240 x 60 cm table at (30, 5) plus the throwing zones around it.
 * One unit is U canvas pixels; the canvas is scaled to fit its parent, so U only sets sharpness.
 */
export const U = 8;
export const SCENE_W = 300;
export const SCENE_H = 70;
export const TABLE_X = 30;
export const TABLE_Y = 5;

export const BALL_RADIUS = 2.2;

/** Table cm to canvas pixels. */
export const toPx = (p: Point): Point => ({ x: (p.x + TABLE_X) * U, y: (p.y + TABLE_Y) * U });
/** Canvas pixels to table cm. */
export const toCm = (x: number, y: number): Point => ({ x: x / U - TABLE_X, y: y / U - TABLE_Y });
