// Dice Scorekeeper — adds up the scores people enter. No dice rules.
//
// The whole game is stored as:
//   { players: ["Ann", "Bob"], target: 10000, turns: [350, 0, 1200, ...] }
// `turns` is every confirmed score in play order. Whose turn it is, the
// round number, and each player's total are all worked out from that list,
// so undo (step 2) is just removing the last entry.

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const MAX_PENDING = 99999; // keeps the big number display from overflowing

let game = null;   // the current game, or null on the setup screen
let pending = 0;   // score being entered for the current turn

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-US");

// ---------- Derived game info ----------

function currentPlayerIndex() {
  return game.turns.length % game.players.length;
}

function currentRound() {
  return Math.floor(game.turns.length / game.players.length) + 1;
}

function totals() {
  const sums = game.players.map(() => 0);
  game.turns.forEach((score, i) => { sums[i % game.players.length] += score; });
  return sums;
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

// ---------- Game screen ----------

function startGame(players, target) {
  game = { players, target, turns: [] };
  pending = 0;
  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  renderGame();
}

function renderGame() {
  const current = currentPlayerIndex();
  const sums = totals();

  $("round-label").textContent = `Round ${currentRound()}`;
  $("target-label").textContent = `to ${fmt(game.target)}`;

  const board = $("scoreboard");
  board.innerHTML = "";
  game.players.forEach((name, i) => {
    const li = document.createElement("li");
    li.classList.toggle("current", i === current);
    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = name;
    const totalEl = document.createElement("span");
    totalEl.className = "total";
    totalEl.textContent = fmt(sums[i]);
    li.append(nameEl, totalEl);
    board.appendChild(li);
  });

  $("turn-label").textContent = `${game.players[current]}'s turn`;
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
  renderGame();
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

// ---------- Init ----------

renderNameFields();
renderTargetChoice();
