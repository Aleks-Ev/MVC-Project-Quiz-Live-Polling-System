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
// 1. Проверяем API_URL в window
if (!window.API_URL) {
    window.API_URL = "http://localhost:5178/api";
}

// 2. Проверяем connection в window
if (!window.connection) {
    window.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${window.API_URL.replace('/api', '')}/api/quizhub`)
        .configureLogging(signalR.LogLevel.Information)
        .build();
}

// 3. Используем другие имена для локальных переменных, 
// чтобы не пытаться перезаписать константы из auth.js
var activeAPI = window.API_URL;
var activeConn = window.connection;

// Слушатель: Обновление списка игроков
activeConn.on("UpdatePlayers", (updatedPlayers) => {
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

// Слушатель: Массовый старт игры
activeConn.on("GameStarted", () => {
    console.log("🚀 Game starting...");
    window.location.href = "Game.html"; 
});

// Слушатель: Синхронный старт вопроса
activeConn.on("NextQuestion", (questionIndex) => {
    currentQuestion = questionIndex;
    showQuestion();
});

// Слушатель: Сбор очков в реальном времени (для хоста)
activeConn.on("ReceiveScore", (nickname, score) => {
    scores[nickname] = score;
    checkIfAllAnswered();
});

// Слушатель финиша (у всех игроков)
activeConn.on("GameFinished", (finalScoresArray) => {
    // Сохраняем именно под тем ключом, который ищет finish.html
    localStorage.setItem("finalScores", JSON.stringify(finalScoresArray));
    window.location.href = "finish.html";
});

async function startSignalR() {
    try {
        await activeConn.start();
        console.log("🟢 Connected to Hub");
        if (lobbyPin) {
            await activeConn.invoke("JoinLobby", lobbyPin, myNickname);
        }
    } catch (err) {
        console.error("SignalR Error: ", err);
    }
}

// ---------------- GAME LOGIC ----------------

async function syncQuizData() {
    // Берем или ID выбранного квиза (для хоста), или ПИН лобби (для игрока)
    const quizId = localStorage.getItem("selectedQuizId") || localStorage.getItem("lobbyPin");
    
    if (!quizId) {
        console.error("❌ No Quiz ID found in localStorage!");
        return;
    }

    try {
        // ВАЖНО: Проверь, чтобы путь точно был /api/quizzes/
        const response = await fetch(`${activeAPI}/quizzes/${quizId}`);
        
        if (response.ok) {
            const quiz = await response.json();
            // Сохраняем вопросы
            questions = quiz.questions;
            localStorage.setItem("quiz", JSON.stringify(questions));
            console.log(" Questions synced:", questions.length);
        } else {
            console.error("❌ Server returned error:", response.status);
            // Если квиз не найден, возможно ПИН не совпадает с ID в базе
        }
    } catch (err) {
        console.error("🌐 Connection error:", err);
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
    try {
        // Просто уведомляем сервер, а сервер уже ответит всем через "GameStarted"
        await activeConn.invoke("StartGame", lobbyPin);
    } catch (err) {
        console.error("Error starting game:", err);
    }
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
        await activeConn.invoke("SendScore", lobbyPin, myNickname, points);
    }

    // Если это был последний вопрос, ждем хоста. Если нет - переключаем сами (в демо)
    // В реальной синхронной игре хост жмет "Next", но для удобства сделаем задержку:
    setTimeout(() => {
        if (isHost) {
            activeConn.invoke("TriggerNextQuestion", lobbyPin, currentQuestion + 1);
        }
    }, 2000);
}

function handleQuizEnd() {
    const quizArea = document.getElementById("quiz");
    if (quizArea) {
        quizArea.innerHTML = `
            <h2 class="text-3xl font-white text-neon">QUIZ FINISHED!</h2>
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

// Функция хоста для публикации
async function publishResults() {
    // Превращаем { "Ivan": 100, "Oleg": 80 } в [{nickname: "Ivan", score: 100}, ...]
    const resultsArray = Object.entries(scores).map(([name, score]) => ({
        nickname: name,
        score: score
    }));

    // Отправляем всем через SignalR (нужно добавить аргумент в invoke)
    await activeConn.invoke("FinishGame", lobbyPin, resultsArray);
}

function loadResults() {
    const resultsRaw = localStorage.getItem("finalResults");
    if (!resultsRaw) return;

    const results = JSON.parse(resultsRaw);
    // Превращаем объект в массив и сортируем по очкам (от большего к меньшему)
    const sorted = Object.entries(results)
        .sort(([,a], [,b]) => b - a);

    // Пример заполнения пьедестала (нужны ID элементов в HTML)
    if (sorted[0]) document.getElementById("rank-1-name").innerText = sorted[0][0];
    if (sorted[1]) document.getElementById("rank-2-name").innerText = sorted[1][0];
    if (sorted[2]) document.getElementById("rank-3-name").innerText = sorted[2][0];
}

// Вызываем при загрузке страницы результатов
if (window.location.pathname.includes("finish.html")) {
    loadResults();
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