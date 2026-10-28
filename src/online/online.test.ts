import { describe, expect, it } from "vitest";
import { initialState, reduce, type Side } from "../domain/engine";
import { aimAt, BALL_START, createRng, resolveThrow, type ThrowResult } from "../domain/throw";
import { MemoryHub } from "./memoryLink";
import { OnlineSession, OpponentLeft } from "./OnlineSession";
import { parseMessage } from "./protocol";
import {
  generateRoomCode,
  inviteLink,
  isRoomCode,
  normalizeRoomCode,
  roomCodeFromSearch,
} from "./roomCode";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** A host and a guest in one in-memory room, already introduced to each other. */
async function room() {
  const hub = new MemoryHub();
  const host = new OnlineSession(hub.join("host"), "host", "ann");
  const guest = new OnlineSession(hub.join("guest"), "guest", "bob");
  await tick();
  return { hub, host, guest };
}

describe("room codes", () => {
  it("generates valid four-character codes", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode(() => rng.frac());
      expect(isRoomCode(code)).toBe(true);
    }
  });
  it("normalises what people type", () => {
    expect(normalizeRoomCode(" k7-qm ")).toBe("K7QM");
    expect(normalizeRoomCode("0o1i")).toBe(""); // look-alikes are not part of the alphabet
    expect(normalizeRoomCode("abcdefgh")).toBe("ABCD");
    expect(isRoomCode("K7Q")).toBe(false);
  });
  it("builds and reads invite links", () => {
    expect(inviteLink("https://birpong.example", "K7QM")).toBe("https://birpong.example/?r=K7QM");
    expect(roomCodeFromSearch("?r=k7qm")).toBe("K7QM");
    expect(roomCodeFromSearch("?r=nope")).toBeNull();
    expect(roomCodeFromSearch("")).toBeNull();
  });
});

describe("parseMessage", () => {
  it("accepts well-formed messages", () => {
    expect(parseMessage({ t: "hello", nickname: " bob " })).toEqual({
      t: "hello",
      nickname: "bob",
    });
    expect(parseMessage({ t: "rps", choice: "rock" })).toEqual({ t: "rps", choice: "rock" });
    expect(parseMessage({ t: "start", first: 1 })).toEqual({ t: "start", first: 1 });
    expect(parseMessage({ t: "rematch" })).toEqual({ t: "rematch" });
  });
  it("truncates long nicknames", () => {
    const m = parseMessage({ t: "hello", nickname: "x".repeat(50) });
    expect(m && m.t === "hello" && m.nickname).toHaveLength(16);
  });
  it("drops anything malformed", () => {
    for (const bad of [
      null,
      "hello",
      42,
      {},
      { t: "nope" },
      { t: "hello" },
      { t: "hello", nickname: "   " },
      { t: "rps", choice: "lizard" },
      { t: "start", first: 2 },
      { t: "throw", shot: "air", aim: { dir: { x: 1, y: 0 }, power: 2, handle: { x: 0, y: 0 } } },
      { t: "throw", shot: "lob", aim: { dir: { x: 1, y: 0 }, power: 0.5, handle: { x: 0, y: 0 } } },
      { t: "outcome", side: 0, shot: "air", result: { landing: { x: 1 } } },
    ]) {
      expect(parseMessage(bad)).toBeNull();
    }
  });
  it("round-trips a real throw result", () => {
    const state = reduce(initialState(), { type: "rps", choices: ["rock", "scissors"] });
    const aim = aimAt(BALL_START[0], { x: 215, y: 30 })!;
    const result = resolveThrow(BALL_START[0], aim, "air", 1, state.cups[1], createRng(3));
    const wire = JSON.parse(JSON.stringify({ t: "outcome", side: 0, shot: "air", result }));
    expect(parseMessage(wire)).toEqual({ t: "outcome", side: 0, shot: "air", result });
  });
});

describe("OnlineSession handshake", () => {
  it("introduces host and guest to each other", async () => {
    const { host, guest } = await room();
    expect(host.status).toBe("connected");
    expect(guest.status).toBe("connected");
    expect(host.opponentName).toBe("bob");
    expect(guest.opponentName).toBe("ann");
    expect([host.localSide, guest.localSide]).toEqual([0, 1]);
  });

  it("stays waiting until someone arrives", () => {
    const hub = new MemoryHub();
    expect(new OnlineSession(hub.join("host"), "host", "ann").status).toBe("waiting");
  });

  it("turns a third player away", async () => {
    const { hub, host } = await room();
    const third = new OnlineSession(hub.join("third"), "guest", "cat");
    await tick();
    expect(third.status).toBe("full");
    expect(host.opponentName).toBe("bob");
  });
});

