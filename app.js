// Dice Scorekeeper — adds up the scores people enter. No dice rules.
//
// The whole game is stored as:
//   { players: ["Ann", "Bob"], target: 10000, turns: [350, 0, 1200, ...] }
// `turns` is every confirmed score in play order. Everything else (whose
// turn it is, the round, totals, final round, tie-breaks, the winner) is
// worked out by replaying that list from the start, so undo is just
// removing the last entry.
//
// Saved in the browser (localStorage) on every action:
//   dice.current   the game in progress plus the half-typed score
//   dice.history   finished games, newest first
//   dice.setup     last names and target, so a rematch is quick

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const MAX_PENDING = 99999; // keeps the big number display from overflowing

let game = null;   // the current game, or null on the setup screen
let pending = 0;   // score being entered for the current turn

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

// ---------- Saving ----------

const CURRENT_KEY = "dice.current";
const HISTORY_KEY = "dice.history";
const SETUP_KEY = "dice.setup";

// Storage can be unavailable (e.g. some private browsing modes); the app
// still works, it just won't remember anything.
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: nothing useful to do if storage is full or blocked
  }
}

function saveCurrent() {
  save(CURRENT_KEY, game ? { game, pending } : null);
}

// Keeps the history list in step with the current game: a finished game is
// added (or updated), and if the winning score is undone it's removed again.
function syncHistory(state) {
  const history = load(HISTORY_KEY, []);
  const index = history.findIndex((h) => h.id === game.id);
  if (state.winner === null) {
    if (index !== -1) {
      history.splice(index, 1);
      save(HISTORY_KEY, history);
    }
    return;
  }
  const entry = {
    id: game.id,
    date: index !== -1 ? history[index].date : new Date().toISOString(),
    target: game.target,
    players: game.players.map((name, i) => ({ name, score: state.totals[i] })),
    winner: game.players[state.winner],
    rounds: state.rounds.length,
    turns: game.turns.slice(),
  };
  if (index !== -1) history[index] = entry;
  else history.unshift(entry);
  save(HISTORY_KEY, history);
}

// ---------- Keep the screen awake during a game ----------

let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && !wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch {
    // not supported or refused (e.g. low battery): the app works without it
  }
}

// The browser drops the lock when the app is hidden; take it back on return
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && game) keepAwake(true);
});

// ---------- Replaying the game ----------

// Walks through every recorded turn and returns the current state:
//   totals      each player's total
//   rounds      [{ players: [indexes who played], scores: {index: score} }]
//   round       current round number (1-based)
//   active      player indexes taking part in the current round
//   current     index of the player whose turn it is (null when over)
//   finalRound  true once someone has reached the target this round
//   tiebreak    true when the current round is a tie-break
//   winner      index of the winner, or null while the game is going
function replay(g) {
  const n = g.players.length;
  const totals = g.players.map(() => 0);
  const rounds = [];
  let active = g.players.map((_, i) => i);
  let tiebreak = false;
  let pos = 0;           // position within the current round
  let winner = null;

  for (const score of g.turns) {
    if (pos === 0) rounds.push({ players: active, scores: {} });
    const player = active[pos];
    totals[player] += score;
    rounds[rounds.length - 1].scores[player] = score;
    pos++;

    if (pos === active.length) {
      // Round finished. The game can only end at the end of a round.
      pos = 0;
      const someoneReachedTarget = totals.some((t) => t >= g.target);
      if (tiebreak || someoneReachedTarget) {
        const best = Math.max(...active.map((i) => totals[i]));
        const leaders = active.filter((i) => totals[i] === best);
        if (leaders.length === 1) {
          winner = leaders[0];
          break;
        }
        // Tied at the top: only the tied players play another round
        active = leaders;
        tiebreak = true;
      }
    }
  }

  const finalRound = !tiebreak && winner === null && totals.some((t) => t >= g.target);
  return {
    totals,
    rounds,
    round: rounds.length + (pos === 0 && winner === null ? 1 : 0),
    active,
    current: winner === null ? active[pos] : null,
    finalRound,
    tiebreak,
    winner,
    n,
  };
}

// ---------- Setup screen ----------

const setup = {
  count: 2,
  names: [],
  target: 10000,
};

