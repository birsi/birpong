# Birpong spec

Birpong is an online, playable beer pong game for the browser: 2D, bird's-eye view, minimal and slightly retro. It is built in iterations. This file records what has been decided, what the design shows, and what is still open.

Status: design done, no code yet. Stack and hosting are undecided (see "Open decisions").

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
- Bounce shot: touches the table before the cup. A hit removes 2 cups; the thrower picks the second cup.
- Balls back: if both balls of a turn hit, the thrower gets both balls back and throws again. This happens at most once per turn.
- After the turn (and any balls-back round), the other side throws.

### Re-rack

- When a side has 6, 3 or 1 cups left after a turn, its cups are re-formed into a pyramid: 3-2-1, 2-1, or a single cup.

### Start and end

- First throw is decided by rock, paper, scissors, best of one. A tie is replayed.
- The game ends when one side has no cups left.
- Re-roll: if the side that threw first clears the rack, the other side gets one last turn with both balls.

### Project decisions (these override or interpret the source)

| Topic | Decision |
|---|---|
| Re-rack position | The pyramid is rebuilt from the tip of the rack (nearest the centre line), not from the table end. |
| Both balls in the same cup | Only that one cup is removed, and balls back still applies. |
| Bounce without defence | Bounce stays worth 2 cups but is harder to land than an air shot. |
| Defending and blowing | Not in the first iteration. No blocking of bounce shots, no blowing out a circling ball. |
| Solo first throw | Rock, paper, scissors against the CPU, same as online. |
| Team size | 1 v 1; the one player throws both balls. The source rules are 2 v 2. |

### Not applicable in a digital game

Physical fouls from the source (touching the table, knocking over own cups, spectator interference, elbow position) have no input that could cause them in iteration 1. The "Foul, cup lost" banner in the design is reserved for later.

## Modes

- Solo: one human against a CPU. Three levels: easy, medium, hard.
- Online: 1 v 1 in a room joined by a 4-character code or invite link. No account needed. The room creator is host.

Out of scope for now: local hot-seat, true 2 v 2 with four seats, public matchmaking, phone portrait layout.

## Throw input

- Drag and release, mouse and touch. The player drags back from the ball; direction sets the aim, pull length sets the power.
- While dragging: a dotted aim line from the ball to the predicted landing point, a landing ring there, and a power readout in percent.
- Shot type is a toggle: Air or Bounce.

### Bounce difficulty (proposal, to be tuned)

- Landing scatter roughly twice that of an air shot at the same aim. The design shows this as a landing ring about twice the radius.
- A narrower valid power window. Too soft and the ball dies on the table, too hard and it clears the rack. The design marks the window on the power bar.
- Target: bounce hit rate about half the air hit rate, so expected cups per throw are roughly equal.

The 64-78% window and the ring sizes in the design are placeholders, not tuned values.

## Stats

- Guest first: a player picks a nickname and plays immediately. Stats are stored on the device.
- Signing in is optional. It syncs stats across devices and enters the player on a leaderboard. Neither exists before accounts do.

Recorded per match: date, mode, opponent, result, cups sunk by each side, throws, hits, bounce hits, balls-back count, best streak of consecutive hits, and which rack position each hit landed in.

Shown in aggregate: matches, wins, win rate, hit rate, balls back, best streak, share of hits per rack position, recent matches.

## Screens

| File in `docs/design/` | Screen |
|---|---|
| `home.html` | Mode select (solo with CPU level, online create or join), nickname, links to stats and rules |
| `lobby.html` | Online room: code, invite link, two seats, rock-paper-scissors, match rules, time limit |
| `first-throw.html` | Solo rock-paper-scissors against the CPU |
| `match.html` | Match, air shot selected: scoreboards, turn card, table, aim line, shot toggle, power, throw log |
| `match-bounce.html` | Match, bounce selected: bounce marker, wider landing ring, power window |
| `result.html` | Winner, final table, per-player match stats, rematch |
| `stats.html` | Guest profile, stat tiles, hits per rack position, recent matches |
| `states.html` | Reference sheet: rack formations at 10, 6, 3, 1; cup and ball states; turn banners |

All names, scores and numbers in the design are sample data. `[YOUR-DOMAIN]` in the lobby is a placeholder. The screens are static: links between them work, nothing else does.

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

The rules engine is a pure, deterministic state machine: `(state, action, random seed) -> state`. It knows nothing about rendering or networking.

- Solo, online and stats all run on the same engine.
- Online play can run the engine on the server as the authority.
- The engine is unit-tested against the rules in this file.

## Iteration order

1. Rules engine with tests.
2. Table rendering and the drag throw.
3. CPU opponent, three levels.
4. Local stats.
5. Online rooms.
6. Accounts and leaderboard.

## Open decisions

Rules:

- Time limit. The source mentions a final signal but gives no duration. The lobby shows Off, 10 min, 15 min as a placeholder.
- Whether a re-rack can happen between the two throws of a balls-back round, or only once the whole turn is over.
- What happens if the re-roll also clears the rack. The source defines no overtime.
- How the thrower picks the second cup after a bounce hit (UI not designed).

Technical:

- Stack and framework.
- Rendering: canvas or SVG/DOM.
- Throw model: how drag direction and length map to a landing point and scatter, and how CPU levels differ.
- Realtime transport and hosting for rooms.
- Account provider and where server-side stats live.

## Verification

- Engine: unit tests per rule above, including the project decisions.
- UI: screenshot the running app at 1280 px width and compare against `docs/design/screens/`.
