let players = [];
let scores = {};
let currentQuestion = 0;
let startTime = 0;
let timeLeft = 10;
let timerInterval;

const questions = [
  {
    q: "Capital of France?",
    answers: ["Berlin", "Paris", "Madrid", "Rome"],
    correct: 1
  },
  {
    q: "2 + 2 = ?",
    answers: ["3", "4", "5", "6"],
    correct: 1
  }
];

// 🔁 NAVIGATION
function hideAll() {
  ["home","join","lobby","quiz","leaderboard"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
}
function goHome() {
  hideAll();
  document.getElementById("home").classList.remove("hidden");
}

function showJoin() {
  hideAll();
  document.getElementById("join").classList.remove("hidden");
}

// 🎮 GAME START
function createGame() {
  const pin = Math.floor(100000 + Math.random() * 900000);
  document.getElementById("pin").innerText = pin;

  players = ["Host"];
  scores = { Host: 0 };

  updatePlayers();

  hideAll();
  document.getElementById("lobby").classList.remove("hidden");
}

function joinGame() {
  const nick = document.getElementById("nickname").value;
  if (!nick) return alert("Enter nickname");

  players.push(nick);
  scores[nick] = 0;

  updatePlayers();

  hideAll();
  document.getElementById("lobby").classList.remove("hidden");
}

function updatePlayers() {
  const list = document.getElementById("players");
  list.innerHTML = "";

  players.forEach(p => {
    const li = document.createElement("li");
    li.className = "bg-purple-100 p-2 rounded-xl flex justify-between";
    list.appendChild(li);
  });
}

// 🚀 START GAME
function startGame() {
  currentQuestion = 0;
  showQuestion();
  hideAll();
  document.getElementById("quiz").classList.remove("hidden");
}

// ❓ QUESTION
function showQuestion() {
  const q = questions[currentQuestion];
  document.getElementById("question").innerText = q.q;

  const answers = document.querySelectorAll("#quiz .grid div");

  answers.forEach((el, i) => {
    el.innerText = q.answers[i];
    el.classList.remove("ring-4","ring-green-500","ring-red-500","pop");
    el.classList.add("fade-in");
  });

  clearInterval(timerInterval);
  timeLeft = 10;

  const bar = document.getElementById("timerBar");
  bar.style.width = "100%";

  startTime = Date.now();

  timerInterval = setInterval(() => {
    timeLeft--;
    bar.style.width = (timeLeft / 10) * 100 + "%";

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoNext();
    }
  }, 1000);
}

// 🎯 ANSWER
function answer(index) {
  clearInterval(timerInterval);

  const q = questions[currentQuestion];
  const answers = document.querySelectorAll("#quiz .grid div");

  const correctSound = document.getElementById("soundCorrect");
  const wrongSound = document.getElementById("soundWrong");

  let player = players[players.length - 1];
  let timeTaken = (Date.now() - startTime) / 1000;

  answers[index].classList.add("pop");

  if (index === q.correct) {
    answers[index].classList.add("ring-4","ring-green-500");
    correctSound.play();

    let points = Math.max(1000 - timeTaken * 200, 100);
    scores[player] += Math.floor(points);

  } else {
    answers[index].classList.add("ring-4","ring-red-500");
    wrongSound.play();
  }

  setTimeout(autoNext, 900);
}

// ⏭️ NEXT
function autoNext() {
  currentQuestion++;

  if (currentQuestion < questions.length) {
    showQuestion();
  } else {
    showLeaderboard();
  }
}

// 🏆 LEADERBOARD
function showLeaderboard() {
  hideAll();

  const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);

  const top3 = document.getElementById("top3");
  const list = document.getElementById("leaderboardList");

  top3.innerHTML = "";
  list.innerHTML = "";

  const medals = ["🥇","🥈","🥉"];

  sorted.forEach(([name, score], i) => {

    if (i < 3) {
      const card = document.createElement("div");
      card.className = "bg-white/80 p-3 rounded-2xl shadow-md w-20 fade-in";

      card.innerHTML = `
        <div class="text-xl">${medals[i]}</div>
        <div class="font-bold text-sm">${name}</div>
        <div class="text-xs">${score}</div>
      `;

      top3.appendChild(card);

    } else {
      const row = document.createElement("div");
      row.className = "bg-white/70 p-3 rounded-xl flex justify-between fade-in";

      row.innerHTML = `
        <span>${i+1}. ${name}</span>
        <span class="font-semibold">${score}</span>
      `;

      list.appendChild(row);
    }
  });

  document.getElementById("leaderboard").classList.remove("hidden");
}