using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> AddMatchingDestinationAsync(
        Guid gameId,
        ClaimsPrincipal principal,
        AppDbContext db,
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

        if (game.Type != GameType.Matching)
        {
            return Results.BadRequest(new { message = "Riskzoner kan bara läggas till i ett matchningsspel." });
        }

        var currentCount = game.Challenges.FirstOrDefault()?.Options.Count ?? 0;
        if (currentCount >= 6)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["destinations"] = ["Ett matchningsspel kan ha högst sex riskzoner."]
            });
        }

        var sortOrder = currentCount + 1;
        var addedOptions = game.Challenges.Select(challenge => new ChallengeOption
        {
            ChallengeId = challenge.Id,
            Text = "Ny riskzon",
            SortOrder = sortOrder,
            MatchingIconKey = "map-pin"
        }).ToList();
        db.ChallengeOptions.AddRange(addedOptions);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "created",
            EntityType = "matching-destination",
            EntityId = game.Id.ToString(),
            Summary = $"Added a destination to matching game '{game.Title}'."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/games/{game.Id}/matching-destinations/{sortOrder}", new
        {
            options = addedOptions.Select(option => new
            {
                option.ChallengeId,
                option.Id,
                option.Text,
                option.SortOrder,
                option.IsCorrect,
                option.MatchingIconKey
            })
        });
    }

    private static async Task<IResult> DeleteMatchingDestinationAsync(
        Guid gameId,
        int sortOrder,
        ClaimsPrincipal principal,
        AppDbContext db,
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

        if (game.Type != GameType.Matching)
        {
            return Results.BadRequest(new { message = "Riskzoner kan bara tas bort från ett matchningsspel." });
        }

        var options = game.Challenges
            .SelectMany(challenge => challenge.Options)
            .Where(option => option.SortOrder == sortOrder)
            .ToList();
        if (options.Count == 0)
        {
            return Results.NotFound();
        }

        if (game.Challenges.Any(challenge => challenge.Options.Count <= 2) ||
            game.Challenges.First().Options.Count <= game.Challenges.Count)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["destinations"] = ["Spelet behöver minst lika många riskzoner som scenarier."]
            });
        }

        if (options.Any(option => option.IsCorrect))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["destinations"] = ["Byt rätt riskzon för berörda scenarier innan riskzonen tas bort."]
            });
        }

        db.ChallengeOptions.RemoveRange(options);
        foreach (var option in game.Challenges.SelectMany(challenge => challenge.Options)
                     .Where(option => option.SortOrder > sortOrder))
        {
            option.SortOrder--;
        }

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "deleted",
            EntityType = "matching-destination",
            EntityId = game.Id.ToString(),
            Summary = $"Removed a destination from matching game '{game.Title}'."
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}

