// ---------------- GLOBAL ----------------
let players = [];
let scores = {};
let createdQuestions = [];

// ---------------- NAVIGATION ----------------
function goToCreate() {
    window.location.href = "CreateQuiz.html";
}

function goHome() {
    window.location.href = "Dashboard.html";
}

function showJoin() {
    document.getElementById("home")?.classList.add("hidden");
    document.getElementById("join")?.classList.remove("hidden");
}

function goBack() {
    window.location.href = "Dashboard.html";
}

// ---------------- CREATE QUIZ ----------------
function addQuestion() {
    const question = document.getElementById("questionInput").value.trim();
    const answers = document.querySelectorAll(".answer");
    const correct = parseInt(document.getElementById("correctIndex").value);

    if (!question) return alert("Enter a question!");
    if (isNaN(correct) || correct < 0 || correct > 3) return alert("Correct index must be 0-3");

    let answersArr = [];
    answers.forEach(a => {
        if (a.value.trim()) answersArr.push(a.value.trim());
    });

    if (answersArr.length !== 4) return alert("Fill all 4 answers!");

    createdQuestions.push({
        q: question,
        answers: answersArr,
        correct: correct
    });

    alert("Question added!");

    // Чистим поля
    document.getElementById("questionInput").value = "";
    document.getElementById("correctIndex").value = "";
    answers.forEach(a => a.value = "");
}

async function finishQuiz() {
    if (createdQuestions.length === 0) return alert("Add at least one question!");

    const quizPayload = { questions: createdQuestions };

    try {
        const response = await fetch('http://localhost:5178/api/quizzes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quizPayload)
        });

        const savedQuiz = await response.json();
        
        // Сохраняем данные от БЭКЕНДА
        localStorage.setItem("lobbyPin", savedQuiz.id);
        localStorage.setItem("quiz", JSON.stringify(savedQuiz.questions));
        localStorage.setItem("players", JSON.stringify(["Host"]));

        window.location.href = "Lobby.html";
    } catch (error) {
        alert("Backend is not responding!");
    }
}

// ---------------- JOIN GAME ----------------
async function joinGame() {
    const nick = document.getElementById("nickname").value.trim();
    const pin = document.getElementById("pinInput").value.trim().toUpperCase();

    if (!nick || !pin) return alert("Enter nickname and PIN!");

    try {
        const response = await fetch(`http://localhost:5178/api/quizzes/${pin}`);
        
        if (response.ok) {
            const quiz = await response.json();
            
            localStorage.setItem("lobbyPin", pin);
            localStorage.setItem("quiz", JSON.stringify(quiz.questions));
            
            let players = JSON.parse(localStorage.getItem("players")) || [];
            if (!players.includes(nick)) players.push(nick);
            localStorage.setItem("players", JSON.stringify(players));

            window.location.href = "Lobby.html";
        } else {
            alert("Lobby not found!");
        }
    } catch (error) {
        alert("Server error!");
    }
}

// ---------------- LOBBY ----------------
function loadLobby() {
    const pin = localStorage.getItem("lobbyPin");
    const playersList = JSON.parse(localStorage.getItem("players")) || [];

    const pinEl = document.getElementById("pin");
    const list = document.getElementById("players");

    if (pinEl) pinEl.innerText = pin || "----";
    if (list) {
        list.innerHTML = "";
        playersList.forEach(p => {
            const li = document.createElement("li");
            li.className = "bg-purple-100 p-3 rounded-xl flex justify-between fade-in";
            li.innerHTML = `<span>${p}</span> <span class="text-xs font-bold text-purple-600">READY</span>`;
            list.appendChild(li);
        });
    }
}

function startGame() {
    window.location.href = "Game.html";
}

// ---------------- GAME ----------------
let currentQuestion = 0;
let startTime = 0;
let timerInterval;
let timeLeft = 10;

let questions = JSON.parse(localStorage.getItem("quiz")) || [
    { q: "What is 5 * 5?", answers: ["20", "25", "30", "15"], correct: 1 }
];

function loadGame() {
    if (!document.getElementById("question")) return;

    players = JSON.parse(localStorage.getItem("players")) || ["Host"];
    scores = {};

    players.forEach(p => scores[p] = 0);

    showQuestion();
}

function showQuestion() {
    const q = questions[currentQuestion];
    if (!q) return;

    document.getElementById("question").innerText = q.q;

    const grid = document.getElementById("optionsGrid");
    const answersDiv = document.getElementById("answers");

    // Красивый UI
    if (grid) {
        const options = grid.querySelectorAll(".option-btn");

        options.forEach((el, i) => {
            el.innerText = q.answers[i];
            el.onclick = () => answer(i);

            el.className = "option-btn bg-white h-24 rounded-3xl flex items-center justify-center cursor-pointer shadow-md font-bold text-xl text-purple-800 border-b-4 border-purple-200";
        });
    }

    // Простой UI (fallback)
    if (answersDiv) {
        answersDiv.innerHTML = "";

        q.answers.forEach((ans, i) => {
            const btn = document.createElement("button");
            btn.className = "bg-white p-4 rounded shadow";
            btn.innerText = ans;
            btn.onclick = () => answer(i);

            answersDiv.appendChild(btn);
        });
    }

    startTime = Date.now();

    const bar = document.getElementById("timerBar");
    if (bar) {
        timeLeft = 10;
        bar.style.width = "100%";

        clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            bar.style.width = (timeLeft / 10) * 100 + "%";

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                autoNext();
            }
        }, 1000);
    }
}

// ---------------- ANSWER ----------------
function answer(index) {
    clearInterval(timerInterval);

    const q = questions[currentQuestion];
    const player = players[0];

    const timeTaken = (Date.now() - startTime) / 1000;

    const grid = document.getElementById("optionsGrid");

    if (grid) {
        const options = grid.querySelectorAll(".option-btn");

        if (index === q.correct) {
            options[index].classList.add("bg-green-100", "border-green-500");

            let points = Math.max(1000 - Math.floor(timeTaken * 100), 100);
            scores[player] += points;
        } else {
            options[index].classList.add("bg-red-100", "border-red-500");
            options[q.correct].classList.add("bg-green-100");
        }
    } else {
        if (index === q.correct) {
            scores[player] += 500;
            alert("Correct!");
        } else {
            alert("Wrong!");
        }
    }

    setTimeout(autoNext, 1000);
}

// ---------------- NEXT ----------------
function autoNext() {
    currentQuestion++;

    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        showLeaderboard();
    }
}

// ---------------- LEADERBOARD ----------------
function showLeaderboard() {
    document.getElementById("quiz")?.classList.add("hidden");
    document.getElementById("leaderboard")?.classList.remove("hidden");

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    const top3Cont = document.getElementById("top3");
    const listCont = document.getElementById("leaderboardList");

    if (!top3Cont || !listCont) return;

    top3Cont.innerHTML = "";
    listCont.innerHTML = "";

    sorted.forEach(([name, score], i) => {
        const div = document.createElement("div");
        div.className = "bg-white p-3 rounded-xl flex justify-between shadow";
        div.innerHTML = `<span>${i + 1}. ${name}</span><span>${score}</span>`;
        listCont.appendChild(div);
    });
}

// ---------------- INIT ----------------
window.onload = function () {
    loadLobby();
    loadGame();
};