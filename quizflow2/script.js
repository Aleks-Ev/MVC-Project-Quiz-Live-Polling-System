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
        localStorage.setItem("isHost", "true");

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
            // Внутри joinGame, после localStorage.setItem("players", ...)
            const updatedPlayers = JSON.parse(localStorage.getItem("players"));
            await connection.invoke("SyncPlayers", pin, updatedPlayers);

            window.location.href = "Lobby.html";
        } else {
            alert("Lobby not found!");
        }
    } catch (error) {
        alert("Server error!");
    }
}

// ---------------- LOBBY ----------------
// Настройка соединения с сервером
const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5178/quizhub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

// Слушаем событие: когда кто-то зашел в наше лобби
connection.on("PlayerJoined", (user) => {
    let currentPlayers = JSON.parse(localStorage.getItem("players")) || [];
    if (!currentPlayers.includes(user)) {
        currentPlayers.push(user);
        localStorage.setItem("players", JSON.stringify(currentPlayers));
    }
    loadLobby(); // Это перерисует список и скроет/покажет кнопку
});

// Слушаем событие: когда хост нажал "Start"
connection.on("GameStarted", () => {
    window.location.href = "Game.html";
});
// Добавь это там, где у тебя connection.on(...)
connection.on("ScoreUpdated", (user, score) => {
    scores[user] = score; // Обновляем общий объект scores данными от других игроков
    console.log(`Счет игрока ${user} теперь ${score}`);
});
connection.on("UpdatePlayerList", (serverPlayers) => {
    console.log("Синхронизация списка игроков:", serverPlayers);
    localStorage.setItem("players", JSON.stringify(serverPlayers));
    // Если мы в лобби, обновляем экран
    if (window.location.href.includes("Lobby.html")) {
        loadLobby();
    }
});

// Запускаем соединение
async function startSignalR() {
    try {
        await connection.start();
        console.log("SignalR подключен!");
        
        // Если мы уже в лобби, нужно сообщить серверу, в какую "комнату" мы зашли
        const pin = localStorage.getItem("lobbyPin");
        const nick = localStorage.getItem("players") ? JSON.parse(localStorage.getItem("players"))[0] : "Guest";
        
        if (pin) {
            await connection.invoke("JoinLobby", pin, nick);
        }
    } catch (err) {
        console.error("Ошибка подключения:", err);
    }
}
function loadLobby() {
    const pin = localStorage.getItem("lobbyPin");
    const playersList = JSON.parse(localStorage.getItem("players")) || [];

    const pinEl = document.getElementById("pin");
    const list = document.getElementById("players");
    
    // 1. Находим кнопку старта по её тексту или onclick
    const startBtn = document.querySelector("button[onclick='startGame()']");

    if (pinEl) pinEl.innerText = pin || "----";

    // 2. ЛОГИКА СКРЫТИЯ КНОПКИ
    // Проверяем: если в локальной памяти НЕТ ника "Host", значит мы зашли как игрок
    const isHost = playersList.includes("Host");

    if (startBtn) {
        // Если это не хост — полностью удаляем кнопку из DOM для надежности
        if (!isHost) {
            startBtn.remove(); 
        }
    }

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

async function startGame() {
    const pin = localStorage.getItem("lobbyPin");

    try {
        // 1. Отправляем сигнал на бэкенд в наш QuizHub
        await connection.invoke("StartGame", pin); 
        
        // ПРИМЕЧАНИЕ: Самим делать window.location.href здесь НЕ ОБЯЗАТЕЛЬНО, 
        // так как сервер пришлет команду "GameStarted" в том числе и нам.
        // Но для скорости можно оставить:
        window.location.href = "Game.html";
    } catch (err) {
        console.error("Ошибка при запуске игры:", err);
        alert("Не удалось запустить игру");
    }
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
async function answer(index) {
    clearInterval(timerInterval);

    const q = questions[currentQuestion];
    // Берем имя текущего игрока (обычно оно первое в списке для этого браузера)
    const player = JSON.parse(localStorage.getItem("players"))[0] || "Guest";
    const pin = localStorage.getItem("lobbyPin");

    const timeTaken = (Date.now() - startTime) / 1000;
    const grid = document.getElementById("optionsGrid");

    let isCorrect = (index === q.correct);

    if (grid) {
        const options = grid.querySelectorAll(".option-btn");

        if (isCorrect) {
            options[index].classList.add("bg-green-100", "border-green-500");
            
            // Считаем бонус за скорость
            let points = Math.max(1000 - Math.floor(timeTaken * 100), 100);
            scores[player] = (scores[player] || 0) + points;
        } else {
            options[index].classList.add("bg-red-100", "border-red-500");
            options[q.correct].classList.add("bg-green-100");
            // При ошибке очки не прибавляем (или можно вычитать, если хочешь жесткую игру)
        }
    } else {
        // Fallback для простого интерфейса
        if (isCorrect) {
            scores[player] = (scores[player] || 0) + 500;
            alert("Correct!");
        } else {
            alert("Wrong!");
        }
    }

    // --- ОТПРАВКА НА СЕРВЕР ---
    // После того как обновили свой счет, сообщаем об этом всем остальным
    try {
        if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("UpdateScore", pin, player, scores[player]);
        }
    } catch (err) {
        console.error("Не удалось отправить счет:", err);
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
    startSignalR(); // Запускаем "живую" связь при загрузке любой страницы
};