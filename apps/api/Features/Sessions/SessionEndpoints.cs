using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sessions").WithTags("Sessions");
        group.MapPost("/", StartSessionAsync);
        group.MapGet("/{sessionId:guid}", GetSessionAsync);
        group.MapGet("/{sessionId:guid}/current-challenge", GetCurrentChallengeAsync);
        group.MapPost("/{sessionId:guid}/answers", SubmitAnswerAsync);
        group.MapPost("/{sessionId:guid}/timeout", RegisterTimeoutAsync);
        group.MapPost("/{sessionId:guid}/next", MoveToNextChallengeAsync);

        endpoints.MapGet("/api/leaderboard", GetLeaderboardAsync).WithTags("Leaderboard");
        return endpoints;
    }

    private static async Task<IResult> StartSessionAsync(
        StartSessionRequest request,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var playerName = request.PlayerName.Trim();
        if (playerName.Length is < 2 or > 80)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["playerName"] = ["Namnet måste innehålla mellan 2 och 80 tecken."]
            });
        }

        var firstChallenge = await LoadOrderedChallenges(db)
            .FirstOrDefaultAsync(cancellationToken);
        if (firstChallenge is null)
        {
            return Results.Problem(
                title: "Inga aktiva uppdrag",
                detail: "En administratör måste aktivera minst ett uppdrag innan spelet kan starta.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var now = timeProvider.GetUtcNow();
        var session = new GameSession
        {
            PlayerName = playerName,
            StartedAtUtc = now,
            CurrentChallengeId = firstChallenge.Id,
            CurrentChallengeStartedAtUtc = now
        };
        db.GameSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/sessions/{session.Id}", ToSessionResponse(session, now));
    }

    private static async Task<IResult> GetSessionAsync(
        Guid sessionId,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        return session is null
            ? Results.NotFound()
            : Results.Ok(ToSessionResponse(session, timeProvider.GetUtcNow()));
    }

    private static async Task<IResult> GetCurrentChallengeAsync(
        Guid sessionId,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }

        if (session.Status == SessionStatus.Completed || session.CurrentChallengeId is null)
        {
            return Results.Ok(new { completed = true });
        }

        var challenge = await db.Challenges.AsNoTracking()
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == session.CurrentChallengeId, cancellationToken);
        var limit = challenge.TimeLimitSeconds ?? challenge.Game.DefaultTimeLimitSeconds;
        var now = timeProvider.GetUtcNow();
        var awaitingNext = session.CurrentChallengeStartedAtUtc is null;
        var startedAt = session.CurrentChallengeStartedAtUtc ?? now;
        var elapsed = awaitingNext ? TimeSpan.Zero : now - startedAt;
        var challengeIds = await db.Challenges.AsNoTracking()
            .Where(candidate => candidate.GameId == challenge.GameId && candidate.IsActive)
            .OrderBy(candidate => candidate.SortOrder)
            .Select(candidate => candidate.Id)
            .ToListAsync(cancellationToken);
        var challengeNumber = challengeIds.IndexOf(challenge.Id) + 1;

        return Results.Ok(new
        {
            completed = false,
            sessionId = session.Id,
            session.PlayerName,
            session.StartedAtUtc,
            game = new
            {
                challenge.Game.Id,
                challenge.Game.Slug,
                challenge.Game.Title,
                challenge.Game.Summary,
                challenge.Game.SortOrder
            },
            challenge = new
            {
                challenge.Id,
                challenge.Prompt,
                challenge.ImagePath,
                number = challengeNumber,
                total = challengeIds.Count,
                awaitingNext,
                timeLimitSeconds = limit,
                challengeStartedAtUtc = startedAt,
                secondsRemaining = Math.Max(0, limit - elapsed.TotalSeconds),
                options = challenge.Options
                    .OrderBy(option => option.SortOrder)
                    .Select(option => new { option.Id, option.Text })
            }
        });
    }

    private static async Task<IResult> RegisterTimeoutAsync(
        Guid sessionId,
        ChallengeTimeoutRequest request,
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
            return Results.BadRequest(new { message = "Tiden gäller inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Frågan är redan klar. Gå vidare till nästa fråga." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var limit = challenge.TimeLimitSeconds ?? challenge.Game.DefaultTimeLimitSeconds;
        var elapsed = now - session.CurrentChallengeStartedAtUtc.Value;
        var secondsRemaining = limit - elapsed.TotalSeconds;
        if (secondsRemaining > 0)
        {
            return Results.Ok(new
            {
                expired = false,
                challengeStartedAtUtc = session.CurrentChallengeStartedAtUtc.Value,
                timeLimitSeconds = limit,
                secondsRemaining
            });
        }

        db.ChallengeAttempts.Add(new ChallengeAttempt
        {
            GameSessionId = session.Id,
            ChallengeId = challenge.Id,
            SubmittedAtUtc = now,
            IsCorrect = false,
            WasExpired = true
        });
        session.CurrentChallengeStartedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            expired = true,
            message = "Tiden tog slut. Försök igen.",
            challengeStartedAtUtc = now,
            timeLimitSeconds = limit,
            secondsRemaining = (double)limit
        });
    }

    private static async Task<IResult> MoveToNextChallengeAsync(
        Guid sessionId,
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

        if (session.CurrentChallengeStartedAtUtc is not null)
        {
            return Results.Conflict(new { message = "Besvara den aktuella frågan innan du går vidare." });
        }

        var orderedChallengeIds = await LoadOrderedChallenges(db)
            .Select(candidate => candidate.Id)
            .ToListAsync(cancellationToken);
        var currentIndex = orderedChallengeIds.IndexOf(session.CurrentChallengeId.Value);
        var nextChallengeId = currentIndex >= 0 && currentIndex + 1 < orderedChallengeIds.Count
            ? orderedChallengeIds[currentIndex + 1]
            : (Guid?)null;
        var now = timeProvider.GetUtcNow();
        session.CurrentChallengeId = nextChallengeId;
        session.CurrentChallengeStartedAtUtc = nextChallengeId is null ? null : now;
        if (nextChallengeId is null)
        {
            session.Status = SessionStatus.Completed;
            session.CompletedAtUtc = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> SubmitAnswerAsync(
        Guid sessionId,
        SubmitAnswerRequest request,
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
        var timeLimit = challenge.TimeLimitSeconds ?? challenge.Game.DefaultTimeLimitSeconds;
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
            session.CurrentChallengeStartedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(new
            {
                correct = false,
                expired,
                message = expired ? "Tiden tog slut. Försök igen." : "Det var inte rätt svar. Försök igen.",
                challengeStartedAtUtc = now,
                timeLimitSeconds = timeLimit
            });
        }

        var orderedChallengeIds = await LoadOrderedChallenges(db)
            .Select(candidate => candidate.Id)
            .ToListAsync(cancellationToken);
        var currentIndex = orderedChallengeIds.IndexOf(challenge.Id);
        var nextChallengeId = currentIndex >= 0 && currentIndex + 1 < orderedChallengeIds.Count
            ? orderedChallengeIds[currentIndex + 1]
            : (Guid?)null;

        if (nextChallengeId is null)
        {
            session.CurrentChallengeId = null;
            session.CurrentChallengeStartedAtUtc = null;
            session.Status = SessionStatus.Completed;
            session.CompletedAtUtc = now;
        }
        else
        {
            session.CurrentChallengeStartedAtUtc = null;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            correct = true,
            completed = session.Status == SessionStatus.Completed,
            challenge.Game.SuccessMessage,
            elapsedMilliseconds = (long)(now - session.StartedAtUtc).TotalMilliseconds
        });
    }

    private static async Task<IResult> GetLeaderboardAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var sessions = await db.GameSessions.AsNoTracking()
            .Where(session => session.Status == SessionStatus.Completed && session.CompletedAtUtc != null)
            .OrderBy(session => session.CompletedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        var leaderboard = sessions
            .Select(session => new
            {
                session.Id,
                session.PlayerName,
                session.CompletedAtUtc,
                elapsedMilliseconds = (long)(session.CompletedAtUtc!.Value - session.StartedAtUtc).TotalMilliseconds
            })
            .OrderBy(result => result.elapsedMilliseconds)
            .ThenBy(result => result.CompletedAtUtc)
            .Take(10)
            .Select((result, index) => new
            {
                rank = index + 1,
                result.Id,
                result.PlayerName,
                result.elapsedMilliseconds,
                result.CompletedAtUtc
            });

        return Results.Ok(leaderboard);
    }

    private static IQueryable<Challenge> LoadOrderedChallenges(AppDbContext db) =>
        db.Challenges
            .Where(challenge => challenge.Game.IsActive && challenge.IsActive)
            .OrderBy(challenge => challenge.Game.SortOrder)
            .ThenBy(challenge => challenge.SortOrder);

    private static object ToSessionResponse(GameSession session, DateTimeOffset now) => new
    {
        session.Id,
        session.PlayerName,
        session.StartedAtUtc,
        session.CompletedAtUtc,
        status = session.Status.ToString(),
        elapsedMilliseconds = (long)((session.CompletedAtUtc ?? now) - session.StartedAtUtc).TotalMilliseconds
    };

    public sealed record StartSessionRequest(string PlayerName);
    public sealed record SubmitAnswerRequest(Guid ChallengeId, Guid OptionId);
    public sealed record ChallengeTimeoutRequest(Guid ChallengeId);
}
