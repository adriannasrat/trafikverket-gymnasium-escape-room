using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> AddSortingCardAsync(
        Guid challengeId,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == challengeId && candidate.IsActive,
                cancellationToken);
        if (challenge is null)
        {
            return Results.NotFound();
        }

        if (challenge.Game.Type != GameType.Sorting)
        {
            return Results.BadRequest(new { message = "Kort kan bara läggas till i ett sorteringsspel." });
        }

        var nextSortOrder = challenge.Options.Max(option => (int?)option.SortOrder) + 1 ?? 1;
        var option = new ChallengeOption
        {
            ChallengeId = challenge.Id,
            Text = "Nytt kort",
            SortOrder = nextSortOrder,
            SortingCategory = null
        };

        db.ChallengeOptions.Add(option);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "created",
            EntityType = "sorting-card",
            EntityId = option.Id.ToString(),
            Summary = $"Added a sorting card to challenge '{challenge.Prompt}'."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/admin/challenges/{challenge.Id}/sorting-cards/{option.Id}",
            ToAdminOption(option));
    }

    private static async Task<IResult> DeleteSortingCardAsync(
        Guid challengeId,
        Guid optionId,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == challengeId && candidate.IsActive,
                cancellationToken);
        if (challenge is null)
        {
            return Results.NotFound();
        }

        if (challenge.Game.Type != GameType.Sorting)
        {
            return Results.BadRequest(new { message = "Kort kan bara tas bort från ett sorteringsspel." });
        }

        var option = challenge.Options.SingleOrDefault(candidate => candidate.Id == optionId);
        if (option is null)
        {
            return Results.NotFound();
        }

        var remainingOptions = challenge.Options
            .Where(candidate => candidate.Id != option.Id)
            .OrderBy(candidate => candidate.SortOrder)
            .ToList();
        var remainingCategories = remainingOptions
            .Select(candidate => candidate.SortingCategory?.Trim())
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        if (remainingCategories < 2)
        {
            return Results.BadRequest(new
            {
                message = "Sorteringen måste behålla minst två målområden. Lägg till eller ändra ett annat kort först."
            });
        }

        db.ChallengeOptions.Remove(option);
        for (var index = 0; index < remainingOptions.Count; index++)
        {
            remainingOptions[index].SortOrder = index + 1;
        }

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "deleted",
            EntityType = "sorting-card",
            EntityId = option.Id.ToString(),
            Summary = $"Removed sorting card '{option.Text}' from challenge '{challenge.Prompt}'."
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}

