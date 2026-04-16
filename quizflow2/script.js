// ---------------- 1. GLOBAL STATE ----------------
let players = [];
let scores = {};
let createdQuestions = [];
let selectedQuizId = null;
let currentQuestion = 0;
let startTime = 0;
let timerInterval;
let timeLeft = 10;

// Fallback questions if no quiz data is loaded
let questions = JSON.parse(localStorage.getItem("quiz")) || [
    { q: "Welcome to QuizFlow!", answers: ["Let's", "Go", "Ready", "Start"], correct: 1 }
];

// ---------------- 2. SIGNALR SETUP ----------------
const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5178/quizhub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

/**
 * Starts SignalR connection and joins a specific lobby room
 */
async function startSignalR() {
    if (connection.state === signalR.HubConnectionState.Connected) return;
    try {
        await connection.start();
        console.log("SignalR Connected!");
        
        const pin = localStorage.getItem("lobbyPin");
        const playersArr = JSON.parse(localStorage.getItem("players")) || [];
        const nick = playersArr[0] || "Guest";
        
        if (pin) await connection.invoke("JoinLobby", pin, nick);
    } catch (err) { 
        console.error("SignalR Error: ", err); 
    }
}

// Server-side event listeners
connection.on("PlayerJoined", (user) => {
    let currentPlayers = JSON.parse(localStorage.getItem("players")) || [];
    if (!currentPlayers.includes(user)) {
        currentPlayers.push(user);
        localStorage.setItem("players", JSON.stringify(currentPlayers));
    }
    if (window.location.href.includes("Lobby.html")) loadLobby();
});

// В секцию 2. SIGNALR SETUP в script.js
connection.on("ScoreUpdated", (user, score) => { 
    // Обновляем баллы конкретного пользователя в нашем списке
    scores[user] = score; 
    
    // Если мы уже на странице лидерборда, сразу перерисовываем его
    if (document.getElementById("leaderboardList")) {
        showLeaderboard(); 
    }
});

connection.on("ScoreUpdated", (user, score) => { 
    scores[user] = score; 
});

connection.on("UpdatePlayerList", (serverPlayers) => {
    localStorage.setItem("players", JSON.stringify(serverPlayers));
    if (window.location.href.includes("Lobby.html")) loadLobby();
});

// ---------------- 3. NAVIGATION & AUTHENTICATION ----------------

/**
 * Redirects user based on authentication status
 */
function goHome() {
    const token = localStorage.getItem("userToken");
    window.location.href = token ? "dashboard.html" : "start.html";
}

/**
 * Clears session and returns to home page
 */
function logout() {
    localStorage.clear();
    window.location.href = "start.html";
}

/**
 * Simple demo login logic
 */
function login() {
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPassword").value;
    if (email && pass) {
        localStorage.setItem("userToken", "fake-jwt-token");
        localStorage.setItem("userName", email.split('@')[0]); 
        window.location.href = "dashboard.html";
    } else { 
        alert("Please fill all fields!"); 
    }
}

/**
 * Simple demo registration logic
 */
function register() {
    const name = document.getElementById("regName").value;
    const pass = document.getElementById("regPass").value;
    const confirm = document.getElementById("regPassConfirm").value;
    if (name && pass === confirm) {
        alert("Success! Now Sign In.");
        window.location.href = "Authorization.html";
    } else { 
        alert("Check your inputs!"); 
    }
}

// ---------------- 4. DASHBOARD (USER ACCOUNT) ----------------

/**
 * Displays user's name and triggers quiz list rendering
 */
function displayUserDashboard() {
    const userName = localStorage.getItem("userName") || "Guest";
    const greeting = document.getElementById("userGreeting");
    if (greeting) greeting.innerText = `Hi, ${userName}!`;
    renderQuizList();
}

/**
 * Renders the list of quizzes saved in localStorage
 */
