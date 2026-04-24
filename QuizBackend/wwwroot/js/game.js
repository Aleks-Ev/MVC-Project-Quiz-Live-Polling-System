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
let myTotalScore = 0; // Накопительный счет игрока

// Проверяем, если API_URL уже был объявлен (например, в auth.js), используем его. 
// 1. Проверяем API_URL в window
if (!window.API_URL) {
    window.API_URL = "https://ferret-detention-giggling.ngrok-free.dev/api";
}

// 2. Проверяем connection в window
if (!window.connection) {
    window.connection = new signalR.HubConnectionBuilder()
        .withUrl("https://ferret-detention-giggling.ngrok-free.dev/api/quizhub", {
            headers: {
                "ngrok-skip-browser-warning": "69420"
            }
        })
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
    //checkIfAllAnswered();
});

// Слушатель финиша (у всех игроков)
activeConn.on("GameFinished", (finalScoresArray) => {
    console.log("🏁 Финальные очки от сервера:", finalScoresArray);
    
    // ВАЖНО: сохраняем под ключом 'finalResults'
    localStorage.setItem("finalResults", JSON.stringify(finalScoresArray));
    
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
    const quizId = localStorage.getItem("selectedQuizId") || localStorage.getItem("lobbyPin");
    const token = localStorage.getItem("userToken"); // ОБЯЗАТЕЛЬНО достаем токен

    if (!quizId) {
        console.error("❌ No Quiz ID found!");
        return;
    }

    try {
        const response = await fetch(`${activeAPI}/quizzes/${quizId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                // ДОБАВЛЯЕМ АВТОРИЗАЦИЮ:
                "Authorization": `Bearer ${token}`, 
                "ngrok-skip-browser-warning": "69420"
            }
        });
        
        if (response.ok) {
            const quiz = await response.json();
            questions = quiz.questions;
            localStorage.setItem("quiz", JSON.stringify(questions));
            console.log("✅ Questions synced:", questions.length);
        } else if (response.status === 401) {
            console.error("❌ Auth Error: Token is missing or expired");
            // Можно редиректнуть на логин, если это критично
        }
    } catch (err) {
        console.error("🌐 Connection error:", err);
    }
}

async function loadLobby() {
    // 1. Локальная очистка (твой код)
    players = []; 
    scores = {}; 
    myTotalScore = 0;
    localStorage.removeItem("finalResults");
    localStorage.removeItem("finalScores");

    // 2. Серверная очистка (Добавляем это!)
    // Если я ХОСТ и соединение уже есть, просим сервер забыть старых игроков
    if (isHost && window.connection && window.connection.state === signalR.HubConnectionState.Connected) {
        try {
            await window.connection.invoke("ClearLobbyServer", lobbyPin);
            console.log("🧹 Список игроков на сервере успешно очищен");
        } catch (err) {
            console.error("Не удалось очистить лобби на сервере:", err);
        }
    }

    // 3. Отображение ПИН-кода (твой код)
    const pinDisplay = document.getElementById("pin");
    if (pinDisplay) pinDisplay.innerText = lobbyPin || "---";
    
    // 4. Права доступа (твой код)
    const startBtn = document.querySelector("button[onclick='startGame()']");
    if (startBtn) {
        startBtn.style.display = isHost ? "block" : "none";
    }

    console.log("🚀 Лобби готово. Роль:", isHost ? "HOST" : "PLAYER");
}

async function startGame() {
    if (!isHost) return;

    // ОЧИЩАЕМ СТАРЫЕ ДАННЫЕ ПЕРЕД НАЧАЛОМ
    localStorage.removeItem("finalResults"); 
    scores = {}; 
    myTotalScore = 0;

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
    
    // 1. Блокируем кнопки, чтобы нельзя было нажать дважды
    const options = document.querySelectorAll(".option-btn");
    options.forEach(btn => btn.classList.add("opacity-50", "pointer-events-none"));

    // 2. Считаем очки за ТЕКУЩИЙ вопрос
    let currentQuestionPoints = 0;
    const correctIdx = questions[currentQuestion].correctAnswerIndex;

    if (index === correctIdx) {
        // Рассчитываем бонус за скорость
        currentQuestionPoints = Math.round(timeLeft * 10); 
        
        // Прибавляем к ОБЩЕМУ счету игрока
        myTotalScore += currentQuestionPoints;

        // Подсвечиваем правильный выбор
        if (options[index]) {
            options[index].classList.remove("opacity-50");
            options[index].classList.add("bg-neon", "text-indigo");
        }
        console.log(`✅ Правильно! +${currentQuestionPoints} очков. Всего: ${myTotalScore}`);
    } else {
        console.log(`❌ Ошибка. Правильный индекс был: ${correctIdx}. Всего очков: ${myTotalScore}`);
    }

    // 3. Отправляем ОБЩИЙ накопленный счет на сервер (SignalR)
    // Хост не участвует в рейтинге, только обычные игроки
    if (!isHost) {
        try {
            // ВАЖНО: Отправляем myTotalScore, а не points за один вопрос
            await activeConn.invoke("SendScore", lobbyPin, myNickname, myTotalScore);
        } catch (err) {
            console.error("Ошибка отправки очков:", err);
        }
    }

    // 4. Переход к следующему вопросу (через задержку 2 секунды)
    setTimeout(() => {
        if (isHost) {
            // Если это хост, он дает команду серверу переключить вопрос для ВСЕХ
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
    console.log("Current scores object:", scores); // Посмотри в консоль хоста перед нажатием!

    const resultsArray = Object.entries(scores).map(([name, score]) => ({
        nickname: name,
        score: score
    }));

    if (resultsArray.length === 0) {
        alert("Wait! No scores collected yet.");
        return;
    }

    await activeConn.invoke("FinishGame", lobbyPin, resultsArray);
}

//function loadResults() {
    //const resultsRaw = localStorage.getItem("finalResults");
    //if (!resultsRaw) {
        //document.getElementById("rank-1-name").innerText = "—";
        //document.getElementById("rank-2-name").innerText = "—";
        //document.getElementById("rank-3-name").innerText = "—";
        //return;
    //}

    //const results = JSON.parse(resultsRaw); 
    // results теперь это массив: [{nickname: "Ivan", score: 100}, ...]

    // Сортируем массив по score (от большего к меньшему)
    //const sorted = results.sort((a, b) => b.score - a.score);

    // 1. Заполняем подиум (имена)
    //if (sorted[0]) document.getElementById("rank-1-name").innerText = sorted[0].nickname;
    //if (sorted[1]) document.getElementById("rank-2-name").innerText = sorted[1].nickname;
    //if (sorted[2]) document.getElementById("rank-3-name").innerText = sorted[2].nickname;

    // 2. Заполняем таблицу (Detailed Statistics), если она есть в HTML
    //const list = document.getElementById("resultsList"); // Убедись, что такой ID есть в finish.html
    //if (list) {
        //list.innerHTML = sorted.map((p, i) => `
            //<div class="flex justify-between items-center bg-white/5 p-4 rounded-xl mb-2">
                //<span class="font-bold text-neon">#${i + 1} ${p.nickname}</span>
                //<span class="font-mono">${p.score} pts</span>
            //</div>
        //`).join("");
    //}
//}

// Вызываем при загрузке страницы результатов
//if (window.location.pathname.includes("finish.html")) {
    //loadResults();
//}

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