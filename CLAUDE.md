# Dice Scorekeeper (5,000 / 10,000)

A simple scorekeeping app for a dice game, used at the table so the scorekeeper doesn't have to do the math. It does NOT enforce or calculate dice rules. It only adds up the scores people enter.

## Platform (decided)
- Installable Progressive Web App (PWA): static site, no backend, no accounts.
- Must work fully offline after first load (often used where there is little or no connectivity).
- Plain HTML/CSS/JavaScript, no build step, to keep it simple to read and change.
- Service worker caches all files; web app manifest + icons so it can be added to the phone home screen and run full-screen like an app.
- Hosting target: GitHub Pages (free). Test offline by turning on airplane mode after one load.
- Single device: one scorekeeper's phone. No multi-device sync.

## Setup screen
- Number of players: 2 to 8.
- Player names (one field per player).
- Winning score: presets 5,000 and 10,000, plus a custom number field.
- Start game button.

## Core gameplay
- Fixed turn order; rounds advance as each player finishes a turn.
- Each turn: enter a score (zero or more) and confirm it.
- Bust: one-tap button that records 0 for the turn.
- No minimum score required to get on the board.
- No penalty for consecutive zeros.
- Final round: when a player reaches or exceeds the winning score, the round still completes so every player has had the same number of turns (players after them in turn order get a last turn). Highest total after that round wins.
- Tie: if two or more players are tied for the highest total after the final round, only the tied players play another round to decide it. Repeat until there is a single highest score.

## Score entry
- Number pad for typing any amount.
- Quick-add buttons: +50, +100, +1,000. Tapping adds to the pending turn score.
- Bust button (records 0).
- Clear/backspace for the pending entry, and a Confirm button.

## Mistakes
- Undo: step back through entries one at a time, including across turns and rounds.
- Quit: button on the game screen; shows "Are you sure?" with Yes / Cancel. Yes discards the game (not saved to Past games).
- Editing past rounds directly is NOT needed.

## Screen layout
- Current player clearly highlighted.
- All players' running totals always visible.
- Round-by-round history table available (toggle or second view).

## Persistence
- In-progress game auto-saves on every action and resumes after a refresh, app close, or phone lock (localStorage).
- Completed games are saved to a history list: date, players, final scores, winner.

## Look and feel
- Very large text and large tap targets; used in dim rooms, often one-handed, often while drinking.
- Dark, high-contrast theme by default. Accent color is electric blue (#1aa3ff), not yellow. Green for Confirm/Start, red for Bust.
- Game-over screen shows five dice as a straight (1 to 5), not a trophy. App icon is a white die showing five on electric blue.
- Prevent accidental zoom/double-tap issues; keep the screen awake during a game if the browser supports it.

## Non-goals
- Dice scoring logic or rules enforcement.
- Live sync between phones, user accounts, online leaderboards.
- Editing past rounds.

## Build order
1. Setup screen + scoring core (turns, rounds, totals, Bust, number pad, quick-add).
2. Undo + history table + end-of-game logic.
3. Persistence (resume game, saved game history).
4. PWA: manifest, icons, service worker, offline test on a real phone.
5. Large-text polish and real-use testing at a game night.

## Status
- Steps 1 to 3 done. Step 4 built and tested offline in a browser; still needs the real-phone test.
- Live site: GitHub Pages from the `main` branch (repo markdali-dev/dice-scorekeeper).
- Service worker uses stale-while-revalidate: updates reach the phone on the second launch with a connection. No version number to bump.
- If a new file is added to the app, add it to the FILES list in sw.js.

## Later (stretch)
- Export game history as JSON.
- Small MCP server that exposes saved game history so chat/Claude can answer questions like "who has won the most games this year?" (the MCP learning stage).

## Open items
- None right now.
