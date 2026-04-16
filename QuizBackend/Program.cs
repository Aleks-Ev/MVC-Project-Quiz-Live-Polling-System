using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- 1. НАСТРОЙКА СЕРВИСОВ ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();
// --- 1. Настройка сервисов ---
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=quizflow.db")); // Файл базы создастся сам
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500") 
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); 
    });
});

var app = builder.Build();

// --- 2. MIDDLEWARE ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();


// --- 4. ЭНДПОИНТЫ (API) ---

// Получить все квизы (теперь из базы данных)
app.MapGet("/api/quizzes", async (AppDbContext db) => 
    await db.Quizzes.Include(q => q.Questions).ToListAsync());

// Создать квиз (сохраняем в SQLite)
app.MapPost("/api/quizzes", async ([FromBody] Quiz newQuiz, AppDbContext db) =>
{
    // Генерируем PIN, если фронтенд его не прислал
    if (string.IsNullOrEmpty(newQuiz.Id))
    {
        newQuiz.Id = Guid.NewGuid().ToString().Substring(0, 4).ToUpper();
    }
    
    // Добавляем в базу
    db.Quizzes.Add(newQuiz);
    await db.SaveChangesAsync(); // Физически записываем в файл .db
    
    Console.WriteLine($"Quiz saved to DB! PIN: {newQuiz.Id}");
    return Results.Ok(newQuiz);
});

// Найти квиз по PIN (игрок заходит в лобби)
app.MapGet("/api/quizzes/{id}", async (string id, AppDbContext db) =>
{
    // Используем Include, чтобы база сразу отдала и вопросы квиза
    var quiz = await db.Quizzes
        .Include(q => q.Questions) 
        .FirstOrDefaultAsync(q => q.Id != null && q.Id.ToLower() == id.ToLower());

    return quiz is not null 
        ? Results.Ok(quiz) 
        : Results.NotFound(new { message = "Lobby not found in Database" });
});

// Настройка SignalR маршрута
app.MapHub<QuizHub>("/quizhub");

app.Run();


// --- 3. ХРАНИЛИЩЕ (Static — чтобы данные не пропадали) ---
// Это твой "заменитель" базы данных на время разработки
// Мы выносим его в статический класс для надежности
static class DataStorage
{
    public static List<Quiz> Quizzes = new List<Quiz>();
}
// --- 5. МОДЕЛИ И ХАБ (Классы) ---
public class Quiz
{
    public string? Id { get; set; }
    public string? Title { get; set; } // Добавили заголовок
    public List<Question> Questions { get; set; } = new();
}

public class Question
{
    public string Q { get; set; } = "";
    public List<string> Answers { get; set; } = new();
    public int Correct { get; set; }
}

public class QuizHub : Hub 
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
        await Clients.Group(pin).SendAsync("ScoreUpdated", user, score);
    }

    public async Task SyncPlayers(string pin, List<string> players)
    {
        await Clients.Group(pin).SendAsync("UpdatePlayerList", players);
    }
}
// Создай контекст базы данных (AppDbContext)
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<Question> Questions => Set<Question>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Связываем вопросы с квизом (один квиз — много вопросов)
        modelBuilder.Entity<Quiz>()
            .HasMany(q => q.Questions)
            .WithOne()
            .OnDelete(DeleteBehavior.Cascade);
    }
}