function renderQuizList() {
    const listCont = document.getElementById("quizList");
    if (!listCont) return;
    const myQuizzes = JSON.parse(localStorage.getItem("mySavedQuizzes")) || [];
    
    listCont.innerHTML = myQuizzes.length === 0 
        ? `<p class="text-center py-10 opacity-50">No quizzes yet...</p>` 
        : "";
    
    myQuizzes.slice().reverse().forEach(quiz => {
        const card = document.createElement("div");
        const isActive = selectedQuizId === quiz.id;
        
        card.className = `p-4 rounded-2xl cursor-pointer transition shadow-sm flex justify-between ${isActive ? 'bg-purple-600 text-white' : 'bg-white hover:bg-purple-50'}`;
        card.innerHTML = `
            <div>
                <div class="font-bold">${quiz.title}</div>
                <div class="text-xs ${isActive ? 'text-purple-100' : 'text-gray-400'}">${quiz.questions.length} Questions</div>
            </div>
            <div class="text-xs font-mono opacity-50">${quiz.id}</div>
        `;
        
        card.onclick = () => { 
            selectedQuizId = quiz.id; 
            renderQuizList(); 
            toggleLobbyBtn(true); 
        };
        listCont.appendChild(card);
    });
}

/**
 * Enables or disables the "Create Lobby" button
 */
function toggleLobbyBtn(active) {
    const btn = document.getElementById("createLobbyBtn");
    if (!btn) return;
    btn.disabled = !active;
    btn.className = active 
        ? "bg-purple-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-purple-700 transition" 
        : "bg-gray-300 text-white px-6 py-2 rounded-xl cursor-not-allowed";
}

/**
 * Prepares lobby data and redirects to Lobby page
 */
async function createLobbyFromSelected() {
    const myQuizzes = JSON.parse(localStorage.getItem("mySavedQuizzes")) || [];
    const selected = myQuizzes.find(q => q.id === selectedQuizId);
    if (selected) {
        localStorage.setItem("lobbyPin", selected.id);
        localStorage.setItem("quiz", JSON.stringify(selected.questions));
        localStorage.setItem("players", JSON.stringify(["Host"]));
        localStorage.setItem("isHost", "true");
        window.location.href = "Lobby.html";
    }
}

// ---------------- 5. QUIZ CREATION ----------------

function nextStep() {
    const title = document.getElementById("quizTitle").value.trim();
    if (!title) return alert("Enter name!");
    document.getElementById("stepName").classList.add("hidden");
    document.getElementById("stepQuestions").classList.remove("hidden");
    document.getElementById("displayTitle").innerText = title;
}

/**
 * Adds a single question object to the temporary array
 */
function addQuestion() {
    const question = document.getElementById("questionInput").value.trim();
    const answers = Array.from(document.querySelectorAll(".answer")).map(a => a.value.trim());
    const correct = parseInt(document.getElementById("correctIndex").value);

    if (question && answers.every(a => a) && !isNaN(correct)) {
        createdQuestions.push({ q: question, answers: answers, correct: correct });
        alert("Question added to list!");
        
        // Reset inputs
        document.getElementById("questionInput").value = "";
        document.querySelectorAll(".answer").forEach(a => a.value = "");
        document.getElementById("correctIndex").value = "";
    } else { 
        alert("Please fill all answers and correct index!"); 
    }
}
function showJoin() {
    const home = document.getElementById("home");
    const join = document.getElementById("join");
    if (home && join) {
        home.classList.add("hidden");
        join.classList.remove("hidden");
    }
}

/**
 * Saves the entire quiz to localStorage
 */
function saveQuizToAccount() {
    if (createdQuestions.length === 0) return alert("Add questions first!");
    const title = document.getElementById("quizTitle").value;
    const quizData = { 
        id: "Q-" + Math.random().toString(36).substr(2,4).toUpperCase(), 
        title, 
        questions: createdQuestions 
    };
    
    let myQuizzes = JSON.parse(localStorage.getItem("mySavedQuizzes")) || [];
    myQuizzes.push(quizData);
    localStorage.setItem("mySavedQuizzes", JSON.stringify(myQuizzes));
    window.location.href = "dashboard.html";
}

// ---------------- 6. IN-GAME LOGIC ----------------

/**
 * Updates UI with current PIN and connected players
 */
