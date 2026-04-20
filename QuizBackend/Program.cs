using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

// --- 1. НАСТРОЙКА СЕРВИСОВ ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

// Твоя база данных
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=quizflow.db"));

// Настройка JWT (секретный ключ для шифрования токенов)
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

// Твой CORS (важен для работы с Live Server)
builder.Services.AddCors(options => {
    options.AddDefaultPolicy(policy => {
        policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();
// --- АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ТАБЛИЦ ПРИ ЗАПУСКЕ ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated(); // Эта магия создаст все таблицы, если их нет
}

// --- 2. MIDDLEWARE ---
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication(); 
app.UseAuthorization();

// --- 3. ЭНДПОИНТЫ (API) ---

// --- АВТОРИЗАЦИЯ (НОВОЕ) ---
app.MapPost("/api/auth/register", async (AppDbContext db, [FromBody] UserRegistrationDto model) => {
    if (await db.Users.AnyAsync(u => u.Email == model.Email))
        return Results.BadRequest("User already exists");

    var user = new User {
        Username = model.Username,
        Email = model.Email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.Password)
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Registration successful" });
});

app.MapPost("/api/auth/login", async (AppDbContext db, [FromBody] UserLoginDto model) => {
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == model.Email);
    if (user == null || !BCrypt.Net.BCrypt.Verify(model.Password, user.PasswordHash))
        return Results.Unauthorized();

    var tokenHandler = new JwtSecurityTokenHandler();
    var tokenDescriptor = new SecurityTokenDescriptor {
        Subject = new ClaimsIdentity(new[] { 
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("userId", user.Id.ToString()) 
        }),
        Expires = DateTime.UtcNow.AddDays(7),
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };
    var token = tokenHandler.CreateToken(tokenDescriptor);
    return Results.Ok(new { token = tokenHandler.WriteToken(token), username = user.Username });
});

// --- ТВОИ ОРИГИНАЛЬНЫЕ ЭНДПОИНТЫ ДЛЯ КВИЗОВ ---
app.MapGet("/api/quizzes", async (AppDbContext db) => 
    await db.Quizzes.Include(q => q.Questions).ToListAsync());

app.MapGet("/api/quizzes/{id}", async (AppDbContext db, string id) =>
{
    var quiz = await db.Quizzes.Include(q => q.Questions).FirstOrDefaultAsync(q => q.Id == id);
    return quiz is not null ? Results.Ok(quiz) : Results.NotFound();
});

app.MapPost("/api/quizzes", async (AppDbContext db, Quiz quiz) => {
    db.Quizzes.Add(quiz);
    await db.SaveChangesAsync();
    return Results.Created($"/api/quizzes/{quiz.Id}", quiz);
});

// SignalR Hub
app.MapHub<QuizHub>("/quizhub");

app.Run();

// --- 4. КЛАССЫ И МОДЕЛИ (Все твои + новые) ---

public record UserRegistrationDto(string Username, string Email, string Password);
public record UserLoginDto(string Email, string Password);

public class User {
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
}

public class Quiz {
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<Question> Questions { get; set; } = new();
}

public class Question {
    public int Id { get; set; }
    public string Q { get; set; } = string.Empty;
    public List<string> Answers { get; set; } = new();
    public int Correct { get; set; }
}

// ТВОЙ КОНТЕКСТ БД (С сохранением логики конвертации списка ответов)
public class AppDbContext : DbContext {
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<User> Users => Set<User>(); // Новая таблица

    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        modelBuilder.Entity<Quiz>()
            .HasMany(q => q.Questions)
            .WithOne()
            .OnDelete(DeleteBehavior.Cascade);

        // Сохраняем твою логику: конвертируем List в строку для SQLite
        modelBuilder.Entity<Question>()
            .Property(e => e.Answers)
            .HasConversion(
                v => string.Join(',', v),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
            );
    }
}

// ТВОЙ ОРИГИНАЛЬНЫЙ QUIZHUB (Все методы на месте)
public class QuizHub : Hub {
    public async Task JoinLobby(string pin, string user) {
        await Groups.AddToGroupAsync(Context.ConnectionId, pin);
        await Clients.Group(pin).SendAsync("PlayerJoined", user);
    }
    public async Task StartGame(string pin) => 
        await Clients.Group(pin).SendAsync("GameStarted");

    public async Task UpdateScore(string pin, string user, int score) => 
        await Clients.Group(pin).SendAsync("ScoreUpdated", user, score);

    public async Task SyncPlayers(string pin, List<string> players) => 
        await Clients.Group(pin).SendAsync("UpdatePlayerList", players);

    public async Task ShowResults(string pin) => 
        await Clients.Group(pin).SendAsync("ShowResults");
}