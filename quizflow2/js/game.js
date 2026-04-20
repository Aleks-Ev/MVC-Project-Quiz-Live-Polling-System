// ---------------- GLOBAL STATE ----------------
let players = [];
let scores = {};
let currentQuestion = 0;
let startTime = 0;
let timerInterval;
let timeLeft = 10;
let questions = []; // Теперь подгружаем динамически


// Эта функция скачивает вопросы с сервера, если мы знаем ID квиза
async function syncQuizData() {
    const quizId = localStorage.getItem("selectedQuizId");
    
    // Если мы не выбрали квиз или вопросы уже загружены — ничего не делаем
    if (!quizId || questions.length > 0) return;

    try {
        const response = await fetch(`http://localhost:5178/api/quizzes/${quizId}`);
        if (response.ok) {
            const quiz = await response.json();
            questions = quiz.questions; // Кладём вопросы из базы в наш массив
            console.log("✅ Данные квиза получены с сервера!");
        } else {
            console.error("❌ Квиз не найден на сервере (404)");
        }
    } catch (err) {
        console.error("❌ Ошибка сети:", err);
    }
}

// ---------------- SIGNALR ----------------
const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5178/quizhub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

connection.on("ShowResults", () => {
    showLeaderboard();
});

// Обработчики SignalR
connection.on("PlayerJoined", (user) => {
    let playersArr = JSON.parse(localStorage.getItem("players")) || [];
    if (!playersArr.includes(user)) {
        playersArr.push(user);
        localStorage.setItem("players", JSON.stringify(playersArr));
    }
    if (document.getElementById("pin")) loadLobby();
});

connection.on("ScoreUpdated", (user, score) => {
    scores[user] = score;
    if (document.getElementById("leaderboardList")) showLeaderboard();
});

connection.on("UpdatePlayerList", (serverPlayers) => {
    localStorage.setItem("players", JSON.stringify(serverPlayers));
    if (document.getElementById("pin")) loadLobby();
});

connection.on("GameStarted", () => {
    window.location.href = "Game.html";
});

async function startSignalR() {
    if (connection.state === signalR.HubConnectionState.Connected) return;

    try {
        await connection.start();

        const pin = localStorage.getItem("lobbyPin");
        const isHost = localStorage.getItem("isHost") === "true";
        
        // Если я хост, мой ник - это моё имя из профиля, иначе берем ник игрока
        let myNick = isHost ? (localStorage.getItem("userName") || "Host") : "Guest";
        
        // Если мы в лобби как игрок, берем введенный ник
        const playersArr = JSON.parse(localStorage.getItem("players")) || [];
        if (!isHost && playersArr.length > 0) {
            myNick = playersArr[0];
        }

        if (pin) {
            console.log(`Joining as ${isHost ? 'HOST' : 'PLAYER'}: ${myNick}`);
            await connection.invoke("JoinLobby", pin, myNick);
        }
    } catch (err) {
        console.error("SignalR Connection Error:", err);
    }
}



// ---------------- ACTIONS ----------------

async function createLobbyFromSelected() {
    const selectedId = localStorage.getItem("selectedQuizId");
    if (!selectedId) return alert("Select a quiz first!");

    localStorage.removeItem("players"); // Удаляем старых игроков перед созданием нового лобби

    const myQuizzes = JSON.parse(localStorage.getItem("mySavedQuizzes")) || [];
    const quizData = myQuizzes.find(q => q.id === selectedId);

    if (quizData) {
        try {
            const response = await fetch("http://localhost:5178/api/quizzes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: quizData.id, 
                    title: quizData.title, // Добавил title на всякий случай
                    questions: quizData.questions 
                })
            });

            // Если response.ok (200) ИЛИ если сервер вернул ошибку, но квиз уже там (например, 500 или 409)
            // Мы всё равно переходим в лобби, так как данные на сервере уже есть
            if (response.ok || response.status === 500) { 
                console.log("Lobby ready (either created or already existed)");
                localStorage.setItem("lobbyPin", quizData.id);
                localStorage.setItem("isHost", "true");
                localStorage.setItem("quiz", JSON.stringify(quizData.questions));
                window.location.href = "Lobby.html";
            } else {
                alert("Server error: " + response.status);
            }
        } catch (err) {
            console.error("Connection error:", err);
            alert("Make sure your Backend is running!");
        }
    }
}

