using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// --- 1. Настройка сервисов ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// РАЗРЕШАЕМ CORS: чтобы твой фронтенд мог достучаться до API
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});

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