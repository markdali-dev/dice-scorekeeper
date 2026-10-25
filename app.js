// Dice Scorekeeper — adds up the scores people enter. No dice rules.
//
// The whole game is stored as:
//   { players: ["Ann", "Bob"], target: 10000, turns: [350, 0, 1200, ...] }
// `turns` is every confirmed score in play order. Everything else (whose
// turn it is, the round, totals, final round, tie-breaks, the winner) is
// worked out by replaying that list from the start, so undo is just
// removing the last entry.

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const MAX_PENDING = 99999; // keeps the big number display from overflowing

let game = null;   // the current game, or null on the setup screen
let pending = 0;   // score being entered for the current turn

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

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
  startGame(players, setup.target);
});

// ---------- Screens ----------

function showScreen(id) {
  for (const s of ["setup", "game", "history", "gameover"]) {
    $(s).classList.toggle("hidden", s !== id);
  }
  window.scrollTo(0, 0);
}

// Shows the game or the game-over screen, whichever fits the current state
function render() {
  const state = replay(game);
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
  game = { players, target, turns: [] };
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

let historyReturnTo = "game";

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
    game = null;
    pending = 0;
    showScreen("setup");
  }
});

// ---------- Game over ----------

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

$("new-game-btn").addEventListener("click", () => {
  // Setup keeps the same names and target, ready for a rematch
  game = null;
  pending = 0;
  showScreen("setup");
});

// ---------- Init ----------

renderNameFields();
renderTargetChoice();