describe("rock, paper, scissors", () => {
  it("agrees on who throws first", async () => {
    const { host, guest } = await room();
    host.pickRps("rock");
    guest.pickRps("scissors");
    await tick();
    expect(host.rps.first).toBe(0);
    expect(guest.rps.first).toBe(0);
    guest.pickRps("paper"); // already decided: ignored
    expect(guest.rps.mine).toBe("scissors");
  });

  it("lets the guest win too", async () => {
    const { host, guest } = await room();
    guest.pickRps("paper");
    host.pickRps("rock");
    await tick();
    expect([host.rps.first, guest.rps.first]).toEqual([1, 1]);
  });

  it("replays a tie", async () => {
    const { host, guest } = await room();
    host.pickRps("rock");
    guest.pickRps("rock");
    await tick();
    expect(host.rps).toMatchObject({ mine: "rock", theirs: "rock", first: null });
    host.pickRps("paper");
    await tick();
    expect(host.rps).toMatchObject({ mine: "paper", theirs: null, first: null });
    guest.pickRps("rock");
    await tick();
    expect([host.rps.first, guest.rps.first]).toEqual([0, 0]);
  });

  it("starts the match on both sides, host first to press start", async () => {
    const { host, guest } = await room();
    const seen: Side[] = [];
    host.started.on((first) => seen.push(first));
    guest.started.on((first) => seen.push(first));
    host.start(); // not decided yet: nothing happens
    host.pickRps("rock");
    guest.pickRps("scissors");
    await tick();
    guest.start(); // only the host may start
    host.start();
    await tick();
    expect(seen).toEqual([0, 0]);
  });
});

describe("playing a match over the link", () => {
  it("keeps both sides in identical states when only the host rolls", async () => {
    const { host, guest } = await room();
    const rng = createRng(21);
    let hostState = reduce(initialState(), { type: "rps", choices: ["rock", "scissors"] });
    let guestState = hostState;

    for (let i = 0; i < 40 && hostState.phase !== "over"; i++) {
      const side = hostState.thrower;
      const defender: Side = side === 0 ? 1 : 0;
      const aim = aimAt(BALL_START[side], { x: side === 0 ? 215 : 25, y: 30 })!;
      const shot = i % 3 === 0 ? ("bounce" as const) : ("air" as const);

      let outcome: { side: Side; shot: typeof shot; result: ThrowResult };
      if (side === 0) {
        // The host throws: it rolls and tells the guest.
        const result = resolveThrow(
          BALL_START[0],
          aim,
          shot,
          defender,
          hostState.cups[defender],
          rng,
        );
        outcome = { side, shot, result };
        host.sendOutcome(outcome);
      } else {
        // The guest asks; the host rolls and answers.
        guest.sendThrow(shot, aim);
        const request = await host.nextThrowRequest();
        expect(request.shot).toBe(shot);
        const result = resolveThrow(
          BALL_START[1],
          request.aim,
          request.shot,
          defender,
          hostState.cups[defender],
          rng,
        );
        outcome = { side, shot, result };
        host.sendOutcome(outcome);
      }
      const received = await guest.nextOutcome();
      expect(received).toEqual(JSON.parse(JSON.stringify(outcome)));
      hostState = reduce(hostState, { type: "throw", shot, target: outcome.result.target });
      guestState = reduce(guestState, { type: "throw", shot, target: received.result.target });
      expect(guestState).toEqual(hostState);
    }
    expect(hostState.log.length).toBeGreaterThan(2);
  });
});

describe("leaving", () => {
  it("rejects waiting readers and reports closed when the other player leaves", async () => {
    const { host, guest } = await room();
    const pending = host.nextThrowRequest();
    let notified = 0;
    host.changed.on(() => notified++);
    guest.leave();
    await expect(pending).rejects.toBeInstanceOf(OpponentLeft);
    expect(host.status).toBe("closed");
    expect(notified).toBeGreaterThan(0);
    await expect(host.nextThrowRequest()).rejects.toBeInstanceOf(OpponentLeft);
  });
});

describe("rematch", () => {
  it("needs both players, then resets the first throw", async () => {
    const { host, guest } = await room();
    host.pickRps("rock");
    guest.pickRps("scissors");
    await tick();
    let rematches = 0;
    host.rematch.on(() => rematches++);
    guest.rematch.on(() => rematches++);
    host.requestRematch();
    await tick();
    expect(rematches).toBe(0);
    guest.requestRematch();
    await tick();
    expect(rematches).toBe(2);
    expect(host.rps).toEqual({ mine: null, theirs: null, first: null });
    expect(guest.rps).toEqual({ mine: null, theirs: null, first: null });
  });
});
