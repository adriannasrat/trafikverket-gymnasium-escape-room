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
    private static readonly string[] MatchingDestinationNames =
        ["Järnvägskorsning", "Halt väglag", "Skolområde"];

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
        if (!await db.Games.AnyAsync(game => game.Slug == "trafikverket-uppdraget", cancellationToken))
        {
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
        }

        if (!await db.Games.AnyAsync(game => game.Slug == "risk-och-sakerhet", cancellationToken))
        {
            static Challenge CreateScenario(string prompt, int sortOrder, int correctOption)
            {
                var options = MatchingDestinationNames
                    .Select((text, index) => new ChallengeOption
                    {
                        Text = text,
                        SortOrder = index + 1,
                        IsCorrect = index == correctOption
                    })
                    .ToList();

                return new Challenge
                {
                    Prompt = prompt,
                    SortOrder = sortOrder,
                    Options = options
                };
            }

            db.Games.Add(new Game
            {
                Slug = "risk-och-sakerhet",
                Title = "Risk & Säkerhet",
                Summary = "Koppla varje händelse till platsen där risken behöver hanteras.",
                Type = GameType.Matching,
                SortOrder = 2,
                DefaultTimeLimitSeconds = 60,
                SuccessMessage = "Alla kopplingar är rätt! Trafikverket arbetar förebyggande för att människor ska kunna resa säkert vid vägar och järnvägar.",
                Challenges =
                [
                    CreateScenario(
                        "Tekniken ska fungera, men ett tåg i hög hastighet kan inte väja när någon befinner sig på spåret.",
                        1,
                        0),
                    CreateScenario(
                        "Vägen kan se trygg ut ena stunden och plötsligt ge fordonet mycket sämre grepp.",
                        2,
                        1),
                    CreateScenario(
                        "Här rör sig många unga trafikanter och fysiska farthinder hjälper förare att sänka hastigheten.",
                        3,
                        2)
                ]
            });
        }

        if (!await db.Games.AnyAsync(game => game.Slug == "digital-sakerhet", cancellationToken))
        {
            static Challenge CreateTrueFalseQuestion(
                string prompt,
                int sortOrder,
                bool correctAnswer) => new()
            {
                Prompt = prompt,
                SortOrder = sortOrder,
                TimeLimitSeconds = 15,
                Options =
                [
                    new ChallengeOption
                    {
                        Text = "Sant",
                        SortOrder = 1,
                        IsCorrect = correctAnswer
                    },
                    new ChallengeOption
                    {
                        Text = "Falskt",
                        SortOrder = 2,
                        IsCorrect = !correctAnswer
                    }
                ]
            };

            db.Games.Add(new Game
            {
                Slug = "digital-sakerhet",
                Title = "Digital Säkerhet",
                Summary = "Avgör om påståendena om data, trafiksystem och digital säkerhet är sanna eller falska.",
                Type = GameType.TrueFalse,
                SortOrder = 3,
                DefaultTimeLimitSeconds = 15,
                SuccessMessage = "Rätt! Digitala system behöver både tillförlitlig information och ett aktivt säkerhetsarbete.",
                Challenges =
                [
                    CreateTrueFalseQuestion(
                        "Backup av data gör att system aldrig kan få problem.",
                        1,
                        false),
                    CreateTrueFalseQuestion(
                        "Trafikinformation som visas för allmänheten bygger ofta på realtidsdata.",
                        2,
                        true),
                    CreateTrueFalseQuestion(
                        "IT-problem kan få konsekvenser även om inga vägar är avstängda.",
                        3,
                        true)
                ]
            });
        }

        if (!await db.Games.AnyAsync(game => game.Slug == "pixeljakten", cancellationToken))
        {
            static Challenge CreatePixelChallenge(
                string prompt,
                string imagePath,
                int sortOrder,
                string correctAnswer,
                params string[] answers) => new()
            {
                Prompt = prompt,
                ImagePath = imagePath,
                SortOrder = sortOrder,
                TimeLimitSeconds = 30,
                Options = answers.Select((text, index) => new ChallengeOption
                {
                    Text = text,
                    SortOrder = index + 1,
                    IsCorrect = text == correctAnswer
                }).ToList()
            };

            db.Games.Add(new Game
            {
                Slug = "pixeljakten",
                Title = "Pixeljakten",
                Summary = "Gissa vad bilden visar. Varje gång du gör den tydligare läggs fem sekunder på din totaltid.",
                Type = GameType.PixelHunt,
                SortOrder = 4,
                DefaultTimeLimitSeconds = 30,
                SuccessMessage = "Rätt! Du avslöjade vad som dolde sig i bilden.",
                Challenges =
                [
                    CreatePixelChallenge(
                        "Vad döljer sig bakom pixlarna?",
                        "/assets/images/pixel/train.jpg",
                        1,
                        "Snabbtåg",
                        "Godståg", "Snabbtåg", "Spårvagn"),
                    CreatePixelChallenge(
                        "Vilken teknisk utrustning ser du?",
                        "/assets/images/pixel/camera.jpg",
                        2,
                        "Fartkamera",
                        "Gatubelysning", "Fartkamera", "Trafikljus"),
                    CreatePixelChallenge(
                        "Vad är detta för objekt?",
                        "/assets/images/pixel/cone.jpg",
                        3,
                        "Vägkon",
                        "Vägkon", "Hinder", "Stolpe")
                ]
            });
        }

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
