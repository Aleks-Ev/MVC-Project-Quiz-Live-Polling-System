let players = [];
let scores = {};
let currentQuestion = 0;
let startTime = 0;
let timeLeft = 10;
let timerInterval;

const questions = [
    { q: "What is the capital of France?", answers: ["Berlin", "Paris", "Madrid", "Rome"], correct: 1 },
    { q: "Which language is used for web styling?", answers: ["Python", "HTML", "CSS", "C++"], correct: 2 },
    { q: "What is 5 * 5?", answers: ["20", "25", "30", "15"], correct: 1 }
];

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

function createGame() {
    const pin = Math.floor(1000 + Math.random() * 9000);
    document.getElementById("pin").innerText = pin;
    
    players = ["Host"];
    scores = { "Host": 0 };
    
    updatePlayers();
    hideAll();
    document.getElementById("lobby").classList.remove("hidden");
}

function joinGame() {
    const nick = document.getElementById("nickname").value.trim();
    if (!nick) return alert("Please enter a nickname!");
    if (players.includes(nick)) return alert("Nickname already taken!");

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
        li.className = "bg-purple-100 p-3 px-5 rounded-2xl flex justify-between items-center font-bold text-purple-700 fade-in";
        li.innerHTML = `<span>${p}</span> <span class="text-[10px] bg-purple-200 px-2 py-1 rounded-full uppercase tracking-tighter">Ready</span>`;
        list.appendChild(li);
    });
}

function startGame() {
    currentQuestion = 0;
    hideAll();
    document.getElementById("quiz").classList.remove("hidden");
    showQuestion();
}

function showQuestion() {
    const q = questions[currentQuestion];
    document.getElementById("question").innerText = q.q;
    const grid = document.getElementById("optionsGrid");
    const options = grid.querySelectorAll(".option-btn");

    grid.style.pointerEvents = "auto"; // Re-enable clicking

    options.forEach((el, i) => {
        el.innerText = q.answers[i];
        // Reset classes
        el.className = "option-btn bg-white hover:bg-purple-50 h-24 rounded-3xl flex items-center justify-center cursor-pointer shadow-md font-bold text-xl text-purple-800 transition-all border-b-4 border-purple-200 active:border-b-0 active:translate-y-1";
    });

    timeLeft = 10;
    const bar = document.getElementById("timerBar");
    bar.style.transition = "none";
    bar.style.width = "100%";
    setTimeout(() => { bar.style.transition = "width 1s linear"; }, 50);

    startTime = Date.now();
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

function answer(index) {
    const grid = document.getElementById("optionsGrid");
    grid.style.pointerEvents = "none"; // Block spam clicks
    clearInterval(timerInterval);

    const q = questions[currentQuestion];
    const options = grid.querySelectorAll(".option-btn");
    const player = players[players.length - 1]; 
    const timeTaken = (Date.now() - startTime) / 1000;

    if (index === q.correct) {
        options[index].classList.replace("border-purple-200", "border-green-500");
        options[index].classList.add("bg-green-50", "ring-2", "ring-green-500");
        document.getElementById("soundCorrect").play();
        
        let points = Math.max(1000 - Math.floor(timeTaken * 100), 100);
        scores[player] += points;
    } else {
        options[index].classList.replace("border-purple-200", "border-red-500");
        options[index].classList.add("bg-red-50", "ring-2", "ring-red-500");
        options[q.correct].classList.add("ring-2", "ring-green-500");
        document.getElementById("soundWrong").play();
    }

    setTimeout(autoNext, 1200);
}

function autoNext() {
    currentQuestion++;
    if (currentQuestion < questions.length) {
        showQuestion();
    } else {
        showLeaderboard();
    }
}

function showLeaderboard() {
    hideAll();
    const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
    const top3Cont = document.getElementById("top3");
    const listCont = document.getElementById("leaderboardList");

    top3Cont.innerHTML = "";
    listCont.innerHTML = "";
    const podiumColors = ['bg-yellow-400', 'bg-slate-300', 'bg-orange-400'];

    sorted.forEach(([name, score], i) => {
        if (i < 3) {
            const height = i === 0 ? 'h-32' : i === 1 ? 'h-24' : 'h-20';
            const podium = document.createElement("div");
            podium.className = `flex flex-col items-center justify-end fade-in`;
            podium.innerHTML = `
                <div class="text-xs font-bold mb-1">${name}</div>
                <div class="${podiumColors[i]} w-16 ${height} rounded-t-xl shadow-lg flex items-center justify-center text-white font-black text-2xl">${i+1}</div>
                <div class="text-[10px] mt-1 font-bold">${score} pts</div>
            `;
            top3Cont.appendChild(podium);
        } else {
            const row = document.createElement("div");
            row.className = "bg-white p-3 rounded-xl flex justify-between items-center shadow-sm fade-in";
            row.innerHTML = `<span>${i+1}. ${name}</span><span class="font-bold text-purple-600">${score}</span>`;
            listCont.appendChild(row);
        }
    });
    document.getElementById("leaderboard").classList.remove("hidden");
}