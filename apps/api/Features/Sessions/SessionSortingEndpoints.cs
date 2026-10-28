using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    private static async Task<IResult> SubmitSortingAsync(
        Guid sessionId,
        SubmitSortingRequest request,
        AppDbContext db,
        TimeProvider timeProvider,
        SessionProgressService progressService,
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
            return Results.BadRequest(new { message = "Sorteringen tillhör inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Sorteringen är redan klar. Gå vidare när du är redo." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        if (challenge.Game.Type != GameType.Sorting)
        {
            return Results.BadRequest(new { message = "Det aktuella uppdraget är inte ett sorteringsspel." });
        }

        if (request.Placements.Count != challenge.Options.Count ||
            request.Placements.Select(placement => placement.OptionId).Distinct().Count() != challenge.Options.Count ||
            request.Placements.Any(placement => challenge.Options.All(option => option.Id != placement.OptionId)))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["placements"] = ["Varje kort måste finnas med exakt en gång i sorteringen."]
            });
        }

        var categories = challenge.Options
            .Where(option => option.SortingCategory != null)
            .Select(option => option.SortingCategory!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (request.Placements.Any(placement =>
                !string.IsNullOrWhiteSpace(placement.Category) &&
                !categories.Contains(placement.Category.Trim())))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["placements"] = ["Ett kort har placerats i en kategori som inte finns."]
            });
        }

        var now = timeProvider.GetUtcNow();
        var timeLimit = SessionTimeCalculator.GetTimeLimitSeconds(challenge);
        var elapsed = now - session.CurrentChallengeStartedAtUtc.Value +
            TimeSpan.FromMilliseconds(session.CurrentChallengePenaltyMilliseconds);
        if (elapsed >= TimeSpan.FromSeconds(timeLimit))
        {
            db.ChallengeAttempts.Add(new ChallengeAttempt
            {
                GameSessionId = session.Id,
                ChallengeId = challenge.Id,
                SubmittedAtUtc = now,
                IsCorrect = false,
                WasExpired = true
            });
            var progress = progressService.RegisterTimeout(session, now);
            session.CurrentChallengePenaltyMilliseconds = 0;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired = true,
                message = "Tiden tog slut. Alla liv är förlorade och uppdraget är avslutat.",
                incorrectOptionIds = challenge.Options.Select(option => option.Id),
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit,
                currentChallengePenaltyMilliseconds = 0,
                elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
                progress
            });
        }

        var placements = request.Placements.ToDictionary(
            placement => placement.OptionId,
            placement => string.IsNullOrWhiteSpace(placement.Category) ? null : placement.Category.Trim());
        var incorrectOptionIds = challenge.Options
            .Where(option => !string.Equals(
                option.SortingCategory,
                placements[option.Id],
                StringComparison.OrdinalIgnoreCase))
            .Select(option => option.Id)
            .ToList();

        db.ChallengeAttempts.Add(new ChallengeAttempt
        {
            GameSessionId = session.Id,
            ChallengeId = challenge.Id,
            SubmittedAtUtc = now,
            IsCorrect = incorrectOptionIds.Count == 0,
            WasExpired = false
        });

        if (incorrectOptionIds.Count > 0)
        {
            var progress = progressService.RegisterFailedAttempt(session, now);
            if (progress.GameOver)
            {
                session.CurrentChallengePenaltyMilliseconds = 0;
                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(new
                {
                    correct = false,
                    expired = false,
                    message = "Det sista livet försvann. Uppdraget är avslutat.",
                    incorrectOptionIds,
                    currentChallengePenaltyMilliseconds = 0,
                    elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
                    progress
                });
            }

            const long penaltyMilliseconds = 10_000;
            session.TotalPenaltyMilliseconds += penaltyMilliseconds;
            session.CurrentChallengePenaltyMilliseconds += penaltyMilliseconds;
            var secondsRemaining = timeLimit -
                (now - session.CurrentChallengeStartedAtUtc.Value).TotalSeconds -
                session.CurrentChallengePenaltyMilliseconds / 1000d;
            var penaltyExpired = secondsRemaining <= 0;
            if (penaltyExpired)
            {
                progress = progressService.RegisterTimeout(session, now);
                session.CurrentChallengePenaltyMilliseconds = 0;
            }

            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired = penaltyExpired,
                message = penaltyExpired
                    ? "Tiden tog slut. Alla liv är förlorade och uppdraget är avslutat."
                    : "Några kort ligger fel. De gröna är låsta – rätta de röda. 10 sekunder har lagts till på totaltiden.",
                incorrectOptionIds,
                challengeStartedAtUtc = penaltyExpired
                    ? now
                    : session.CurrentChallengeStartedAtUtc!.Value,
                timeLimitSeconds = timeLimit,
                currentChallengePenaltyMilliseconds = session.CurrentChallengePenaltyMilliseconds,
                secondsRemaining = penaltyExpired ? timeLimit : Math.Max(0, secondsRemaining),
                elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
                progress
            });
        }

        var successProgress = progressService.AwardChallengeScore(session, challenge, now);
        session.CurrentChallengeStartedAtUtc = null;
        session.CurrentChallengePenaltyMilliseconds = 0;
        session.PausedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            correct = true,
            completed = false,
            challenge.Game.SuccessMessage,
            incorrectOptionIds,
            currentChallengePenaltyMilliseconds = 0,
            elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
            progress = successProgress
        });
    }
}

