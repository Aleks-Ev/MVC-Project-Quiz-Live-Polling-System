// ---------------- QUIZ CREATOR ----------------

let createdQuestions = [];

function nextStep() {
    const title = document.getElementById("quizTitle").value.trim();
    if (!title) return alert("Enter name!");

    document.getElementById("stepName").classList.add("hidden");
    document.getElementById("stepQuestions").classList.remove("hidden");
    document.getElementById("displayTitle").innerText = title;
}

function addQuestion() {
    const question = document.getElementById("questionInput").value.trim();
    const answers = Array.from(document.querySelectorAll(".answer")).map(a => a.value.trim());
    const correct = parseInt(document.getElementById("correctIndex").value);

    if (question && answers.every(a => a) && !isNaN(correct)) {
        createdQuestions.push({ q: question, answers: answers, correct: correct });

        alert("Question added!");

        document.getElementById("questionInput").value = "";
        document.querySelectorAll(".answer").forEach(a => a.value = "");
        document.getElementById("correctIndex").value = "";
    } else { 
        alert("Fill all fields!"); 
    }
}

async function saveQuizToAccount() {
    if (createdQuestions.length === 0) return alert("Add questions first!");

    const title = document.getElementById("quizTitle").value;

    // Формируем объект для сервера
    const quizData = { 
        id: "Q-" + Math.random().toString(36).substr(2,4).toUpperCase(), 
        title: title, 
        questions: createdQuestions 
    };

    try {
        // ОТПРАВЛЯЕМ НА СЕРВЕР
        const response = await fetch("http://localhost:5178/api/quizzes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
                // Если ты уже настроил авторизацию, сюда нужно будет добавить токен:
                // "Authorization": "Bearer " + localStorage.getItem("userToken")
            },
            body: JSON.stringify(quizData)
        });

        if (response.ok) {
            alert("Quiz successfully saved to server!");
            // Очищаем локальные данные, так как они теперь на сервере
            localStorage.removeItem("selectedQuizId");
            window.location.href = "dashboard.html";
        } else {
            const errText = await response.text();
            alert("Server error: " + errText);
        }
    } catch (err) {
        console.error("Failed to save quiz:", err);
        alert("Could not connect to server. Is your Backend running?");
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