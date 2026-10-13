using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> GetResultsAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var sessions = await db.GameSessions.AsNoTracking()
            .Where(session =>
                session.Status == SessionStatus.Completed &&
                session.CompletedAtUtc != null)
            .ToListAsync(cancellationToken);

        var results = sessions
            .Select(session => new
            {
                session.Id,
                session.PlayerName,
                session.StartedAtUtc,
                completedAtUtc = session.CompletedAtUtc!.Value,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session)
            })
            .OrderBy(result => result.elapsedMilliseconds)
            .ThenBy(result => result.completedAtUtc)
            .Select((result, index) => new
            {
                rank = index + 1,
                result.Id,
                result.PlayerName,
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
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var sessions = await db.GameSessions
            .Include(session => session.Attempts)
            .Where(session => session.Status == SessionStatus.Completed)
            .ToListAsync(cancellationToken);

        db.GameSessions.RemoveRange(sessions);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "cleared",
            EntityType = "game-results",
            EntityId = "all",
            Summary = $"Deleted all {sessions.Count} completed game results."
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}

