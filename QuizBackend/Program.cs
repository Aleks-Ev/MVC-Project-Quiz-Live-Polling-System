using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR; // Нужно для Hub
using System.Threading.Tasks;  // Нужно для Task

var builder = WebApplication.CreateBuilder(args);

// --- 1. Настройка сервисов ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// РАЗРЕШАЕМ CORS: чтобы твой фронтенд мог достучаться до API
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500") // Адрес твоего Live Server
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // ОБЯЗАТЕЛЬНО для SignalR
    });
});

// Добавляем поддержку SignalR
builder.Services.AddSignalR();

var app = builder.Build();

// --- 2. Конвейер (Middleware) ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); // Это создаст страницу /swagger
}

app.UseCors(); // Применяем настройки доступа

// Временное хранилище квизов (вместо базы данных пока что)
var quizzes = new List<Quiz>();

// --- 3. Эндпоинты (API) ---

// Получить все квизы
app.MapGet("/api/quizzes", () => quizzes);

// Создать новый квиз (сюда будем слать данные из CreateQuiz.html)
app.MapPost("/api/quizzes", ([FromBody] Quiz newQuiz) =>
{
    newQuiz.Id = Guid.NewGuid().ToString().Substring(0, 4).ToUpper(); // Генерация PIN-кода
    quizzes.Add(newQuiz);
    return Results.Ok(newQuiz);
});

// Найти квиз по PIN-коду (для игроков)
app.MapGet("/api/quizzes/{id}", (string id) =>
{
    var quiz = quizzes.FirstOrDefault(q => q.Id == id);
    return quiz is not null ? Results.Ok(quiz) : Results.NotFound();
});

//создадим класс Хаба
app.MapHub<QuizHub>("/quizhub");

app.Run();

// --- 4. Модели данных (под структуру твоего JS) ---
public class Quiz
{
    public string? Id { get; set; }
    public List<Question> Questions { get; set; } = new();
}

public class Question
{
    public string Q { get; set; } = "";
    public List<string> Answers { get; set; } = new();
    public int Correct { get; set; }
}
public class QuizHub : Microsoft.AspNetCore.SignalR.Hub 
{
    public async Task JoinLobby(string pin, string user)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, pin);
        await Clients.Group(pin).SendAsync("PlayerJoined", user);
    }

    public async Task StartGame(string pin)
    {
        await Clients.Group(pin).SendAsync("GameStarted");
    }
    public async Task UpdateScore(string pin, string user, int score)
    {
    // Рассылаем всем новое состояние счета
        await Clients.Group(pin).SendAsync("ScoreUpdated", user, score);
    }
    //Он будет рассылать обновленный массив имен всем участникам
    public async Task SyncPlayers(string pin, List<string> players)
    {
        await Clients.Group(pin).SendAsync("UpdatePlayerList", players);
    }
}   
