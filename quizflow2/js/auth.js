let selectedQuizId = localStorage.getItem("selectedQuizId") || null;
// ---------------- AUTH & NAVIGATION ----------------

function goHome() {
    const token = localStorage.getItem("userToken");
    window.location.href = token ? "dashboard.html" : "start.html";
}

function logout() {
    localStorage.clear();
    window.location.href = "start.html";
}

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

// ---------------- DASHBOARD ----------------


function displayUserDashboard() {
    const userName = localStorage.getItem("userName") || "Guest";
    const greeting = document.getElementById("userGreeting");
    if (greeting) greeting.innerText = `Hi, ${userName}!`;
    renderQuizList();
}

async function renderQuizList() {
    const listCont = document.getElementById("quizList");
    if (!listCont) return;

    try {
        // Запрашиваем квизы у сервера вместо localStorage
        const response = await fetch("http://localhost:5178/api/quizzes");
        if (!response.ok) throw new Error("Failed to fetch quizzes");
        
        const myQuizzes = await response.json();

        listCont.innerHTML = myQuizzes.length === 0 ? `<p class="text-gray-400 italic">No quizzes yet...</p>` : "";

        // Отрисовываем квизы (серверные данные)
        myQuizzes.slice().reverse().forEach(quiz => {
            const card = document.createElement("div");
            const isActive = selectedQuizId === quiz.id;

            card.className = `p-4 rounded-2xl cursor-pointer shadow-sm transition-all ${
                isActive ? 'bg-purple-600 text-white' : 'bg-white text-gray-800 hover:shadow-md'
            }`;
            
            card.innerHTML = `
                <div class="font-bold">${quiz.title}</div>
                <div class="text-xs ${isActive ? 'text-purple-200' : 'text-gray-400'}">${quiz.questions.length} questions</div>
            `;

            card.onclick = () => { 
                selectedQuizId = quiz.id; 
                localStorage.setItem("selectedQuizId", quiz.id);
                renderQuizList(); 
                toggleLobbyBtn(true); 
            };

            listCont.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading quizzes:", err);
        listCont.innerHTML = `<p class="text-red-500">Error loading quizzes. Is backend running?</p>`;
    }
}

function toggleLobbyBtn(active) {
    const btn = document.getElementById("createLobbyBtn");
    if (!btn) return;

    btn.disabled = !active;
    btn.className = active 
        ? "bg-purple-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-purple-700 transition" 
        : "bg-gray-300 text-white px-6 py-2 rounded-xl cursor-not-allowed";
}