async function joinGame() {
    // Очищаем всё старое перед входом
    localStorage.removeItem("quiz");
    localStorage.removeItem("players");
    localStorage.removeItem("lobbyPin");
    const pin = document.getElementById("pinInput").value.toUpperCase().trim();
    const nickname = document.getElementById("nickname").value.trim();
    if (!pin || !nickname) return alert("Fill all fields!");

    try {
        const response = await fetch(`http://localhost:5178/api/quizzes/${pin}`);
        if (response.ok) {
            const quizData = await response.json();
            const qs = quizData.questions || quizData.Questions;
            if (qs) {
                localStorage.setItem("quiz", JSON.stringify(qs));
                localStorage.setItem("lobbyPin", pin);
                localStorage.setItem("players", JSON.stringify([nickname]));
                localStorage.setItem("isHost", "false");
                window.location.href = "Lobby.html";
            }
        } else { alert("Lobby not found!"); }
    } catch (err) { console.error(err); }
}

// ---------------- LOBBY & GAME LOGIC ----------------

async function loadLobby() {
    const pin = localStorage.getItem("lobbyPin");
    const playersList = JSON.parse(localStorage.getItem("players")) || [];
    const isHost = localStorage.getItem("isHost") === "true";
    const selectedId = localStorage.getItem("selectedQuizId"); // ID квиза, который мы выбрали

    // 1. Отображаем ПИН и игроков (твой старый код)
    if (document.getElementById("pin")) document.getElementById("pin").innerText = pin;
    const list = document.getElementById("players");
    if (list) {
        list.innerHTML = playersList.map(p => 
            `<li class="bg-purple-100 p-3 rounded-xl flex justify-between animate-fade-in">
                <span>${p}</span><span>READY</span>
            </li>`).join("");
    }

    // 2. Убираем кнопку у игрока
    const startBtn = document.querySelector("button[onclick='startGame()']");
    if (startBtn && !isHost) startBtn.remove();

    // 3. НОВОЕ: Если мы хост, подтягиваем вопросы с сервера, чтобы они были готовы к старту
    if (isHost && selectedId && questions.length === 0) {
        try {
            const response = await fetch(`http://localhost:5178/api/quizzes/${selectedId}`);
            if (response.ok) {
                const quiz = await response.json();
                questions = quiz.questions; // Записываем вопросы в глобальную переменную
                console.log("Quiz loaded from server:", quiz.title);
            }
        } catch (err) {
            console.error("Failed to load quiz questions:", err);
        }
    }
}

async function startGame() {
    const pin = localStorage.getItem("lobbyPin");
    if (connection.state === signalR.HubConnectionState.Connected) {
        await connection.invoke("StartGame", pin);
    }
}

function loadGame() {
    const quizData = localStorage.getItem("quiz");
    
    if (!quizData || quizData === "undefined" || quizData === "[]") {
        console.error("Данные квиза отсутствуют в localStorage!");
        const questionEl = document.getElementById("question");
        if (questionEl) {
            questionEl.innerHTML = "<span class='text-red-500'>Error: Questions not loaded. Please go back to Dashboard.</span>";
        }
        return; // Останавливаем выполнение, чтобы не сработал финиш
    }

    questions = JSON.parse(quizData);
    currentQuestion = 0;
    scores = {}; // Сбрасываем очки перед началом
    showQuestion();
}

function showQuestion() {
    if (!questions[currentQuestion]) return showLeaderboard();

    const q = questions[currentQuestion];
    document.getElementById("question").innerText = q.q || q.QuestionText || "No text";

    const options = document.querySelectorAll(".option-btn");
    const answers = q.answers || q.Answers || [];

    options.forEach((btn, i) => {
        if (answers[i]) {
            btn.innerText = answers[i];
            btn.style.display = "flex";
            btn.onclick = () => submitAnswer(i);
        } else {
            btn.style.display = "none";
        }
    });
    startTimer();
}

