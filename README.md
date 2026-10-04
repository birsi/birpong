# Birpong

Online beer pong for the browser. 2D, bird's-eye view, minimal and a little retro.

Throw by dragging back from the ball and letting go: direction sets the aim, pull length sets the power. Choose an air shot or a bounce shot, sink the cups, and try for balls back.

> **Status:** early development. The rules engine is done and tested. The table, throwing and everything after it are not built yet.

## Features (planned)

- **Solo** against a CPU on easy, medium or hard.
- **Online** 1 v 1 in a room joined by a 4-character code or invite link. No account needed.
- **Guest stats** stored on your device: hit rate, streaks, balls back, hits per rack position.
- Optional sign-in to sync stats and appear on a leaderboard.

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
npm test          # run the engine tests
npm run typecheck
```

`npm run dev` and `npm run build` are wired up but there is no app to show yet.

## Project layout

```
docs/
  SPEC.md          rules, modes, screens, open decisions
  design/          static HTML screens, PNG renders, colour tokens
src/
  engine/          pure rules state machine and tests
```

The engine is a pure, deterministic state machine that knows nothing about rendering or networking. Solo, online and stats will all run on it.

## Roadmap

1. Rules engine with tests (done)
2. Table rendering and the drag throw
3. CPU opponent, three levels
4. Local stats
5. Online rooms
6. Accounts and leaderboard

## License

See [`LICENSE`](LICENSE).
