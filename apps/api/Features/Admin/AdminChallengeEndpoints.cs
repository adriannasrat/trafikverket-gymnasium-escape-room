using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> AddChallengeAsync(
        Guid gameId,
        ClaimsPrincipal principal,
        AppDbContext db,
        IConfiguration configuration,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var game = await db.Games
            .AsSplitQuery()
            .Include(candidate => candidate.Challenges.Where(challenge => challenge.IsActive))
                .ThenInclude(challenge => challenge.Options)
            .SingleOrDefaultAsync(candidate => candidate.Id == gameId, cancellationToken);
        if (game is null)
        {
            return Results.NotFound();
        }

        if (game.Type.RequiresChallengeImages() &&
            !configuration.GetValue("Features:ChallengeImageUploads", true))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Nya bildfrågor är avstängda",
                detail: "Onlineversionen använder de permanenta demobilderna. Nya bildfrågor kan skapas vid lokal drift eller med beständig fillagring.");
        }

        if (game.Type == GameType.Matching &&
            game.Challenges.Count >= (game.Challenges.FirstOrDefault()?.Options.Count ?? 0))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["challenges"] = ["Lägg till en ny riskzon innan du lägger till fler scenarier."]
            });
        }

        var highestSortOrder = await db.Challenges
            .Where(candidate => candidate.GameId == game.Id && candidate.IsActive)
            .MaxAsync(candidate => (int?)candidate.SortOrder, cancellationToken) ?? 0;
        var matchingTemplateOptions = game.Type == GameType.Matching
            ? game.Challenges
                .OrderBy(candidate => candidate.SortOrder)
                .First()
                .Options
                .OrderBy(option => option.SortOrder)
                .ToList()
            : [];
        var usedCorrectSortOrders = game.Challenges
            .SelectMany(candidate => candidate.Options)
            .Where(option => option.IsCorrect)
            .Select(option => option.SortOrder)
            .ToHashSet();
        var nextCorrectSortOrder = matchingTemplateOptions
            .Select(option => option.SortOrder)
            .FirstOrDefault(sortOrder => !usedCorrectSortOrders.Contains(sortOrder));
        var challenge = new Challenge
        {
            GameId = game.Id,
            Prompt = game.Type switch
            {
                GameType.Matching => "Nytt riskscenario",
                GameType.TrueFalse => "Nytt påstående",
                GameType.PixelHunt => "Vad visar bilden?",
                GameType.Sorting => "Sortera korten till rätt område.",
                GameType.WordAssembly => "Dra orddelarna så att de bildar ett korrekt sammansatt ord.",
                GameType.Hangman => "Vilket Trafikverket-ord söker vi? Använd ledtråden och gissa en bokstav i taget.",
                _ => "Ny fråga"
            },
            ImagePath = game.Type == GameType.PixelHunt
                ? game.Challenges.OrderBy(candidate => candidate.SortOrder).FirstOrDefault()?.ImagePath
                : null,
            SortOrder = highestSortOrder + 1,
            Options = game.Type == GameType.Matching
                ? matchingTemplateOptions
                    .Select(option => new ChallengeOption
                    {
                        Text = option.Text,
                        SortOrder = option.SortOrder,
                        IsCorrect = option.SortOrder == nextCorrectSortOrder,
                        MatchingIconKey = option.MatchingIconKey
                    })
                    .ToList()
                : game.Type == GameType.TrueFalse
                    ?
                    [
                        new ChallengeOption { Text = "Sant", SortOrder = 1, IsCorrect = true },
                        new ChallengeOption { Text = "Falskt", SortOrder = 2 }
                    ]
                : game.Type == GameType.PixelHunt
                    ?
                    [
                        new ChallengeOption { Text = "Svarsalternativ A", SortOrder = 1, IsCorrect = true },
                        new ChallengeOption { Text = "Svarsalternativ B", SortOrder = 2 },
                        new ChallengeOption { Text = "Svarsalternativ C", SortOrder = 3 },
                        new ChallengeOption { Text = "Svarsalternativ D", SortOrder = 4 }
                    ]
                : game.Type == GameType.Sorting
                    ?
                    [
                        new ChallengeOption { Text = "Kort 1", SortOrder = 1, SortingCategory = "Kategori A" },
                        new ChallengeOption { Text = "Kort 2", SortOrder = 2, SortingCategory = "Kategori A" },
                        new ChallengeOption { Text = "Kort 3", SortOrder = 3, SortingCategory = "Kategori B" },
                        new ChallengeOption { Text = "Kort 4", SortOrder = 4, SortingCategory = "Kategori B" },
                        new ChallengeOption { Text = "Bluffkort", SortOrder = 5 }
                    ]
                : game.Type == GameType.WordAssembly
                    ?
                    [
                        new ChallengeOption { Text = "Ord", SortOrder = 1 },
                        new ChallengeOption { Text = "Del", SortOrder = 2 },
                        new ChallengeOption { Text = "Exempel", SortOrder = 3 }
                    ]
                : game.Type == GameType.Hangman
                    ?
                    [
                        new ChallengeOption { Text = "TRAFIKVERKET", SortOrder = 1 }
                    ]
                :
                [
                    new ChallengeOption { Text = "Svarsalternativ A", SortOrder = 1, IsCorrect = true },
                    new ChallengeOption { Text = "Svarsalternativ B", SortOrder = 2 },
                    new ChallengeOption { Text = "Svarsalternativ C", SortOrder = 3 },
                    new ChallengeOption { Text = "Svarsalternativ D", SortOrder = 4 }
                ]
        };

        db.Challenges.Add(challenge);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "created",
            EntityType = "challenge",
            EntityId = challenge.Id.ToString(),
            Summary = $"Added a new challenge to game '{game.Title}'."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/challenges/{challenge.Id}", ToAdminChallenge(challenge));
    }

    private static async Task<IResult> DeleteChallengeAsync(
        Guid challengeId,
        ClaimsPrincipal principal,
        AppDbContext db,
        ChallengeImageService imageService,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == challengeId && candidate.IsActive,
                cancellationToken);
        if (challenge is null)
        {
            return Results.NotFound();
        }

        var remainingChallenges = await db.Challenges
            .Where(candidate =>
                candidate.GameId == challenge.GameId &&
                candidate.IsActive &&
                candidate.Id != challenge.Id)
            .OrderBy(candidate => candidate.SortOrder)
            .ToListAsync(cancellationToken);
        if (!remainingChallenges.Any(candidate => candidate.IsEnabled))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["challenge"] = ["Spelet måste innehålla minst en aktiv fråga."]
            });
        }

        var nextChallengeId = await db.Challenges
            .Where(candidate =>
                candidate.IsActive &&
                candidate.IsEnabled &&
                candidate.Id != challenge.Id &&
                candidate.Game.IsActive &&
                (candidate.Game.SortOrder > challenge.Game.SortOrder ||
                 (candidate.GameId == challenge.GameId && candidate.SortOrder > challenge.SortOrder)))
            .OrderBy(candidate => candidate.Game.SortOrder)
            .ThenBy(candidate => candidate.SortOrder)
            .Select(candidate => (Guid?)candidate.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var detachedImagePath = challenge.ImagePath;
        challenge.ImagePath = null;
        challenge.IsActive = false;
        for (var index = 0; index < remainingChallenges.Count; index++)
        {
            remainingChallenges[index].SortOrder = index + 1;
        }

        var affectedSessions = await db.GameSessions
            .Where(session =>
                session.Status == SessionStatus.InProgress &&
                session.CurrentChallengeId == challenge.Id)
            .ToListAsync(cancellationToken);
        var now = timeProvider.GetUtcNow();
        foreach (var session in affectedSessions)
        {
            if (session.PausedAtUtc is { } pausedAt)
            {
                session.TotalPausedMilliseconds += Math.Max(0, (long)(now - pausedAt).TotalMilliseconds);
                session.PausedAtUtc = null;
            }

            session.CurrentChallengeId = nextChallengeId;
            session.CurrentChallengeStartedAtUtc = nextChallengeId is null ? null : now;
            if (nextChallengeId is null)
            {
                session.Status = SessionStatus.Completed;
                session.CompletedAtUtc = now;
            }
        }

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = now,
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "deleted",
            EntityType = "challenge",
            EntityId = challenge.Id.ToString(),
            Summary = $"Removed challenge '{challenge.Prompt}' from game '{challenge.Game.Title}'."
        });
        await db.SaveChangesAsync(cancellationToken);
        await imageService.DeleteIfUnreferencedAsync(detachedImagePath, CancellationToken.None);

        return Results.NoContent();
    }
}

