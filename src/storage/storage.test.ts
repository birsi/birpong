import { describe, expect, it } from "vitest";
import type { MatchRecord } from "../domain/stats";
import { FakeStorage } from "./FakeStorage";
import { LocalStatsStore, MAX_RECORDS, MemoryStatsStore } from "./StatsStore";
import { checkNickname, LocalProfileStore, MAX_NICKNAME } from "./ProfileStore";

describe("checkNickname", () => {
  it("accepts a real name and tidies it", () => {
    expect(checkNickname("  birsi  ")).toEqual({ ok: true, name: "birsi" });
    expect(checkNickname("anna   marie")).toEqual({ ok: true, name: "anna marie" });
  });
  it("asks for a name when nothing is entered", () => {
    expect(checkNickname("")).toEqual({ ok: false, reason: "Please enter your name to play." });
    expect(checkNickname("   ")).toEqual({ ok: false, reason: "Please enter your name to play." });
  });
  it("rejects too short and too long names", () => {
    expect(checkNickname("a").ok).toBe(false);
    expect(checkNickname("   ").ok).toBe(false);
    expect(checkNickname("x".repeat(MAX_NICKNAME + 1)).ok).toBe(false);
    expect(checkNickname("x".repeat(MAX_NICKNAME)).ok).toBe(true);
  });
  it("rejects placeholder names in any case", () => {
    for (const name of ["guest", "GUEST", "Guest ", "you", "CPU", "player", "Opponent"]) {
      expect(checkNickname(name).ok).toBe(false);
    }
    expect(checkNickname("guesty").ok).toBe(true);
  });
});

describe("LocalProfileStore", () => {
  it("has no name until one is chosen, then remembers it", () => {
    const storage = new FakeStorage();
    const store = new LocalProfileStore(storage);
    expect(store.nickname()).toBeNull();
    expect(store.setNickname("  birsi ")).toEqual({ ok: true, name: "birsi" });
    expect(new LocalProfileStore(storage).nickname()).toBe("birsi");
  });
  it("does not save an invalid name and keeps the old one", () => {
    const store = new LocalProfileStore(new FakeStorage());
    store.setNickname("birsi");
    expect(store.setNickname("guest").ok).toBe(false);
    expect(store.setNickname("x").ok).toBe(false);
    expect(store.nickname()).toBe("birsi");
  });
  it("ignores a saved placeholder name from an older version", () => {
    const storage = new FakeStorage();
    storage.setItem("birpong.profile", JSON.stringify({ nickname: "guest" }));
    expect(new LocalProfileStore(storage).nickname()).toBeNull();
  });
  it("survives corrupt data and missing storage", () => {
    const storage = new FakeStorage();
    storage.setItem("birpong.profile", "{not json");
    expect(new LocalProfileStore(storage).nickname()).toBeNull();
    const none = new LocalProfileStore(null);
    expect(none.setNickname("anna").ok).toBe(true);
    expect(none.nickname()).toBeNull();
  });
});

describe("LocalStatsStore", () => {
  const record = (id: string): MatchRecord => ({
    id,
    date: "2026-10-04T10:00:00.000Z",
    mode: "solo",
    opponent: "CPU easy",
    result: "win",
    you: {
      throws: 1,
      hits: 1,
      bounceHits: 0,
      ballsBack: 0,
      bestStreak: 1,
      cupsSunk: 1,
      rackHits: Array(10).fill(0),
    },
    opp: {
      throws: 1,
      hits: 0,
      bounceHits: 0,
      ballsBack: 0,
      bestStreak: 0,
      cupsSunk: 0,
      rackHits: Array(10).fill(0),
    },
  });

  it("saves matches and loads them back in a new instance", () => {
    const storage = new FakeStorage();
    new LocalStatsStore(storage).add(record("a"));
    new LocalStatsStore(storage).add(record("b"));
    expect(new LocalStatsStore(storage).load().map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("keeps only the newest matches", () => {
    const store = new LocalStatsStore(new FakeStorage());
    for (let i = 0; i < MAX_RECORDS + 3; i++) store.add(record(`m${i}`));
    const ids = store.load().map((r) => r.id);
    expect(ids).toHaveLength(MAX_RECORDS);
    expect(ids[0]).toBe("m3");
  });

  it("clears", () => {
    const store = new LocalStatsStore(new FakeStorage());
    store.add(record("a"));
    store.clear();
    expect(store.load()).toEqual([]);
  });

  it("ignores corrupt, foreign-version and malformed data", () => {
    const storage = new FakeStorage();
    const store = new LocalStatsStore(storage);
    storage.setItem("birpong.matches", "{nope");
    expect(store.load()).toEqual([]);
    storage.setItem("birpong.matches", JSON.stringify({ version: 99, matches: [record("a")] }));
    expect(store.load()).toEqual([]);
    storage.setItem(
      "birpong.matches",
      JSON.stringify({ version: 1, matches: [record("a"), { id: 3 }, null] }),
    );
    expect(store.load().map((r) => r.id)).toEqual(["a"]);
  });

  it("does not crash without storage or when writes fail", () => {
    const none = new LocalStatsStore(null);
    none.add(record("a"));
    expect(none.load()).toEqual([]);
    const full = new FakeStorage();
    full.setItem = () => {
      throw new Error("quota");
    };
    expect(() => new LocalStatsStore(full).add(record("a"))).not.toThrow();
  });
});

describe("MemoryStatsStore", () => {
  it("behaves like a store", () => {
    const store = new MemoryStatsStore();
    expect(store.load()).toEqual([]);
  });
});
