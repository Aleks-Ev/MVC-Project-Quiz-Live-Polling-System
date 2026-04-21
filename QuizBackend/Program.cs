using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

// --- 1. СЕРВИСЫ ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=quizflow.db"));

var jwtKey = "SUPER_SECRET_KEY_1234567890_QUIZFLOW";
var key = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options => {
    options.AddPolicy("AllowAll", p => p
        .SetIsOriginAllowed(_ => true) // Разрешаем любым адресам стучаться к нам (важно для тестов)
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

var app = builder.Build();

// --- 2. MIDDLEWARE ---
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();
}

// --- 3. API ЭНДПОИНТЫ ---

// --- 3. API ЭНДПОИНТЫ ---

// 1. РЕГИСТРАЦИЯ
app.MapPost("/api/auth/register", async ([FromBody] User user, AppDbContext db) => {
    // Проверяем по Email, так как он теперь уникальный ключ для входа
    if (await db.Users.AnyAsync(u => u.Email == user.Email))
        return Results.BadRequest("User with this email already exists");
    
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok();
});

// 2. ЛОГИН (Вход по Email и Password)
app.MapPost("/api/auth/login", async ([FromBody] User loginData, AppDbContext db) => {
    // Ищем пользователя в базе по Email и Паролю
    var user = await db.Users.FirstOrDefaultAsync(u => 
        u.Email == loginData.Email && u.Password == loginData.Password);
        
    if (user is null) return Results.Unauthorized();

    // ГЕНЕРАЦИЯ ТОКЕНА (этот блок должен быть здесь)
    var tokenHandler = new JwtSecurityTokenHandler();
    var tokenDescriptor = new SecurityTokenDescriptor {
        Subject = new ClaimsIdentity(new[] { 
            new Claim(ClaimTypes.Name, user.Nickname),
            new Claim("userId", user.Id.ToString())
        }),
        Expires = DateTime.UtcNow.AddDays(7),
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };
    
    var token = tokenHandler.CreateToken(tokenDescriptor);
    
    return Results.Ok(new { 
        token = tokenHandler.WriteToken(token), // Теперь ошибка исчезнет
        username = user.Nickname, // Отправляем Никнейм для приветствия
        userId = user.Id 
    });
});

// 3. ПОЛУЧЕНИЕ КВИЗОВ ДЛЯ DASHBOARD
app.MapGet("/api/quizzes/user/{userId}", async (int userId, AppDbContext db) => {
    // Возвращаем список квизов (пока все, так как связи с User в модели Quiz еще нет)
    var quizzes = await db.Quizzes.Include(q => q.Questions).ToListAsync();
    return Results.Ok(quizzes);
});

// 4. ОСТАЛЬНЫЕ МЕТОДЫ ДЛЯ КВИЗОВ
app.MapGet("/api/quizzes", async (AppDbContext db) => 
    await db.Quizzes.Include(q => q.Questions).ToListAsync());

app.MapGet("/api/quizzes/{id}", async (string id, AppDbContext db) =>
    await db.Quizzes.Include(q => q.Questions).FirstOrDefaultAsync(q => q.Id == id) 
    is Quiz q ? Results.Ok(q) : Results.NotFound());

app.MapPost("/api/quizzes", async ([FromBody] Quiz quiz, AppDbContext db) => {
    if (string.IsNullOrEmpty(quiz.Id)) quiz.Id = Guid.NewGuid().ToString().Substring(0, 8);
    db.Quizzes.Add(quiz);
    await db.SaveChangesAsync();
    return Results.Created($"/api/quizzes/{quiz.Id}", quiz);
});


// ПУТЬ СОВПАДАЕТ С API_URL ФРОНТЕНДА
app.MapHub<QuizHub>("/api/quizhub");

app.Run();

// --- 4. МОДЕЛИ (CLASSES) ---

public class User {
    public int Id { get; set; }
    public string Nickname { get; set; } = string.Empty; // Для приветствия
    public string Email { get; set; } = string.Empty;    // Для входа
    public string Password { get; set; } = string.Empty; // Для входа
}

public class Quiz {
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<Question> Questions { get; set; } = new();
}

public class Question {
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty; // Соответствует q.text в JS
    public List<string> Options { get; set; } = new(); // Соответствует q.options в JS
    public int CorrectAnswerIndex { get; set; } // Соответствует q.correctAnswerIndex в JS
}

// --- 5. SIGNALR HUB ---

public class QuizHub : Hub {
    public async Task JoinLobby(string pin, string user) {
        await Groups.AddToGroupAsync(Context.ConnectionId, pin);
        await Clients.Group(pin).SendAsync("UpdatePlayers", new List<string> { user }); // Упрощенно для теста
    }

    public async Task StartGame(string pin) => 
        await Clients.Group(pin).SendAsync("GameStarted");

    public async Task SendScore(string pin, string user, int score) => 
        await Clients.Group(pin).SendAsync("ReceiveScore", user, score);

    public async Task TriggerNextQuestion(string pin, int index) =>
        await Clients.Group(pin).SendAsync("NextQuestion", index);

    public async Task FinishGame(string pin) =>
        await Clients.Group(pin).SendAsync("GameFinished");
}

// --- 6. DATABASE CONTEXT ---

public class AppDbContext : DbContext {
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        modelBuilder.Entity<Quiz>()
            .HasMany(q => q.Questions)
            .WithOne()
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Question>()
            .Property(e => e.Options)
            .HasConversion(
                v => string.Join('|', v),
                v => v.Split('|', StringSplitOptions.RemoveEmptyEntries).ToList()
            );
    }
}