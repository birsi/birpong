import { safeStorage } from "./safeStorage";

export const MIN_NICKNAME = 2;
export const MAX_NICKNAME = 16;
/** Names that say nothing about who is playing; "guest" is what everyone would pick otherwise. */
const RESERVED = ["guest", "you", "cpu", "player", "opponent"];
const KEY = "birpong.profile";

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Trim, collapse spaces and check a nickname someone typed. */
export function checkNickname(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < MIN_NICKNAME || name.length > MAX_NICKNAME) {
    return { ok: false, reason: `Pick a name with ${MIN_NICKNAME} to ${MAX_NICKNAME} characters.` };
  }
  if (RESERVED.includes(name.toLowerCase())) {
    return { ok: false, reason: `"${name}" is not a real name. Pick your own.` };
  }
  return { ok: true, name };
}

/** The player's nickname, kept on this device. There is no default: a name has to be chosen. */
export interface ProfileStore {
  /** The saved name, or null until a valid one has been chosen. */
  nickname(): string | null;
  /** Save the name if it is valid; the result says whether it was and why not. */
  setNickname(raw: string): NameCheck;
}

export class LocalProfileStore implements ProfileStore {
  constructor(private readonly storage: Storage | null = safeStorage()) {}

  nickname(): string | null {
    try {
      const saved = this.storage?.getItem(KEY);
      if (!saved) return null;
      const check = checkNickname((JSON.parse(saved) as { nickname?: string }).nickname ?? "");
      return check.ok ? check.name : null;
    } catch {
      return null;
    }
  }

  setNickname(raw: string): NameCheck {
    const check = checkNickname(raw);
    if (!check.ok) return check;
    try {
      this.storage?.setItem(KEY, JSON.stringify({ nickname: check.name }));
    } catch {
      // Storage full or blocked: the name just is not remembered.
    }
    return check;
  }
}
