using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    private static async Task<IResult> SubmitHangmanGuessAsync(
        Guid sessionId,
        SubmitHangmanGuessRequest request,
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
            return Results.BadRequest(new { message = "Bokstaven tillhör inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Ordet är redan löst. Gå vidare när du är redo." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        if (challenge.Game.Type != GameType.Hangman || challenge.Options.Count != 1)
        {
            return Results.BadRequest(new { message = "Det aktuella uppdraget är inte ett signalord." });
        }

        var letter = request.Letter.Trim().ToUpperInvariant();
        if (letter.Length != 1 || !char.IsLetter(letter[0]) || !HangmanAlphabet.Contains(letter, StringComparison.Ordinal))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["letter"] = ["Välj en bokstav från det svenska alfabetet."]
            });
        }

        var roundStartedAt = session.CurrentChallengeStartedAtUtc.Value;
        var previousGuesses = await db.ChallengeAttempts.AsNoTracking()
            .Where(attempt => attempt.GameSessionId == session.Id &&
                attempt.ChallengeId == challenge.Id &&
                attempt.SubmittedValue != null &&
                attempt.SubmittedAtUtc > roundStartedAt)
            .Select(attempt => attempt.SubmittedValue!)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (previousGuesses.Contains(letter, StringComparer.Ordinal))
        {
            return Results.Conflict(new { message = "Den bokstaven är redan gissad." });
        }

        var now = timeProvider.GetUtcNow();
        var timeLimit = GetTimeLimitSeconds(challenge);
        var expired = now - roundStartedAt >= TimeSpan.FromSeconds(timeLimit);
        var answer = NormalizeHangmanAnswer(challenge.Options.Single().Text);
        var letterIsCorrect = answer.Contains(letter, StringComparison.Ordinal);
        db.ChallengeAttempts.Add(new ChallengeAttempt
        {
            GameSessionId = session.Id,
            ChallengeId = challenge.Id,
            SubmittedValue = letter,
            SubmittedAtUtc = now,
            IsCorrect = letterIsCorrect && !expired,
            WasExpired = expired
        });

        if (expired)
        {
            session.CurrentChallengeStartedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                solved = false,
                expired = true,
                roundReset = true,
                message = "Tiden tog slut. Bokstäverna har återställts – försök igen.",
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit,
                hangman = BuildHangmanState(answer, [])
            });
        }

        var guesses = previousGuesses.Append(letter).Distinct(StringComparer.Ordinal).ToList();
        var state = BuildHangmanState(answer, guesses);
        if (state.Solved)
        {
            session.CurrentChallengeStartedAtUtc = null;
            session.PausedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = true,
                solved = true,
                expired = false,
                roundReset = false,
                challenge.Game.SuccessMessage,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session, now),
                hangman = state
            });
        }

        if (state.Mistakes >= HangmanMaximumMistakes)
        {
            const int penaltyMilliseconds = 10_000;
            session.TotalPenaltyMilliseconds += penaltyMilliseconds;
            session.CurrentChallengeStartedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                solved = false,
                expired = false,
                roundReset = true,
                message = "Signalen visar stopp. Bokstäverna återställs och 10 sekunder läggs till på totaltiden.",
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session, now),
                hangman = state
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            correct = letterIsCorrect,
            solved = false,
            expired = false,
            roundReset = false,
            message = letterIsCorrect ? "Bokstaven finns i ordet." : "Bokstaven finns inte i ordet.",
            elapsedMilliseconds = CalculateElapsedMilliseconds(session, now),
            hangman = state
        });
    }
}

