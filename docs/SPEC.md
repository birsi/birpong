# Birpong spec

Birpong is an online, playable beer pong game for the browser: 2D, bird's-eye view, minimal and slightly retro. It is built in iterations. This file records what has been decided, what the design shows, and what is still open.

Status: all six planned iterations are built (rules engine, table and drag throw, solo CPU on three levels, local stats, online rooms, local leaderboard). The game is on `main` and ready to deploy as a static site; it has not been deployed yet. What is left is in "Open decisions". There are no accounts and none are planned: everything a player has lives in their own browser.

## Sources

- Rules: Beer Pong Austria game rules, https://www.beerpongaustria.com/beer-pong-austria-game-rules/
- Design: `docs/design/` (standalone HTML per screen, PNG renders in `docs/design/screens/`, colour tokens in `docs/design/theme.css`)

The rule summary below was taken from the page above and then adjusted by project decisions. Where this file and the page disagree on a point not listed under "Project decisions", re-read the page.

## Rules as implemented

### Table and cups

- Table 240 cm x 60 cm, seen from above, long axis horizontal.
- 10 cups per side in a pyramid of 4-3-2-1. The row of 4 is at the table end, the single cup (the tip) points to the centre.
- Each player throws from behind the rear edge of their own end.

### Turn

- A turn is 2 balls. In all current modes one player throws both.
- A hit cup stays on the table until the turn's throws are complete, then it is removed.
- Air shot: thrown directly at a cup. A hit removes 1 cup.
- Bounce shot: touches the table before the cup. A hit removes 2 cups: the cup that was hit and the nearest other standing cup that is not already hit this turn. The thrower clicks the second cup on the table. It may be any other standing cup not already hit this turn. If only one such cup is left, or the CPU threw, it is taken automatically (the nearest).
- Balls back: if both balls of a turn hit, the thrower gets both balls back and throws again. This happens at most once per turn, and not in the re-roll.
- If every cup the other side has left is already hit this turn, the turn ends at once: there is nothing more to throw at, so no second ball and no balls back, and the cups are removed.
- After the turn (and any balls-back round), the other side throws.

### Cup contact

Where a ball lands decides what it does. Distances are measured from the cup centre.

- Core: a clean drop, the cup is hit.
- Rim band (between the core and the cup edge): the ball rattles in (a hit) or bounces out (a miss). The closer to the edge, the likelier it bounces out.
- Ricochet: a ball that bounces off a rim has a low chance to kick into a neighbouring cup in its kick direction. That cup is hit.
- A ball that does not drop in and is still inside the rack area bounces off the cups and out of the rack before it comes to rest.
- A bounce shot thrown outside the power window never hits (too soft dies on the table, too hard clears the rack).

### Re-rack

- When a side has 6, 3 or 1 cups left after a turn, its cups are re-formed into a pyramid: 3-2-1, 2-1, or a single cup.
- A re-rack happens only once the whole turn is over, including a balls-back round.

### Start and end

- First throw is decided by rock, paper, scissors, best of one. A tie is replayed. The winner throws first.
- The game ends when one side has no cups left.
- Re-roll: if the side that threw first clears the rack, the other side gets one last turn with both balls (no balls back).
- Sudden death: if the re-roll also clears the rack, both sides get a fresh 3-cup rack and equal turns, the side that threw first starts. After both have thrown, the side with more cups left wins; a tie plays another pair of turns.

### Project decisions (these override or interpret the source)

| Topic                         | Decision                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Re-rack position              | The pyramid is rebuilt from the tip of the rack (nearest the centre line), not from the table end. |
| Re-rack timing                | Only after the whole turn, including a balls-back round.                                          |
| Last cups already hit         | The turn ends at once: no second ball, no balls back. The source only says cups are removed after both throws and does not cover this case. |
| Both balls in the same cup    | Only that one cup is removed, and balls back still applies.                                       |
| Second cup after a bounce hit | The thrower picks any other standing cup not already hit this turn. The CPU and a lone remaining cup are automatic (nearest). |
| Re-roll that clears the rack  | Sudden death (see "Start and end"). The source defines no overtime.                               |
| Bounce without defence        | Bounce stays worth 2 cups but is harder to land than an air shot.                                 |
| Defending and blowing         | Dropped. No blocking of bounce shots, no blowing out a circling ball.                             |
| Solo first throw              | Rock, paper, scissors against the CPU, same as online.                                            |
| Team size                     | 1 v 1; the one player throws both balls. The source rules are 2 v 2.                              |
| Time limit                    | Dropped. Matches have no clock; the lobby design no longer shows one.                             |
| Accounts                      | None. Players have a nickname, which they must choose before playing (no anonymous guests).        |
| Stats and leaderboard         | Stored only in the player's own browser. Nothing is stored on a server.                           |

