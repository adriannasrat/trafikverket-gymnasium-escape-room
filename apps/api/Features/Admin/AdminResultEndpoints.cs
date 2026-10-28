using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> GetResultsAsync(
        ExperienceMode? mode,
        AppDbContext db,
        IOptions<ExperienceOptions> experienceOptions,
        CancellationToken cancellationToken)
    {
        var selectedMode = mode ?? experienceOptions.Value.Mode;
        var sessions = await db.GameSessions.AsNoTracking()
            .Where(session =>
                session.ExperienceMode == selectedMode &&
                session.Status == SessionStatus.Completed &&
                session.CompletedAtUtc != null)
            .ToListAsync(cancellationToken);

        var results = sessions
            .Select(session => new
            {
                session.Id,
                session.PlayerName,
                session.ExperienceMode,
                session.Score,
                session.LivesRemaining,
                session.StartedAtUtc,
                completedAtUtc = session.CompletedAtUtc!.Value,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session)
            })
            .OrderByDescending(result => result.Score)
            .ThenBy(result => result.elapsedMilliseconds)
            .ThenBy(result => result.completedAtUtc)
            .Select((result, index) => new
            {
                rank = index + 1,
                result.Id,
                result.PlayerName,
                result.Score,
                result.LivesRemaining,
                experienceMode = result.ExperienceMode.ToString(),
                result.StartedAtUtc,
                result.completedAtUtc,
                result.elapsedMilliseconds
            });

        return Results.Ok(results);
    }

    private static async Task<IResult> DeleteResultAsync(
        Guid sessionId,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions
            .Include(candidate => candidate.Attempts)
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == sessionId &&
                    candidate.Status == SessionStatus.Completed,
                cancellationToken);
        if (session is null)
        {
            return Results.NotFound(new { message = "Spelresultatet finns inte längre." });
        }

        db.GameSessions.Remove(session);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "deleted",
            EntityType = "game-result",
            EntityId = session.Id.ToString(),
            Summary = "Deleted one completed game result."
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAllResultsAsync(
        ExperienceMode? mode,
        ClaimsPrincipal principal,
        AppDbContext db,
        IOptions<ExperienceOptions> experienceOptions,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var selectedMode = mode ?? experienceOptions.Value.Mode;
        var sessions = await db.GameSessions
            .Include(session => session.Attempts)
            .Where(session =>
                session.ExperienceMode == selectedMode &&
                session.Status == SessionStatus.Completed)
            .ToListAsync(cancellationToken);

        db.GameSessions.RemoveRange(sessions);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "cleared",
            EntityType = "game-results",
            EntityId = "all",
            Summary = $"Deleted all {sessions.Count} completed {selectedMode} game results."
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}

