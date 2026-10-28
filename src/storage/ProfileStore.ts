import { safeStorage } from "./safeStorage";

export const DEFAULT_NICKNAME = "guest";
export const MAX_NICKNAME = 16;
const KEY = "birpong.profile";

/** The player's nickname, kept on this device. */
export interface ProfileStore {
  nickname(): string;
  setNickname(nickname: string): void;
}

const clean = (raw: string): string => raw.trim().slice(0, MAX_NICKNAME) || DEFAULT_NICKNAME;

export class LocalProfileStore implements ProfileStore {
  constructor(private readonly storage: Storage | null = safeStorage()) {}

  nickname(): string {
    try {
      const saved = this.storage?.getItem(KEY);
      return saved
        ? clean((JSON.parse(saved) as { nickname?: string }).nickname ?? "")
        : DEFAULT_NICKNAME;
    } catch {
      return DEFAULT_NICKNAME;
    }
  }

  setNickname(nickname: string): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify({ nickname: clean(nickname) }));
    } catch {
      // Storage full or blocked: the nickname just is not remembered.
    }
  }
}