### Not applicable in a digital game

Physical fouls from the source (touching the table, knocking over own cups, spectator interference, elbow position) have no input that could cause them. The "Foul, cup lost" banner in the design is dropped.

## Modes

- Solo: one human against a CPU, on three levels (easy, medium, hard).
- Online: 1 v 1 in a room joined by a 4-character code or an invite link (`?r=CODE`). No account needed, only a nickname. The room creator is host and plays the left end; the guest plays the right end. Both players pick rock, paper, scissors in the lobby; the host presses Start once the first throw is decided. The rules are the same as in solo.

Out of scope: accounts and sign-in, syncing across devices, any server-side storage of stats, a global or shared leaderboard, public matchmaking, local hot-seat, true 2 v 2 with four seats, phone portrait layout.

### CPU opponent

Each CPU turn the CPU picks a target cup, a shot type and an aim, then throws through the same throw model as the player, so scatter, rim contact, ricochet and rack exit apply to it too. Levels differ only in these choices:

| Level  | Target                                    | Bounce shots           | Aim error | Cups per ball (full rack) |
| ------ | ----------------------------------------- | ---------------------- | --------- | ------------------------- |
| Easy   | Any standing cup                          | Never                  | 3.5 cm    | about 0.41                |
| Medium | One of the three cups nearest the tip     | 25% when in the window | 2 cm      | about 0.53                |
| Hard   | The cup in the middle of the cluster      | 35% when in the window | 1 cm      | about 0.74                |

The CPU never aims at a cup it has already hit this turn (unless every cup is hit). In simulated matches, easy beat medium about 31% of the time, medium beat hard about 38%, and easy beat hard about 16%. These numbers are placeholders to tune.

### Online rooms

There is no game server. Players find each other with Trystero (public relays are used only to introduce the two browsers) and then talk directly over a WebRTC data channel. The static game can be hosted anywhere; it is deployed on Vercel.

