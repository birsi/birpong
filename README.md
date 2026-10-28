# Birpong

Online beer pong for the browser. 2D, bird's-eye view, minimal and a little retro.

Throw by dragging back from the ball and letting go: direction sets the aim, pull length sets the power. Choose an air shot or a bounce shot, sink the cups, and try for balls back.

> **Status:** early development. The rules engine is done and tested. The table, throwing and everything after it are not built yet.

## Features (planned)

- **Solo** against a CPU on easy, medium or hard.
- **Online** 1 v 1 in a room joined by a 4-character code or invite link. No account needed.
- **Guest stats** stored on your device: hit rate, streaks, balls back, hits per rack position, recent matches.
- **Records per opponent** as a local leaderboard.
- No accounts: you are a guest with a nickname, and nothing is stored on a server.

## Rules

Table 240 x 60 cm, 10 cups per side in a 4-3-2-1 pyramid, 2 balls per turn.

- An air shot that hits removes 1 cup. A bounce shot that hits removes 2.
- If both balls of a turn hit, you throw both again (once per turn).
- At 6, 3 or 1 cups left, the cups are re-racked into a pyramid.
- If the side that threw first clears the rack, the other side gets one last turn. If that clears the rack too, sudden death decides.

The full rules, project decisions and open questions are in [`docs/SPEC.md`](docs/SPEC.md). The screen designs are in [`docs/design/`](docs/design/).

## Getting started

Requires Node.js 20 or newer.

```sh
npm install
npm run dev            # play against the CPU in the browser
npm run check          # typecheck + lint + tests
npm test               # tests only
npm run format         # Prettier
npm run build          # production bundle
```

## Stack

TypeScript, Vite, Vitest. The table scene runs on [Phaser 4](https://phaser.io); the rules engine and throw model run without a browser (the throw model only uses Phaser's seeded `RandomDataGenerator`).

## Project layout

```
docs/
  SPEC.md            rules, modes, screens, open decisions
  design/            static HTML screens, PNG renders, colour tokens
src/
  domain/            pure game logic: no DOM, no Phaser scene
    engine/          rules state machine (rps, throw, turn, sudden death) and tests
    throw/           aim, scatter, cup rim and ricochet model, seeded RNG, tuning constants
    cpu/             CPU opponent: target, shot and aim per level
    stats/           per-match summary and totals
  storage/           localStorage stores (matches, nickname) behind interfaces
  app/               screen manager and screens (home, first throw, result, stats)
  game/              Phaser: TableScene composes parts/ (backdrop, cups, aim, ball flight, drag)
  match/             MatchController wires domain, game and UI; narration and view models are pure
  ui/                DOM components and styles
```

Dependencies point one way: `domain` <- `game` and `ui` <- `match` <- `main.ts`.
The engine is a deterministic state machine that knows nothing about rendering or networking;
solo, online and stats will all run on it. Throw outcomes come from a seeded model in
`domain/throw`, not from simulated physics, so the same seed always replays the same match.

## Roadmap

1. Rules engine with tests (done)
2. Table rendering and the drag throw (done, on Phaser 4)
3. CPU opponent, three levels (done)
4. Local stats (done)
5. Online rooms
6. Local leaderboard (records per opponent)

## License

See [`LICENSE`](LICENSE).
