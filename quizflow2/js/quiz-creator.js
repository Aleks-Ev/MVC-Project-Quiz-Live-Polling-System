// ---------------- QUIZ CREATOR (DATABASE READY) ----------------

let createdQuestions = [];
//const API_URL = "http://localhost:5178/api";

// Проверка авторизации при входе на страницу
// Замени window.onload на это:
window.addEventListener('load', () => {
    const token = localStorage.getItem("userToken");
    if (!token) {
        alert("Please sign in to create quizzes!");
        window.location.href = "Authorization.html";
    }
});

function nextStep() {
    const title = document.getElementById("quizTitle").value.trim();
    if (!title) return alert("Please enter a quiz name!");

    document.getElementById("stepName").classList.add("hidden");
    document.getElementById("stepQuestions").classList.remove("hidden");
    document.getElementById("displayTitle").innerText = title;
}

function addQuestion() {
    const questionText = document.getElementById("questionInput").value.trim();
    const answers = Array.from(document.querySelectorAll(".answer")).map(a => a.value.trim());
    const correctIndex = parseInt(document.getElementById("correctIndex").value);

    // Валидация полей
    if (!questionText || answers.some(a => !a) || isNaN(correctIndex)) {
        return alert("Please fill all fields and select the correct answer!");
    }

    // Добавляем в массив (структура совпадает с требованиями БД)
    createdQuestions.push({
        text: questionText,
        options: answers,
        correctAnswerIndex: correctIndex
    });

    alert(`Question ${createdQuestions.length} added!`);

    // Очистка полей
    document.getElementById("questionInput").value = "";
    document.querySelectorAll(".answer").forEach(a => a.value = "");
    document.getElementById("correctIndex").value = "";
}

async function saveQuizToAccount() {
    if (createdQuestions.length === 0) return alert("Add at least one question!");

    const title = document.getElementById("quizTitle").value.trim();
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("userToken");

    if (!userId || !token) {
        alert("Session expired. Please log in again.");
        window.location.href = "Authorization.html";
        return;
    }

    // Формируем объект для API
    const quizData = {
        title: title,
        authorId: userId, // Привязываем квиз к пользователю
        questions: createdQuestions
    };

    try {
        console.log("🚀 Sending quiz to server...", quizData);
        
        const response = await fetch(`${API_URL}/quizzes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // Передаем токен безопасности
            },
            body: JSON.stringify(quizData)
        });

        if (response.ok) {
            const result = await response.json();
            alert("Quiz successfully saved to your account!");
            
            // Очищаем локальное состояние
            createdQuestions = [];
            localStorage.removeItem("selectedQuizId");
            
            // Возвращаемся в дашборд
            window.location.href = "dashboard.html";
        } else {
            const errText = await response.text();
            alert("Failed to save: " + errText);
        }
    } catch (err) {
        console.error("Save error:", err);
        alert("Server connection error. Is the backend running?");
    }
}

// ---------------- UI HELPERS ----------------

function showJoin() {
    const home = document.getElementById("home");
    const join = document.getElementById("join");
    if (home && join) {
        home.classList.add("hidden");
        join.classList.remove("hidden");
    }
}

function cancelCreation() {
    if (confirm("Are you sure? All unsaved questions will be lost.")) {
        window.location.href = "dashboard.html";
    }
}