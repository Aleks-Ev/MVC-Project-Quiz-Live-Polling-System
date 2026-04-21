// ---------------- GLOBAL STATE ----------------
let players = [];
let scores = {};
let currentQuestion = 0;
let timerInterval;
let timeLeft = 30; // Стандартное время на ответ
let questions = [];
let myNickname = localStorage.getItem("userName") || "Guest";
let isHost = localStorage.getItem("isHost") === "true";
let lobbyPin = localStorage.getItem("lobbyPin");

// Проверяем, если API_URL уже был объявлен (например, в auth.js), используем его. 
// Если нет — создаем.
// Проверяем, существует ли API_URL. Если нет — объявляем локально.
if (typeof API_URL === 'undefined') {
    var API_URL = "http://localhost:5178/api"; 
}

// Теперь connection сможет спокойно использовать переменную
const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL.replace('/api', '')}/api/quizhub`) // Убираем лишний /api если нужно
    .configureLogging(signalR.LogLevel.Information)
    .build();

// ---------------- SIGNALR SETUP ----------------
const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/quizhub`)
    .configureLogging(signalR.LogLevel.Information)
    .build();

// Слушатель: Обновление списка игроков
connection.on("UpdatePlayers", (updatedPlayers) => {
    players = updatedPlayers;
    const list = document.getElementById("players");
    if (list) {
        list.innerHTML = players.map(p => `
            <li class="flex justify-between items-center bg-white/10 p-3 rounded-xl">
                <span>${p}</span>
                <span class="text-[10px] opacity-50">READY</span>
            </li>
        `).join("");
    }
});

// Слушатель: Синхронный старт вопроса
connection.on("NextQuestion", (questionIndex) => {
    currentQuestion = questionIndex;
    showQuestion();
});

// Слушатель: Сбор очков в реальном времени (для хоста)
connection.on("ReceiveScore", (nickname, score) => {
    scores[nickname] = score;
    checkIfAllAnswered();
});

// Слушатель: Финиш игры
connection.on("GameFinished", () => {
    window.location.href = "finish.html";
});

async function startSignalR() {
    try {
        await connection.start();
        console.log("🟢 Connected to Hub");
        if (lobbyPin) {
            await connection.invoke("JoinLobby", lobbyPin, myNickname);
        }
    } catch (err) {
        console.error("SignalR Error: ", err);
    }
}

// ---------------- GAME LOGIC ----------------

async function syncQuizData() {
    const quizId = localStorage.getItem("selectedQuizId");
    if (!quizId) return;

    try {
        const response = await fetch(`${API_URL}/api/quizzes/${quizId}`);
        if (response.ok) {
            const quiz = await response.json();
            questions = quiz.questions;
            localStorage.setItem("quiz", JSON.stringify(questions));
            console.log("✅ Questions synced:", questions.length);
        }
    } catch (err) {
        console.error("Sync Error:", err);
    }
}

function loadLobby() {
    const pinDisplay = document.getElementById("pin");
    if (pinDisplay) pinDisplay.innerText = lobbyPin || "---";
    
    // Скрываем кнопку старта для обычных игроков
    const startBtn = document.querySelector("button[onclick='startGame()']");
    if (startBtn && !isHost) startBtn.style.display = "none";
}

async function startGame() {
    if (!isHost) return;
    // Отправляем сигнал всем игрокам начать игру
    await connection.invoke("StartGame", lobbyPin);
    window.location.href = "Game.html";
}

function loadGame() {
    const saved = localStorage.getItem("quiz");
    if (saved) questions = JSON.parse(saved);

    if (!questions.length) {
        alert("No questions found!");
        return;
    }
    showQuestion();
}

function showQuestion() {
    if (currentQuestion >= questions.length) {
        handleQuizEnd();
        return;
    }

    const q = questions[currentQuestion];
    const qText = document.getElementById("question");
    const options = document.querySelectorAll(".option-btn");

    if (qText) qText.innerText = q.text;
    options.forEach((btn, i) => {
        btn.innerText = q.options[i] || "";
        btn.onclick = () => submitAnswer(i);
        btn.classList.remove("opacity-50", "pointer-events-none", "bg-neon", "text-indigo");
    });

    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 30;
    const bar = document.getElementById("timerBar");
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (bar) bar.style.width = (timeLeft / 30 * 100) + "%";

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitAnswer(-1); // Авто-ответ (0 очков) если время вышло
        }
    }, 100);
}

async function submitAnswer(index) {
    clearInterval(timerInterval);
    
    // Блокируем кнопки
    const options = document.querySelectorAll(".option-btn");
    options.forEach(btn => btn.classList.add("opacity-50", "pointer-events-none"));

    let points = 0;
    const correctIdx = questions[currentQuestion].correctAnswerIndex;

    if (index === correctIdx) {
        points = Math.round(timeLeft * 10); // Очки зависят от скорости
        if (options[index]) {
            options[index].classList.remove("opacity-50");
            options[index].classList.add("bg-neon", "text-indigo");
        }
    }

    // Хост не участвует в рейтинге
    if (!isHost) {
        await connection.invoke("SendScore", lobbyPin, myNickname, points);
    }

    // Если это был последний вопрос, ждем хоста. Если нет - переключаем сами (в демо)
    // В реальной синхронной игре хост жмет "Next", но для удобства сделаем задержку:
    setTimeout(() => {
        if (isHost) {
            connection.invoke("TriggerNextQuestion", lobbyPin, currentQuestion + 1);
        }
    }, 2000);
}

function handleQuizEnd() {
    const quizArea = document.getElementById("quiz");
    if (quizArea) {
        quizArea.innerHTML = `
            <h2 class="text-3xl font-black text-neon">QUIZ FINISHED!</h2>
            <p class="opacity-70 mt-4">${isHost ? "Wait for all players to finish..." : "Waiting for the Host to publish results..."}</p>
            <div id="hostControls" class="mt-6"></div>
        `;
    }
    if (isHost) showHostPublishButton();
}

function showHostPublishButton() {
    const controlArea = document.getElementById("hostControls");
    if (!controlArea) return;

    controlArea.innerHTML = `
        <button onclick="publishResults()" class="btn-neon px-8 py-4 rounded-2xl font-bold shadow-lg">
            PUBLISH RESULTS
        </button>
    `;
}

async function publishResults() {
    await connection.invoke("FinishGame", lobbyPin);
}

// ---------------- INIT ----------------
window.onload = async function () {
    const path = window.location.pathname.toLowerCase();
    
    // Подключаемся к сокетам ТОЛЬКО если мы в лобби или в игре
    if (path.includes("lobby.html") || path.includes("game.html")) {
        await startSignalR();
        await syncQuizData();
        
        if (path.includes("lobby.html")) loadLobby();
        if (path.includes("game.html")) loadGame();
    }
};