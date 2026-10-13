using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> AddWordPartAsync(
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

        if (challenge.Game.Type != GameType.WordAssembly)
        {
            return Results.BadRequest(new { message = "Orddelar kan bara läggas till i spelet Bilda ordet." });
        }

        if (challenge.Options.Count >= 8)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["wordParts"] = ["Ett ord kan bestå av högst åtta delar."]
            });
        }

        var option = new ChallengeOption
        {
            ChallengeId = challenge.Id,
            Text = "Ny del",
            SortOrder = challenge.Options.Max(candidate => (int?)candidate.SortOrder) + 1 ?? 1
        };
        db.ChallengeOptions.Add(option);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "created",
            EntityType = "word-part",
            EntityId = option.Id.ToString(),
            Summary = $"Added a word part to challenge '{challenge.Prompt}'."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/admin/challenges/{challenge.Id}/word-parts/{option.Id}",
            ToAdminOption(option));
    }

    private static async Task<IResult> DeleteWordPartAsync(
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

        if (challenge.Game.Type != GameType.WordAssembly)
        {
            return Results.BadRequest(new { message = "Orddelar kan bara tas bort från spelet Bilda ordet." });
        }

        var option = challenge.Options.SingleOrDefault(candidate => candidate.Id == optionId);
        if (option is null)
        {
            return Results.NotFound();
        }

        if (challenge.Options.Count <= 2)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["wordParts"] = ["Ett ord måste bestå av minst två delar."]
            });
        }

        db.ChallengeOptions.Remove(option);
        var remainingOptions = challenge.Options
            .Where(candidate => candidate.Id != option.Id)
            .OrderBy(candidate => candidate.SortOrder)
            .ToList();
        for (var index = 0; index < remainingOptions.Count; index++)
        {
            remainingOptions[index].SortOrder = index + 1;
        }

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "deleted",
            EntityType = "word-part",
            EntityId = option.Id.ToString(),
            Summary = $"Removed word part '{option.Text}' from challenge '{challenge.Prompt}'."
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}

