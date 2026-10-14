using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    private static async Task<IResult> SubmitWordAssemblyAsync(
        Guid sessionId,
        SubmitWordAssemblyRequest request,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }

        if (session.Status != SessionStatus.InProgress || session.CurrentChallengeId is null)
        {
            return Results.Conflict(new { message = "Spelsessionen är redan avslutad." });
        }

        if (session.CurrentChallengeId != request.ChallengeId)
        {
            return Results.BadRequest(new { message = "Orddelarna tillhör inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Ordet är redan klart. Gå vidare när du är redo." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        if (challenge.Game.Type != GameType.WordAssembly)
        {
            return Results.BadRequest(new { message = "Det aktuella uppdraget är inte ett ordbyggarspel." });
        }

        var correctOrder = challenge.Options
            .OrderBy(option => option.SortOrder)
            .Select(option => option.Id)
            .ToList();
        if (request.OrderedOptionIds.Count != correctOrder.Count ||
            request.OrderedOptionIds.Distinct().Count() != correctOrder.Count ||
            request.OrderedOptionIds.Any(optionId => !correctOrder.Contains(optionId)))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["orderedOptionIds"] = ["Varje orddel måste finnas med exakt en gång."]
            });
        }

        var now = timeProvider.GetUtcNow();
        var timeLimit = GetTimeLimitSeconds(challenge);
        var expired = now - session.CurrentChallengeStartedAtUtc.Value >= TimeSpan.FromSeconds(timeLimit);
        var incorrectOptionIds = request.OrderedOptionIds
            .Where((optionId, index) => optionId != correctOrder[index])
            .ToList();

        db.ChallengeAttempts.Add(new ChallengeAttempt
        {
            GameSessionId = session.Id,
            ChallengeId = challenge.Id,
            SubmittedAtUtc = now,
            IsCorrect = !expired && incorrectOptionIds.Count == 0,
            WasExpired = expired
        });

        if (expired)
        {
            session.CurrentChallengeStartedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired = true,
                message = "Tiden tog slut. Orddelarna har blandats om – försök igen.",
                incorrectOptionIds = correctOrder,
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session, now)
            });
        }

        if (incorrectOptionIds.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired = false,
                message = "Orddelarna ligger inte i rätt ordning ännu. Försök igen.",
                incorrectOptionIds,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session, now)
            });
        }

        session.CurrentChallengeStartedAtUtc = null;
        session.PausedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            correct = true,
            completed = false,
            challenge.Game.SuccessMessage,
            incorrectOptionIds,
            elapsedMilliseconds = CalculateElapsedMilliseconds(session, now)
        });
    }
}

