// ---------------- GLOBAL STATE ----------------
let selectedQuizId = localStorage.getItem("selectedQuizId") || null;
const API_URL = "http://localhost:5178/api"; // Убедись, что этот адрес совпадает с твоим Backend

// ---------------- NAVIGATION ----------------

function goHome() {
    const token = localStorage.getItem("userToken");
    
    if (token) {
        // Если залогинен — летим в личный кабинет
        window.location.href = "dashboard.html";
    } else {
        // Если не залогинен — отправляем на авторизацию
        // Убедись, что файл называется именно Authorization.html
        window.location.href = "Authorization.html";
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "start.html";
}

// ---------------- AUTHENTICATION ----------------

// 1. ВХОД (Login)
async function login() {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value.trim();

    if (!email || !pass) return alert("Please fill all fields!");

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, password: pass })
        });

        if (response.ok) {
            const data = await response.json();
            
            // Сохраняем данные пользователя в браузере
            localStorage.setItem("userToken", data.token); // JWT токен для безопасности
            localStorage.setItem("userName", data.username);
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("userEmail", email);

            window.location.href = "dashboard.html";
        } else {
            const errorText = await response.text();
            alert("Login failed: " + errorText);
        }
    } catch (err) {
        console.error("Login error:", err);
        alert("Could not connect to server.");
    }
}

// 2. РЕГИСТРАЦИЯ (Register)
async function register() {
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value.trim();
    const confirm = document.getElementById("regPassConfirm").value.trim();

    // Базовая валидация
    if (!name || !email || !pass) return alert("Please fill all fields!");
    if (pass !== confirm) return alert("Passwords do not match!");
    if (pass.length < 6) return alert("Password must be at least 6 characters!");

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                nickname: name, 
                email: email, 
                password: pass 
            })
        });

        if (response.ok) {
            alert("Account created successfully! Now you can Sign In.");
            window.location.href = "Authorization.html";
        } else {
            const errorText = await response.text();
            alert("Registration failed: " + errorText);
        }
    } catch (err) {
        console.error("Registration error:", err);
        alert("Connection to server failed.");
    }
}

// ---------------- DASHBOARD LOGIC ----------------

async function displayUserDashboard() {
    const userName = localStorage.getItem("userName");
    const userId = localStorage.getItem("userId");

    if (!userName || !userId) {
        window.location.href = "Authorization.html";
        return;
    }

    // Отображаем имя пользователя
    const greeting = document.getElementById("userGreeting");
    if (greeting) greeting.innerText = `Hi, ${userName}!`;

    await renderQuizList(userId);
}

async function renderQuizList(userId) {
    const listCont = document.getElementById("quizList");
    if (!listCont) return;

    try {
        // Запрашиваем квизы только этого пользователя
        const response = await fetch(`${API_URL}/quizzes/user/${userId}`, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("userToken")
            }
        });
        
        const quizzes = await response.json();

        if (quizzes.length === 0) {
            listCont.innerHTML = `<p class="text-neon opacity-50 italic text-center">You haven't created any quizzes yet...</p>`;
            return;
        }

        listCont.innerHTML = "";
        quizzes.forEach(quiz => {
            const isActive = selectedQuizId === quiz.id;
            const card = document.createElement("div");
            
            card.className = `quiz-item-card p-4 rounded-2xl shadow-sm transition-all cursor-pointer ${
                isActive ? 'selected-quiz scale-[1.02]' : 'hover:bg-white/20'
            }`;

            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-bold text-lg">${quiz.title}</div>
                        <div class="text-xs opacity-60">${quiz.questions.length} questions</div>
                    </div>
                    ${isActive ? '<span class="text-xl"></span>' : ''}
                </div>
            `;

            card.onclick = () => { 
                selectedQuizId = quiz.id; 
                localStorage.setItem("selectedQuizId", quiz.id);
                renderQuizList(userId); 
                toggleLobbyBtn(true);
            };

            listCont.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading quizzes:", err);
        listCont.innerHTML = `<p class="text-red-500">Error loading your quizzes.</p>`;
    }
}

function toggleLobbyBtn(active) {
    const btn = document.getElementById("createLobbyBtn");
    if (!btn) return;

    btn.disabled = !active;
    if (active) {
        btn.classList.remove("opacity-50", "cursor-not-allowed");
        btn.classList.add("opacity-100", "cursor-pointer");
    } else {
        btn.classList.add("opacity-50", "cursor-not-allowed");
    }
}

function createLobbyFromSelected() {
    if (!selectedQuizId) return alert("Please select a quiz from the list first!");
    
    // Передаем ID квиза как PIN лобби
    localStorage.setItem("lobbyPin", selectedQuizId);
    localStorage.setItem("isHost", "true");
    
    window.location.href = "Lobby.html";
}