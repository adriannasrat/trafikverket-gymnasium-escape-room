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
        var username = configuration["Admin:Username"];
        var password = configuration["Admin:Password"];
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            AdminCredentialsMissing(logger, null);
            return;
        }

        var normalizedUsername = username.Trim();
        var passwordHasher = new PasswordHasher<AdminUser>();
        var user = await db.AdminUsers
            .OrderBy(candidate => candidate.Username)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            user = new AdminUser
            {
                Username = normalizedUsername,
                PasswordHash = string.Empty
            };
            user.PasswordHash = passwordHasher.HashPassword(user, password);
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
            return;
        }

        var usernameChanged = user.Username != normalizedUsername;
        var passwordVerification = passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            password);
        var passwordNeedsUpdate = passwordVerification != PasswordVerificationResult.Success;

        if (!usernameChanged && !passwordNeedsUpdate)
        {
            return;
        }

        user.Username = normalizedUsername;
        if (passwordNeedsUpdate)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, password);
        }
        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = "system",
            Action = "updated",
            EntityType = "admin-user",
            EntityId = user.Id.ToString(),
            Summary = $"Synchronized administrator account '{user.Username}' with the event configuration."
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}