function renderNameFields() {
  const box = $("name-fields");
  // Keep any names already typed when the count changes
  box.querySelectorAll("input").forEach((input, i) => { setup.names[i] = input.value; });
  box.innerHTML = "";
  for (let i = 0; i < setup.count; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Player ${i + 1}`;
    input.value = setup.names[i] || "";
    input.autocomplete = "off";
    input.enterKeyHint = "next";
    box.appendChild(input);
  }
  $("player-count").textContent = setup.count;
  $("players-minus").disabled = setup.count <= MIN_PLAYERS;
  $("players-plus").disabled = setup.count >= MAX_PLAYERS;
}

function renderTargetChoice() {
  const custom = $("custom-target");
  const isPreset = custom.value === "";
  document.querySelectorAll(".target-btn").forEach((btn) => {
    btn.classList.toggle("selected", isPreset && Number(btn.dataset.target) === setup.target);
  });
  custom.classList.toggle("selected", !isPreset);
  $("start-btn").disabled = !(setup.target > 0);
}

$("players-minus").addEventListener("click", () => {
  if (setup.count > MIN_PLAYERS) { setup.count--; renderNameFields(); }
});
$("players-plus").addEventListener("click", () => {
  if (setup.count < MAX_PLAYERS) { setup.count++; renderNameFields(); }
});

document.querySelectorAll(".target-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setup.target = Number(btn.dataset.target);
    $("custom-target").value = "";
    renderTargetChoice();
  });
});

$("custom-target").addEventListener("input", (e) => {
  const value = e.target.value;
  setup.target = value === "" ? 10000 : Math.floor(Number(value));
  renderTargetChoice();
});

$("start-btn").addEventListener("click", () => {
  const inputs = [...$("name-fields").querySelectorAll("input")];
  const players = inputs.map((input, i) => input.value.trim() || `Player ${i + 1}`);
  save(SETUP_KEY, {
    count: setup.count,
    names: inputs.map((input) => input.value.trim()),
    target: setup.target,
  });
  startGame(players, setup.target);
});

function restoreSetup() {
  const saved = load(SETUP_KEY, null);
  if (!saved) return;
  setup.count = Math.min(Math.max(saved.count, MIN_PLAYERS), MAX_PLAYERS);
  setup.names = saved.names || [];
  setup.target = saved.target > 0 ? saved.target : 10000;
  if (setup.target !== 5000 && setup.target !== 10000) $("custom-target").value = setup.target;
}

// ---------- Screens ----------

let historyReturnTo = "game";   // where Back on the score table goes

function showScreen(id) {
  for (const s of ["setup", "game", "history", "gameover", "past"]) {
    $(s).classList.toggle("hidden", s !== id);
  }
  window.scrollTo(0, 0);
  keepAwake(id === "game" || (id === "history" && historyReturnTo === "game"));
}

// Shows the game or the game-over screen, whichever fits the current state
function render() {
  const state = replay(game);
  saveCurrent();
  syncHistory(state);
  if (state.winner !== null) {
    renderGameOver(state);
    showScreen("gameover");
  } else {
    renderGame(state);
    showScreen("game");
  }
}

// ---------- Game screen ----------

function startGame(players, target) {
  game = { id: Date.now(), players, target, turns: [] };
  pending = 0;
  render();
}

function renderGame(state) {
  $("round-label").textContent = state.tiebreak ? "Tie-break" : `Round ${state.round}`;
  $("target-label").textContent = `to ${fmt(game.target)}`;
  $("undo-btn").disabled = game.turns.length === 0;

  const banner = $("banner");
  if (state.tiebreak) {
    const names = state.active.map((i) => game.players[i]).join(" vs ");
    banner.textContent = `Tie-break: ${names}`;
  } else if (state.finalRound) {
    banner.textContent = "Final round: last turns!";
  }
  banner.classList.toggle("hidden", !state.tiebreak && !state.finalRound);

  const board = $("scoreboard");
  board.innerHTML = "";
  board.classList.toggle("compact", game.players.length > 4);
  game.players.forEach((name, i) => {
    const li = document.createElement("li");
    li.classList.toggle("current", i === state.current);
    li.classList.toggle("out", !state.active.includes(i));
    li.classList.toggle("reached", state.totals[i] >= game.target);
    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = name;
    const totalEl = document.createElement("span");
    totalEl.className = "total";
    totalEl.textContent = fmt(state.totals[i]);
    li.append(nameEl, totalEl);
    board.appendChild(li);
  });

  $("turn-label").textContent = `${game.players[state.current]}'s turn`;
  renderPending();
}

function renderPending() {
  $("pending").textContent = fmt(pending);
}

function setPending(value) {
  pending = Math.min(Math.max(0, value), MAX_PENDING);
  renderPending();
  saveCurrent();
}

function recordTurn(score) {
  game.turns.push(score);
  pending = 0;
  render();
}

// Removes the last confirmed score and puts it back in the entry box, so a
// typo can be fixed and re-confirmed, and an accidental undo is one tap to redo.
function undo() {
  if (game.turns.length === 0) return;
  pending = game.turns.pop();
  render();
}

document.querySelectorAll("[data-digit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = pending * 10 + Number(btn.dataset.digit);
    if (next <= MAX_PENDING) setPending(next);
  });
});

document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => setPending(pending + Number(btn.dataset.add)));
});

$("clear-btn").addEventListener("click", () => setPending(0));
$("back-btn").addEventListener("click", () => setPending(Math.floor(pending / 10)));
$("bust-btn").addEventListener("click", () => recordTurn(0));
$("confirm-btn").addEventListener("click", () => recordTurn(pending));
$("undo-btn").addEventListener("click", undo);

// ---------- Round-by-round table ----------