function startTimer() {
    timeLeft = 10;
    startTime = Date.now();
    const bar = document.getElementById("timerBar");
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (bar) bar.style.width = (timeLeft / 10 * 100) + "%";
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            autoNext();
        }
    }, 100);
}

async function submitAnswer(index) {
    clearInterval(timerInterval);
    // Блокируем кнопки, чтобы не кликали дважды
    document.querySelectorAll(".option-btn").forEach(b => b.onclick = null);

    const q = questions[currentQuestion];
    const correctIdx = q.correct !== undefined ? q.correct : q.Correct;
    const playersArr = JSON.parse(localStorage.getItem("players")) || [];
    const player = playersArr[0] || "Guest";

    if (index === correctIdx) {
        const points = Math.max(1000 - Math.floor((Date.now() - startTime) / 10), 100);
        scores[player] = (scores[player] || 0) + points;
        
        try {
            const pin = localStorage.getItem("lobbyPin");
            if (connection.state === signalR.HubConnectionState.Connected) {
                await connection.invoke("UpdateScore", pin, player, scores[player]);
            }
        } catch (e) { console.error("Score sync error"); }
    }

    setTimeout(autoNext, 1000);
}

function autoNext() {
    currentQuestion++;

    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        // ВАЖНО: вместо showLeaderboard() вызываем showFinishScreen()
        showFinishScreen(); 
    }
}

function showFinishScreen() {
    const isHost = localStorage.getItem("isHost") === "true";
    const quizSection = document.getElementById("quiz");
    
    if (quizSection) {
        quizSection.innerHTML = `
            <div class="space-y-6 py-10 flex flex-col items-center justify-center">
                <h2 class="text-4xl font-black text-purple-800">Quiz Finished!</h2>
                <p class="text-gray-600">All questions answered. Waiting for the final scores...</p>
                ${isHost ? `
                    <button onclick="broadcastShowResults()" 
                        class="mt-6 bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-black py-4 px-10 rounded-2xl shadow-xl transition transform hover:scale-110 active:scale-95">
                        SHOW FINAL RESULTS 🏆
                    </button>
                ` : '<div class="mt-4 animate-pulse text-purple-600 font-bold italic">Waiting for host to reveal winners...</div>'}
            </div>
        `;
    }
}

async function broadcastShowResults() {
    const pin = localStorage.getItem("lobbyPin");
    try {
        if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("ShowResults", pin);
        } else {
            showLeaderboard();
        }
    } catch (err) {
        console.error("SignalR Invoke Error:", err);
        showLeaderboard();
    }
}
function showLeaderboard() {
    const quizSection = document.getElementById("quiz");
    const boardSection = document.getElementById("leaderboard");
    if (quizSection) quizSection.classList.add("hidden");
    if (boardSection) {
        boardSection.classList.remove("hidden");
        const list = document.getElementById("leaderboardList");
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        list.innerHTML = sorted.map(([name, score], i) => `
            <div class="flex justify-between p-2 border-b">
                <span>${i + 1}. ${name}</span>
                <span class="font-bold">${score}</span>
            </div>
        `).join("");
    }
}

// ---------------- INIT ----------------
window.onload = async function () {
    const path = window.location.pathname;

    // 1. Сначала всегда подключаемся к SignalR
    await startSignalR();

    // 2. Определяем страницу
    if (path.includes("Lobby.html")) {
        // Сначала грузим данные квиза, потом отрисовываем лобби
        await syncQuizData(); 
        loadLobby();
    } 
    else if (path.includes("Game.html")) {
        // Перед стартом игры убеждаемся, что вопросы загружены
        await syncQuizData();
        loadGame();
    } 
    else if (path.includes("dashboard.html")) {
        displayUserDashboard();
    }
};