- Authority: both browsers hold the same match state and apply the same rules engine. Only the host rolls throw outcomes (scatter, rim, ricochet), so both players see the same result. A guest sends its aim to the host, the host answers with the outcome, and both play it and apply it. Cheating is not a concern: the host could in principle change outcomes, and that is accepted.
- Messages: `hello`, `welcome`, `full`, `rps`, `start`, `throw`, `outcome`, `pick`, `rematch`. Incoming messages are validated and anything malformed is ignored.
- Room full: a third person who joins gets "That room is full".
- Finding the room: a guest that hears nothing from the host for 12 seconds is told the room could not be found or reached.
- Disconnects: if the other player leaves or drops during a match, the match ends without a record and the home screen says so. There is no reconnect.
- Rematch: after a match both players press Rematch and return to the lobby of the same room (new rock, paper, scissors).
- Nicknames: two players may have the same nickname.
- Each browser saves its own record of an online match (mode Online, opponent's nickname).
- Without a TURN server, some strict networks cannot form a direct connection. Those players cannot join. This is accepted: no TURN server, to keep the project simple.

## Throw input

- Drag and release, mouse and touch. The player drags back from the ball; direction sets the aim, pull length sets the power.
- While dragging: a dotted aim line from the ball to the predicted landing point, a landing ring there, and a power readout in percent.
- Shot type is a toggle: Air or Bounce.

### Throw model

A throw does not run a physics simulation. The aim gives a nominal landing point; the actual landing is that point plus Gaussian scatter from a seeded random generator, so the same seed and inputs always give the same match. The result is then classified by the cup contact rules above.

- Air landing ring radius 6 cm, bounce about twice that; the scatter sigma is half the ring radius.
- Bounce power window 64% to 78%; the design marks it on the power bar.
- Cup radius 4.3 cm, core 2.6 cm; the rim band is the part in between. Cup centres are 9.2 cm apart.
- Ricochet chance 12% of rim bounce-outs, towards a cup within 13 cm in the kick direction.

All values are placeholders in `src/domain/throw/constants.ts`, not tuned. One finding to tune against: on a full rack a bounce at exactly the right power hits about as often as an air shot, so a bounce is worth more cups per throw. For human players the narrow power window is what makes it hard. The original target was a bounce hit rate of about half the air hit rate.

## Stats

- No sign-in, but a name is required: the home screen asks "Who are you?" first, and solo, online and creating or joining a room stay locked until a valid name is saved. There is no default name, so nobody plays as an anonymous guest. A name has 2 to 16 characters and may not be a placeholder (guest, you, cpu, player, opponent). The name is kept in the browser.
- An invite link opened without a name lands on the home screen with the room waiting; once a name is set the player joins with one click.
- Everything is stored in the browser (`localStorage`) behind a small store interface. Clearing browser data clears the stats. There is no sync between devices.
- Every finished match is saved on the device: solo matches and online matches. A match that ends because the other player left is not saved. In an online match each player's browser builds the record from the final throw log and saves it itself, with mode Online and the opponent's nickname.

Recorded per match: date, mode, opponent, result, cups sunk by each side, throws, hits, bounce hits, balls-back count, best streak of consecutive hits, and which rack position each hit landed in.

Shown in aggregate: matches, wins, win rate, hit rate, balls back, best streak, share of hits per rack position, recent matches.

### Local leaderboard

Records per opponent, computed from the matches saved on the device. It is the "Records" tab on the stats screen, next to "My stats", and replaces the "Leaderboard" tab of the design, which assumed accounts. The design does not show what the tab contains; this is what is built:

- One row per opponent met: matches played, won, lost, win rate (with a small bar) and the date of the last match.
- CPU levels come first, from easy to hard. Online opponents follow, the ones played most often first, then by wins, then by name.
- Online opponents are matched by nickname, ignoring case and surrounding spaces, and shown with their latest spelling. An online player who is called "CPU easy" is a separate row from the CPU.
- With no matches the tab says so. Because nothing leaves the device, the list only ever contains opponents this browser has played; it is not a ranking of players.

## Screens

| File in `docs/design/` | Screen                                                                                       | Status    |
| ---------------------- | -------------------------------------------------------------------------------------------- | --------- |
| `home.html`            | Mode select (solo with CPU level, online create or join), nickname, links to stats and rules | Built |
| `lobby.html`           | Online room: code, invite link, two seats, rock-paper-scissors, match rules                  | Built     |
| `first-throw.html`     | Solo rock-paper-scissors against the CPU                                                     | Built     |
| `match.html`           | Match, air shot selected: scoreboards, turn card, table, aim line, shot toggle, power, throw log | Built |
| `match-bounce.html`    | Match, bounce selected: bounce marker, wider landing ring, power window                      | Built     |
| `result.html`          | Winner, final table, per-player match stats, rematch                                         | Built     |
| `stats.html`           | Profile, stat tiles, hits per rack position, recent matches, records tab                     | Built (records tab replaces the leaderboard tab) |
| `states.html`          | Reference sheet: rack formations at 10, 6, 3, 1; cup and ball states; turn banners           | Reference |

All names, scores and numbers in the design are sample data. `[YOUR-DOMAIN]` in the lobby is a placeholder. The designs are static: links between them work, nothing else does.

Deviations of the app from the design, because there are no accounts:

- No "Sign in" button on the home or stats screens, and the copy no longer mentions syncing or signing in.
- The "Leaderboard" tab on the stats screen becomes local records per opponent.
- The invite link uses the site's own address instead of `[YOUR-DOMAIN]`.

### Table geometry used in the design

Coordinates are in cm on the 240 x 60 table, origin top-left, left rack shown (mirror x for the right rack).

- Cup spacing 9.2 cm centre to centre; rows 7.97 cm apart. This is a design assumption, not from the rules.
- Row of 4 at x = 8.0, y = 16.2, 25.4, 34.6, 43.8
- Row of 3 at x = 15.97, y = 20.8, 30.0, 39.2
- Row of 2 at x = 23.93, y = 25.4, 34.6
- Tip at x = 31.9, y = 30.0
- Re-racks keep the tip position: 6 cups use the tip, row of 2 and row of 3; 3 cups use the tip and row of 2; 1 cup sits at the tip.

## Visual design

- Colour tokens: `docs/design/theme.css`. No colours outside that file are used.
- Accent green marks the player, the active turn, hits and primary actions.
- `--color-brand-aws` orange marks the opponent, losses and fouls. Player and opponent are always also labelled in text.
- `--color-text-muted` and `--color-text-faint` are too low-contrast for small text on these backgrounds. Use them for lines and borders only.
- Fonts: Silkscreen for the wordmark, headings and large numbers; JetBrains Mono for everything else. Both are on Google Fonts.
- Cup states: standing (white rim), target (green outer ring), hit this turn (green fill with ball), removed (dashed outline).

## Architecture constraint

The rules engine is a pure, deterministic state machine: `(state, action) -> state`. It knows nothing about rendering or networking. Randomness lives outside it, in the throw model and the CPU, behind a seeded generator.

- Solo, online and stats all run on the same engine.
- Code is layered with one-way dependencies: `domain` (engine, throw model, CPU, stats; no DOM) <- `game` (Phaser table scene) and `ui` (DOM components) <- `match` (controller, narration, view models) <- `app` (screens, navigation) <- `main`. `storage` holds the local stores.
- Stats are derived from the engine's throw log by pure functions, so any client can build a match record from a finished game.
- Storage is local only and sits behind interfaces (`StatsStore`, `ProfileStore`).
- Online play needs exactly one authority that rolls the throw outcomes, so both players see the same match. That is the host's browser; the rules engine itself runs identically on both sides. Where throw outcomes come from is hidden behind a match driver (solo CPU or online session), so the match controller is the same for both.
- The engine and throw model are unit-tested against the rules in this file.

## Iteration order

1. Rules engine with tests. Done.
2. Table rendering and the drag throw. Done.
3. CPU opponent, three levels. Done.
4. Local stats. Done.
5. Online rooms. Done.
6. Local leaderboard (records per opponent). Done.
7. Pick the second cup after a bounce hit: optional `second` on the engine's throw action, clickable candidate cups on the table, `pick` message online. Done; not yet played in a browser.

## Decided

- Stack: TypeScript, Vite, Vitest. The table scene is rendered with Phaser 4 (Canvas/WebGL via AUTO, no physics modules).
- Throw model v1: seeded scatter, cup core and rim, ricochet, rack exit (values to tune).
- Rules questions closed: re-rack timing, the re-roll that also clears the rack (sudden death), second cup after a bounce hit (automatic).
- No accounts; stats and the leaderboard stay in the browser. The local leaderboard is records per opponent.
- Online transport: Trystero (WebRTC, public relays for matchmaking), host rolls outcomes, no game server. Hosting: static build on Vercel.
- Online edge cases: a disconnect ends the match without a record, rematch returns to the lobby, duplicate nicknames are allowed.
- Dropped to keep the project simple: time limit, defending and blowing, the "Foul, cup lost" banner, TURN server, reconnect, online throw preview, export/import/reset of local stats (the silent 500-match cap stays).
- The thrower picks the second cup after a bounce hit (iteration 7).

## Open decisions

- Tuning: bounce difficulty, rim odds and the CPU levels, once real players have tried them. Not now.
- Deploy: the static build is ready for Vercel (`vercel.json`, README notes) but nothing is deployed yet. Handled later.

## Verification

- `npm run check` (typecheck, lint, tests): engine rules including the project decisions, throw model, CPU, stats, records per opponent, storage, view-model and online (protocol, session, drivers over an in-memory link) tests.
- CPU strength: simulate full matches between the levels and check easy < medium < hard.
- Online: two headless browsers, one creates a room and the other joins by code or invite link; play a match from both sides, check both result screens and records, rematch and leaving.
- UI: run the app in a headless browser, play a solo match to the end, check the result and stats screens (both tabs) and a reload; screenshot at 1280 px width and compare against `docs/design/screens/`.
