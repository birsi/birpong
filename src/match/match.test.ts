import { describe, expect, it } from "vitest";
import { initialState, reduce, type Action, type State } from "../domain/engine";
import { hint, rimNote, turnSummary, turnTitle } from "./narration";
import { newMatch } from "./newMatch";
import { logRows, scoreView, turnView } from "./viewModels";

const names = ["You", "CPU"] as const;
const started = (): State => reduce(initialState(), { type: "rps", choices: ["rock", "scissors"] });
const play = (s: State, ...actions: Action[]) => actions.reduce(reduce, s);
const air = (target: number | null): Action => ({ type: "throw", shot: "air", target });

describe("newMatch", () => {
  it("lets the given side throw first", () => {
    expect(newMatch(0).thrower).toBe(0);
    expect(newMatch(1).thrower).toBe(1);
    expect(newMatch(1).first).toBe(1);
  });
});

describe("narration", () => {
  it("titles the turn, last chance, sudden death and the winner", () => {
    const s = started();
    expect(turnTitle(s, names)).toBe("YOUR TURN");
    expect(turnTitle({ ...s, thrower: 1 }, names)).toBe("CPU'S TURN");
    expect(turnTitle({ ...s, phase: "reroll" }, names)).toBe("LAST CHANCE");
    expect(turnTitle({ ...s, suddenDeath: true }, names)).toBe("SUDDEN DEATH");
    expect(turnTitle({ ...s, phase: "over", winner: 1 }, names)).toBe("CPU WINS");
    expect(turnTitle({ ...s, phase: "over", winner: 0 }, names)).toBe("YOU WIN");
  });
  it("gives a hint per shot type", () => {
    expect(hint(started(), "air")).toMatch(/both balls/);
    expect(hint(started(), "bounce")).toMatch(/window/);
  });
  it("describes rim contacts and stays silent otherwise", () => {
    expect(rimNote("rattle-in")).toMatch(/Rattled/);
    expect(rimNote("ricochet")).toMatch(/next cup/);
    expect(rimNote("bounce-out")).toMatch(/bounced out/);
    expect(rimNote("clean")).toBe("");
  });
  it("summarises a turn that sank cups, a miss and balls back", () => {
    const s = started();
    const afterHit = play(s, air(0), air(null));
    expect(turnSummary(play(s, air(0)), afterHit, names)).toBe("You sank 1 cup. 9 left.");
    const afterMiss = play(s, air(null), air(null));
    expect(turnSummary(play(s, air(null)), afterMiss, names)).toBe("You missed.");
    const ballsBack = play(s, air(0), air(1));
    expect(turnSummary(play(s, air(0)), ballsBack, names)).toBe("Both balls hit. Balls back!");
  });
});

describe("view models", () => {
  it("counts standing, hit and removed cups as dots", () => {
    const s = play(started(), air(0));
    const defender = scoreView(s, 1, "CPU");
    expect(defender.standing).toBe(10);
    expect(defender.dots.filter((d) => d === "hit")).toHaveLength(1);
    expect(defender.dots.filter((d) => d === "standing")).toHaveLength(9);
    expect(scoreView(s, 0, "you").dots.every((d) => d === "standing")).toBe(true);
  });
  it("shows the state of both balls in the current round", () => {
    const s = play(started(), air(0));
    const view = turnView(s, "air", "", names, true);
    expect(view.balls?.map((b) => b.kind)).toEqual(["hit", "now"]);
    expect(view.balls?.map((b) => b.label)).toEqual(["Ball 1 hit", "Ball 2 aiming"]);
    expect(turnView({ ...s, phase: "over", winner: 0 }, "air", "", names, true).balls).toBeNull();
  });
  it("says the CPU is aiming on its turn", () => {
    const cpu = { ...started(), thrower: 1 as const };
    expect(turnView(cpu, "air", "", names, false).text).toBe("CPU is aiming…");
  });
  it("prefers the note over the hint", () => {
    expect(turnView(started(), "air", "News!", names, true).text).toBe("News!");
  });
  it("lists the last throws newest first and flags pending hits", () => {
    const s = play(started(), air(0), air(null));
    const rows = logRows(s, names);
    expect(rows.map((r) => r.result)).toEqual(["miss", "hit"]);
    expect(rows[0]?.who).toBe("You");
    const mid = play(started(), air(0));
    expect(logRows(mid, names)[0]?.result).toBe("hit, cup leaves at turn end");
  });
});
