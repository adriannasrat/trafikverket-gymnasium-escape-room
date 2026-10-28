using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    private static async Task<IResult> RevealPixelAsync(
        Guid sessionId,
        PixelRevealRequest request,
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

        if (session.Status != SessionStatus.InProgress || session.CurrentChallengeId is null ||
            session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Bilden kan inte skärpas när frågan är klar." });
        }

        if (session.CurrentChallengeId != request.ChallengeId)
        {
            return Results.BadRequest(new { message = "Bilden tillhör inte den aktuella frågan." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        if (challenge.Game.Type != GameType.PixelHunt || string.IsNullOrWhiteSpace(challenge.ImagePath))
        {
            return Results.BadRequest(new { message = "Den aktuella frågan har ingen bild att skärpa." });
        }

        var now = timeProvider.GetUtcNow();
        var timeLimit = SessionTimeCalculator.GetTimeLimitSeconds(challenge);
        if (now - session.CurrentChallengeStartedAtUtc.Value >= TimeSpan.FromSeconds(timeLimit))
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
            session.PixelRevealCount = 0;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                expired = true,
                message = "Tiden tog slut. Alla liv är förlorade och uppdraget är avslutat.",
                pixelRevealCount = 0,
                penaltySeconds = session.TotalPenaltyMilliseconds / 1000,
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit,
                elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
                progress
            });
        }

        const int maximumReveals = 5;
        if (session.PixelRevealCount >= maximumReveals)
        {
            return Results.Conflict(new { message = "Bilden är redan helt skarp." });
        }

        session.PixelRevealCount++;
        session.TotalPenaltyMilliseconds += 5_000;
        var currentProgress = progressService.Snapshot(session);
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            expired = false,
            pixelRevealCount = session.PixelRevealCount,
            penaltySeconds = session.TotalPenaltyMilliseconds / 1000,
            elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
            progress = currentProgress
        });
    }

    private static async Task<IResult> SubmitAnswerAsync(
        Guid sessionId,
        SubmitAnswerRequest request,
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
            return Results.BadRequest(new { message = "Svaret tillhör inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Frågan är redan klar. Gå vidare till nästa fråga." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        var selectedOption = challenge.Options.SingleOrDefault(option => option.Id == request.OptionId);
        if (selectedOption is null)
        {
            return Results.BadRequest(new { message = "Svarsalternativet finns inte." });
        }

        var now = timeProvider.GetUtcNow();
        var challengeStartedAt = session.CurrentChallengeStartedAtUtc.Value;
        var timeLimit = SessionTimeCalculator.GetTimeLimitSeconds(challenge);
        var expired = now - challengeStartedAt > TimeSpan.FromSeconds(timeLimit);

        db.ChallengeAttempts.Add(new ChallengeAttempt
        {
            GameSessionId = session.Id,
            ChallengeId = challenge.Id,
            SelectedOptionId = selectedOption.Id,
            SubmittedAtUtc = now,
            IsCorrect = selectedOption.IsCorrect && !expired,
            WasExpired = expired
        });

        if (expired || !selectedOption.IsCorrect)
        {
            var progress = expired
                ? progressService.RegisterTimeout(session, now)
                : progressService.RegisterFailedAttempt(session, now);
            if (!progress.GameOver)
            {
                session.CurrentChallengeStartedAtUtc = now;
            }
            session.PixelRevealCount = 0;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired,
                message = progress.GameOver
                    ? expired
                        ? "Tiden tog slut. Alla liv är förlorade och uppdraget är avslutat."
                        : "Det sista livet försvann. Uppdraget är avslutat."
                    : expired ? "Tiden tog slut. Försök igen." : "Det var inte rätt svar. Försök igen.",
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit,
                progress
            });
        }

        var successProgress = progressService.AwardChallengeScore(session, challenge, now);
        session.CurrentChallengeStartedAtUtc = null;
        session.PausedAtUtc = now;

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            correct = true,
            completed = false,
            challenge.Game.SuccessMessage,
            elapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
            progress = successProgress
        });
    }
}