function loadLobby() {
    const pin = localStorage.getItem("lobbyPin");
    const playersList = JSON.parse(localStorage.getItem("players")) || [];
    const isHost = localStorage.getItem("isHost") === "true"; // Проверяем флаг, а не имя

    if (document.getElementById("pin")) document.getElementById("pin").innerText = pin;
    
    const list = document.getElementById("players");
    if (list) {
        list.innerHTML = playersList.map(p => `
            <li class="bg-purple-100 p-3 rounded-xl flex justify-between">
                <span>${p}</span>
                <span class="text-purple-600 font-bold">READY</span>
            </li>
        `).join("");
    }
    
    const startBtn = document.querySelector("button[onclick='startGame()']");
    if (startBtn) {
        if (!isHost) {
            startBtn.remove(); // Удаляем кнопку для обычных игроков
        } else {
            // Если хост один, можно оставить кнопку активной для теста
            startBtn.disabled = false; 
            startBtn.classList.remove("opacity-50");
        }
    }
}

/**
 * Broadcasts the start command to all players via SignalR
 */
async function startGame() {
    const pin = localStorage.getItem("lobbyPin");
    await connection.invoke("StartGame", pin);
}

function loadGame() {
    if (!document.getElementById("question")) return;
    questions = JSON.parse(localStorage.getItem("quiz")) || questions;
    showQuestion();
}

/**
 * Displays current question and starts timer
 */
function showQuestion() {
    const q = questions[currentQuestion];
    document.getElementById("question").innerText = q.q;
    
    const options = document.querySelectorAll(".option-btn");
    options.forEach((btn, i) => {
        btn.innerText = q.answers[i];
        btn.className = "option-btn bg-white h-24 rounded-3xl flex items-center justify-center cursor-pointer shadow-md font-bold text-xl text-purple-800 border-b-4 border-purple-200";
        btn.onclick = () => submitAnswer(i);
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
        if (bar) bar.style.width = (timeLeft / 10) * 100 + "%";
        if (timeLeft <= 0) { 
            clearInterval(timerInterval); 
            autoNext(); 
        }
    }, 100);
}

/**
 * Calculates score based on speed and sends it to the server
 */
async function submitAnswer(index) {
    clearInterval(timerInterval);
    const q = questions[currentQuestion];
    const player = JSON.parse(localStorage.getItem("players"))[0] || "Guest";
    const isCorrect = index === q.correct;
    
    if (isCorrect) {
        // Рассчитываем бонус за скорость
        const points = Math.max(1000 - Math.floor((Date.now() - startTime) / 10), 100);
        
        // ВАЖНО: Прибавляем к текущему счету
        scores[player] = (scores[player] || 0) + points;
        
        const pin = localStorage.getItem("lobbyPin");
        // Отправляем на сервер
        await connection.invoke("UpdateScore", pin, player, scores[player]);
    }
    
    // Визуальная индикация
    const options = document.querySelectorAll(".option-btn");
    options[index].classList.add(isCorrect ? "bg-green-100" : "bg-red-100");
    
    // Ждем секунду и идем дальше
    setTimeout(autoNext, 1000);
}

function autoNext() {
    currentQuestion++;
    if (currentQuestion < questions.length) showQuestion();
    else showLeaderboard();
}

function showLeaderboard() {
    document.getElementById("quiz")?.classList.add("hidden");
    document.getElementById("leaderboard")?.classList.remove("hidden");
    
    const list = document.getElementById("leaderboardList");
    const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
    
    list.innerHTML = sorted.map(([name, score], i) => `
        <div class="bg-white p-3 rounded-xl flex justify-between shadow">
            <span>${i+1}. ${name}</span>
            <span class="font-bold">${score}</span>
        </div>
    `).join("");
}

// ---------------- 7. INITIALIZATION ----------------
window.onload = function () {
    const path = window.location.pathname;
    
    if (path.includes("Lobby.html")) loadLobby();
    if (path.includes("Game.html")) loadGame();
    if (path.includes("dashboard.html")) displayUserDashboard();
    
    // Quick game mode check (from start.html)
    if (path.includes("CreateQuiz.html")) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('quick') === 'true') {
            document.getElementById("saveQuizBtn")?.remove();
        }
    }
    
    startSignalR();
};