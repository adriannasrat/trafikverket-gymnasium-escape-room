using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    private static async Task<IResult> SubmitMatchesAsync(
        Guid sessionId,
        SubmitMatchesRequest request,
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
            return Results.BadRequest(new { message = "Matchningarna tillhör inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Uppdraget är redan klart. Gå vidare när du är redo." });
        }

        var currentChallenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleAsync(candidate => candidate.Id == session.CurrentChallengeId, cancellationToken);
        if (currentChallenge.Game.Type != GameType.Matching)
        {
            return Results.BadRequest(new { message = "Det aktuella uppdraget är inte ett matchningsspel." });
        }

        var scenarios = await db.Challenges
            .Where(candidate =>
                candidate.GameId == currentChallenge.GameId &&
                candidate.IsActive &&
                candidate.IsEnabled)
            .Include(candidate => candidate.Options)
            .OrderBy(candidate => candidate.SortOrder)
            .ToListAsync(cancellationToken);
        if (request.Selections.Count != scenarios.Count ||
            request.Selections.Select(selection => selection.ChallengeId).Distinct().Count() != scenarios.Count)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["selections"] = ["Varje scenario måste vara kopplat till exakt en riskzon."]
            });
        }

        var selectedOptions = new List<(Challenge Challenge, ChallengeOption Option)>();
        foreach (var scenario in scenarios)
        {
            var selection = request.Selections.SingleOrDefault(candidate => candidate.ChallengeId == scenario.Id);
            var option = scenario.Options.SingleOrDefault(candidate => candidate.Id == selection?.OptionId);
            if (option is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["selections"] = ["En vald riskzon tillhör inte rätt scenario."]
                });
            }

            selectedOptions.Add((scenario, option));
        }

        if (selectedOptions.Select(selected => selected.Option.SortOrder).Distinct().Count() != scenarios.Count)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["selections"] = ["Varje riskzon kan bara kopplas till ett scenario."]
            });
        }

        var now = timeProvider.GetUtcNow();
        var timeLimit = GetTimeLimitSeconds(currentChallenge);
        var expired = now - session.CurrentChallengeStartedAtUtc.Value > TimeSpan.FromSeconds(timeLimit);
        foreach (var selected in selectedOptions)
        {
            db.ChallengeAttempts.Add(new ChallengeAttempt
            {
                GameSessionId = session.Id,
                ChallengeId = selected.Challenge.Id,
                SelectedOptionId = selected.Option.Id,
                SubmittedAtUtc = now,
                IsCorrect = selected.Option.IsCorrect && !expired,
                WasExpired = expired
            });
        }

        if (expired)
        {
            session.CurrentChallengeStartedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired = true,
                message = "Tiden tog slut. Kopplingarna har återställts – försök igen.",
                incorrectChallengeIds = scenarios.Select(scenario => scenario.Id),
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit
            });
        }

        var incorrectChallengeIds = selectedOptions
            .Where(selected => !selected.Option.IsCorrect)
            .Select(selected => selected.Challenge.Id)
            .ToList();
        if (incorrectChallengeIds.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired = false,
                message = "Några kopplingar är fel. De gröna är låsta – rätta de röda och försök igen.",
                incorrectChallengeIds
            });
        }

        session.CurrentChallengeStartedAtUtc = null;
        session.PausedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            correct = true,
            completed = false,
            currentChallenge.Game.SuccessMessage,
            incorrectChallengeIds,
            elapsedMilliseconds = CalculateElapsedMilliseconds(session, now)
        });
    }
}

