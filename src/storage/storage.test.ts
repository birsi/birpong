import { describe, expect, it } from "vitest";
import { DEFAULT_NICKNAME, LocalProfileStore, MAX_NICKNAME } from "./ProfileStore";

class FakeStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("LocalProfileStore", () => {
  it("defaults to guest and remembers a nickname", () => {
    const storage = new FakeStorage();
    const store = new LocalProfileStore(storage);
    expect(store.nickname()).toBe(DEFAULT_NICKNAME);
    store.setNickname("  birsi ");
    expect(new LocalProfileStore(storage).nickname()).toBe("birsi");
  });
  it("trims long and empty nicknames", () => {
    const store = new LocalProfileStore(new FakeStorage());
    store.setNickname("x".repeat(40));
    expect(store.nickname()).toHaveLength(MAX_NICKNAME);
    store.setNickname("   ");
    expect(store.nickname()).toBe(DEFAULT_NICKNAME);
  });
  it("survives corrupt data and missing storage", () => {
    const storage = new FakeStorage();
    storage.setItem("birpong.profile", "{not json");
    expect(new LocalProfileStore(storage).nickname()).toBe(DEFAULT_NICKNAME);
    const none = new LocalProfileStore(null);
    none.setNickname("a");
    expect(none.nickname()).toBe(DEFAULT_NICKNAME);
  });
});