function renderHistory() {
  const state = replay(game);
  const table = $("history-table");
  table.innerHTML = "";

  const head = table.createTHead().insertRow();
  head.appendChild(document.createElement("th")).textContent = "Rd";
  game.players.forEach((name) => {
    head.appendChild(document.createElement("th")).textContent = name;
  });

  const body = table.createTBody();
  state.rounds.forEach((round, r) => {
    const row = body.insertRow();
    row.insertCell().textContent = r + 1;
    game.players.forEach((_, i) => {
      const cell = row.insertCell();
      if (!round.players.includes(i)) {
        cell.textContent = "";           // not in this tie-break round
        cell.className = "skip";
      } else if (i in round.scores) {
        const s = round.scores[i];
        cell.textContent = s === 0 ? "—" : fmt(s);
        if (s === 0) cell.className = "zero";
      } else {
        cell.textContent = "";           // hasn't played yet this round
      }
    });
  });

  const foot = table.createTFoot().insertRow();
  foot.insertCell().textContent = "Total";
  state.totals.forEach((t) => { foot.insertCell().textContent = fmt(t); });
}

function openHistory(from) {
  historyReturnTo = from;
  renderHistory();
  showScreen("history");
  // Jump to the latest rounds
  const wrap = document.querySelector(".table-wrap");
  wrap.scrollTop = wrap.scrollHeight;
}

$("table-btn").addEventListener("click", () => openHistory("game"));
$("over-table-btn").addEventListener("click", () => openHistory("gameover"));
$("history-back-btn").addEventListener("click", () => showScreen(historyReturnTo));

$("abandon-btn").addEventListener("click", () => {
  if (confirm("End this game and go back to setup? Scores will be lost.")) {
    leaveGame();
  }
});

// ---------- Game over ----------

// Five dice showing a straight, 1 to 5
function renderDice() {
  const pips = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  };
  const tilt = [-8, 5, -3, 7, -6];
  let svg = '<svg viewBox="0 0 560 120" xmlns="http://www.w3.org/2000/svg" role="img">';
  for (let face = 1; face <= 5; face++) {
    const x = (face - 1) * 112 + 6;
    svg += `<g transform="translate(${x} 10) rotate(${tilt[face - 1]} 50 50)">`;
    svg += '<rect x="0" y="0" width="100" height="100" rx="18" fill="#fff" stroke="var(--accent)" stroke-width="5"/>';
    for (const [cx, cy] of pips[face]) svg += `<circle cx="${cx}" cy="${cy}" r="10" fill="#111"/>`;
    svg += "</g>";
  }
  $("dice").innerHTML = svg + "</svg>";
}

function renderGameOver(state) {
  $("winner-label").textContent = `${game.players[state.winner]} wins!`;
  const list = $("final-standings");
  list.innerHTML = "";
  game.players
    .map((name, i) => ({ name, total: state.totals[i] }))
    .sort((a, b) => b.total - a.total)
    .forEach(({ name, total }) => {
      const li = document.createElement("li");
      const nameEl = document.createElement("span");
      nameEl.textContent = name;
      const totalEl = document.createElement("span");
      totalEl.className = "total";
      totalEl.textContent = fmt(total);
      li.append(nameEl, totalEl);
      list.appendChild(li);
    });
}

$("over-undo-btn").addEventListener("click", undo);

$("new-game-btn").addEventListener("click", leaveGame);

// Back to setup, which keeps the same names and target ready for a rematch.
// A finished game is already in the history list.
function leaveGame() {
  game = null;
  pending = 0;
  saveCurrent();
  showScreen("setup");
}

// ---------- Past games ----------

function renderPast() {
  const history = load(HISTORY_KEY, []);
  const list = $("past-list");
  list.innerHTML = "";
  if (history.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No finished games yet.";
    list.appendChild(li);
  }
  for (const h of history) {
    const li = document.createElement("li");
    const top = document.createElement("div");
    top.className = "past-top";
    const date = document.createElement("span");
    date.textContent = new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const meta = document.createElement("span");
    meta.textContent = `to ${fmt(h.target)} · ${h.rounds} rds`;
    top.append(date, meta);

    const winner = document.createElement("div");
    winner.className = "past-winner";
    winner.textContent = `${h.winner} won`;

    const scores = document.createElement("div");
    scores.className = "past-scores";
    scores.textContent = h.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p) => `${p.name} ${fmt(p.score)}`)
      .join(" · ");

    li.append(top, winner, scores);
    list.appendChild(li);
  }
  $("clear-past-btn").classList.toggle("hidden", history.length === 0);
}

$("past-btn").addEventListener("click", () => { renderPast(); showScreen("past"); });
$("past-back-btn").addEventListener("click", () => showScreen("setup"));
$("clear-past-btn").addEventListener("click", () => {
  if (confirm("Delete all past games? This can't be undone.")) {
    save(HISTORY_KEY, null);
    renderPast();
  }
});

// ---------- Init ----------

renderDice();
restoreSetup();
renderNameFields();
renderTargetChoice();

// Pick up where we left off after a refresh, app close or phone lock
const saved = load(CURRENT_KEY, null);
if (saved && saved.game && Array.isArray(saved.game.turns)) {
  game = saved.game;
  if (!game.id) game.id = Date.now();
  pending = saved.pending || 0;
  render();
}

// Offline support (only works when served over http(s), not file://)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js");
}
