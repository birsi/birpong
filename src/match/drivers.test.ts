import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce, type Side, type State } from "../domain/engine";
import { aimAt, BALL_START } from "../domain/throw";
import { MemoryHub } from "../online/memoryLink";
import { OnlineSession } from "../online/OnlineSession";
import { OnlineDriver, SoloDriver } from "./drivers";
import { newMatch } from "./newMatch";

afterEach(() => vi.useRealTimers());

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const aimFor = (side: Side) => aimAt(BALL_START[side], { x: side === 0 ? 215 : 25, y: 30 })!;

describe("SoloDriver", () => {
  it("resolves the player's throw at once", async () => {
    const driver = new SoloDriver("ann", "easy", 1);
    const t = await driver.localThrow(newMatch(0), "air", aimFor(0));
    expect(t).toMatchObject({ side: 0, shot: "air", preview: null });
    expect(driver).toMatchObject({
      localSide: 0,
      opponentName: "CPU",
      opponentTag: "CPU",
      mode: "solo",
    });
    expect(driver.recordOpponent).toBe("CPU easy");
    expect(driver.modeLabel).toBe("Solo · CPU easy");
  });

  it("makes the CPU think, then returns its throw with an aim to preview", async () => {
    vi.useFakeTimers();
    const driver = new SoloDriver("ann", "hard", 2);
    const state: State = { ...newMatch(0), thrower: 1 };
    const pending = driver.opponentThrow(state);
    await vi.advanceTimersByTimeAsync(600);
    const t = await pending;
    expect(t.side).toBe(1);
    expect(t.preview).not.toBeNull();
  });

  it("is reproducible for a seed", async () => {
    const a = await new SoloDriver("a", "easy", 5).localThrow(newMatch(0), "air", aimFor(0));
    const b = await new SoloDriver("b", "easy", 5).localThrow(newMatch(0), "air", aimFor(0));
    expect(a.result).toEqual(b.result);
  });
});

describe("OnlineDriver", () => {
  async function pair() {
    const hub = new MemoryHub();
    const host = new OnlineSession(hub.join("host"), "host", "ann");
    const guest = new OnlineSession(hub.join("guest"), "guest", "bob");
    await tick();
    return { host: new OnlineDriver(host, "ann"), guest: new OnlineDriver(guest, "bob") };
  }

  it("knows who is who", async () => {
    const { host, guest } = await pair();
    expect(host).toMatchObject({
      localSide: 0,
      opponentName: "bob",
      mode: "online",
      recordOpponent: "bob",
    });
    expect(guest).toMatchObject({ localSide: 1, opponentName: "ann", opponentTag: "OPP" });
    expect(guest.modeLabel).toBe("Online · 1 v 1");
  });

  it("plays a whole match with the host rolling and both sides ending in the same state", async () => {
    const { host, guest } = await pair();
    let hostState = newMatch(0);
    let guestState = newMatch(0);

    for (let i = 0; i < 60 && hostState.phase !== "over"; i++) {
      const side = hostState.thrower;
      const shot = i % 4 === 0 ? ("bounce" as const) : ("air" as const);
      const [onHost, onGuest] =
        side === 0
          ? [
              await host.localThrow(hostState, shot, aimFor(0)),
              await guest.opponentThrow(guestState),
            ]
          : await Promise.all([
              host.opponentThrow(hostState),
              guest.localThrow(guestState, shot, aimFor(1)),
            ]);

      expect(onGuest.side).toBe(side);
      expect(onGuest.result).toEqual(JSON.parse(JSON.stringify(onHost.result)));
      hostState = reduce(hostState, {
        type: "throw",
        shot: onHost.shot,
        target: onHost.result.target,
      });
      guestState = reduce(guestState, {
        type: "throw",
        shot: onGuest.shot,
        target: onGuest.result.target,
      });
      expect(guestState).toEqual(hostState);
    }
    expect(hostState.log.length).toBeGreaterThan(4);
  });
});
