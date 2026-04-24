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

    // Добавляем в массив
    createdQuestions.push({
        text: questionText,
        options: answers,
        correctAnswerIndex: correctIndex
    });

    alert(`Question ${createdQuestions.length} added!`);

    // 1. Очистка полей
    document.getElementById("questionInput").value = "";
    document.querySelectorAll(".answer").forEach(a => a.value = "");
    document.getElementById("correctIndex").value = "";

    const step = document.getElementById("stepQuestions");
    step.classList.add("hidden"); 
    setTimeout(() => {
        step.classList.remove("hidden");
        document.getElementById("questionInput").focus();
    }, 10);

        // 3. Автоматический фокус на поле вопроса (удобно для ввода следующего)
        document.getElementById("questionInput").focus();
    }

async function saveQuizToAccount() {
    if (createdQuestions.length === 0) return alert("Add at least one question!");

    const title = document.getElementById("quizTitle").value.trim();
    const token = localStorage.getItem("userToken");

    if (!token) {
        alert("Session expired. Please log in again.");
        window.location.href = "Authorization.html";
        return;
    }

    const quizData = {
        title: title,
        questions: createdQuestions
        // userId мы больше не шлем вручную, бэкенд возьмет его из токена!
    };

    try {
        const response = await fetch(`${API_URL}/quizzes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "ngrok-skip-browser-warning": "69420" // Добавь это
            },
            body: JSON.stringify(quizData)
        });

        if (response.ok) {
            alert("Quiz successfully saved!");
            createdQuestions = [];
            window.location.href = "dashboard.html";
        } else {
            const errText = await response.text();
            alert("Failed to save: " + errText);
        }
    } catch (err) {
        console.error("Save error:", err);
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