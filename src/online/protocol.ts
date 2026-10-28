import type { Rps, Shot, Side } from "../domain/engine";
import type { Point } from "../domain/geometry";
import type { Aim, Contact, ThrowResult } from "../domain/throw";

export const MAX_NICKNAME_LENGTH = 16;

/**
 * Everything two browsers say to each other. Host is side 0, guest is side 1. Only the host rolls
 * the dice: it answers every throw with an `outcome`, which both sides then play and apply.
 */
export type Message =
  | { t: "hello"; nickname: string } // guest -> host
  | { t: "welcome"; nickname: string } // host -> guest
  | { t: "full" } // host -> a third peer
  | { t: "rps"; choice: Rps }
  | { t: "start"; first: Side } // host -> guest
  | { t: "throw"; shot: Shot; aim: Aim } // guest -> host
  | { t: "outcome"; side: Side; shot: Shot; result: ThrowResult } // host -> guest
  | { t: "rematch" };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isSide = (v: unknown): v is Side => v === 0 || v === 1;
const isShot = (v: unknown): v is Shot => v === "air" || v === "bounce";
const isRps = (v: unknown): v is Rps => v === "rock" || v === "paper" || v === "scissors";
const isPoint = (v: unknown): v is Point => isObj(v) && isNum(v.x) && isNum(v.y);
const CONTACTS: readonly Contact[] = ["none", "clean", "rattle-in", "bounce-out", "ricochet"];
const MAX_BOUNCES = 8;

const isAim = (v: unknown): v is Aim =>
  isObj(v) && isPoint(v.dir) && isNum(v.power) && v.power >= 0 && v.power <= 1 && isPoint(v.handle);

const isResult = (v: unknown): v is ThrowResult =>
  isObj(v) &&
  isPoint(v.landing) &&
  (v.target === null || isNum(v.target)) &&
  CONTACTS.includes(v.contact as Contact) &&
  (v.touched === null || isNum(v.touched)) &&
  (v.deflect === null || isPoint(v.deflect)) &&
  Array.isArray(v.bounces) &&
  v.bounces.length <= MAX_BOUNCES &&
  v.bounces.every(isPoint);

const cleanName = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_NICKNAME_LENGTH) : null;

/** Check a message from the network; anything malformed is dropped (returns null). */
export function parseMessage(raw: unknown): Message | null {
  if (!isObj(raw)) return null;
  switch (raw.t) {
    case "hello":
    case "welcome": {
      const nickname = cleanName(raw.nickname);
      return nickname ? { t: raw.t, nickname } : null;
    }
    case "full":
    case "rematch":
      return { t: raw.t };
    case "rps":
      return isRps(raw.choice) ? { t: "rps", choice: raw.choice } : null;
    case "start":
      return isSide(raw.first) ? { t: "start", first: raw.first } : null;
    case "throw":
      return isShot(raw.shot) && isAim(raw.aim)
        ? { t: "throw", shot: raw.shot, aim: raw.aim }
        : null;
    case "outcome":
      return isSide(raw.side) && isShot(raw.shot) && isResult(raw.result)
        ? { t: "outcome", side: raw.side, shot: raw.shot, result: raw.result }
        : null;
    default:
      return null;
  }
}
