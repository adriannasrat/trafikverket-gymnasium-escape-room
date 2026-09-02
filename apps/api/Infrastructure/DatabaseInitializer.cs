using EscapeRoom.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Infrastructure;

public sealed class DatabaseInitializer(
    AppDbContext db,
    IConfiguration configuration,
    TimeProvider timeProvider,
    ILogger<DatabaseInitializer> logger)
{
    private static readonly Action<ILogger, Exception?> AdminCredentialsMissing =
        LoggerMessage.Define(
            LogLevel.Warning,
            new EventId(1001, nameof(AdminCredentialsMissing)),
            "Admin account was not seeded because Admin:Username or Admin:Password is missing.");

    public async Task InitialiseAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.MigrateAsync(cancellationToken);
        await SeedGameAsync(cancellationToken);
        await SeedAdminAsync(cancellationToken);
    }

    public async Task SeedForTestsAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);
        await SeedGameAsync(cancellationToken);
        await SeedAdminAsync(cancellationToken);
    }

    private async Task SeedGameAsync(CancellationToken cancellationToken)
    {
        if (await db.Games.AnyAsync(cancellationToken))
        {
            return;
        }

        var challenge = new Challenge
        {
            Prompt = "Vad står IKT för i Trafikverkets verksamhet?",
            SortOrder = 1,
            TimeLimitSeconds = 30,
            Options =
            [
                new ChallengeOption { Text = "Intern kontroll av transporter", SortOrder = 1 },
                new ChallengeOption { Text = "Informations- och kommunikationsteknik", SortOrder = 2, IsCorrect = true },
                new ChallengeOption { Text = "Infrastruktur, kvalitet och trafik", SortOrder = 3 },
                new ChallengeOption { Text = "Integrerad kollektivtrafik", SortOrder = 4 }
            ]
        };

        db.Games.Add(new Game
        {
            Slug = "trafikverket-uppdraget",
            Title = "Trafikverket – Uppdraget",
            Summary = "Upptäck hur digital teknik håller Sveriges vägar och järnvägar i rörelse.",
            Type = GameType.Quiz,
            SortOrder = 1,
            DefaultTimeLimitSeconds = 30,
            SuccessMessage = "Rätt! IKT hjälper Trafikverket att övervaka, styra och skydda transportsystemet.",
            Challenges = [challenge]
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedAdminAsync(CancellationToken cancellationToken)
    {
        if (await db.AdminUsers.AnyAsync(cancellationToken))
        {
            return;
        }

        var username = configuration["Admin:Username"];
        var password = configuration["Admin:Password"];
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            AdminCredentialsMissing(logger, null);
            return;
        }

        var user = new AdminUser
        {
            Username = username.Trim(),
            PasswordHash = string.Empty
        };
        user.PasswordHash = new PasswordHasher<AdminUser>().HashPassword(user, password);
        db.AdminUsers.Add(user);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = "system",
            Action = "created",
            EntityType = "admin-user",
            EntityId = user.Id.ToString(),
            Summary = $"Created the initial administrator account '{user.Username}'."
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
