using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public sealed class SessionService(
    AppDbContext db,
    TimeProvider timeProvider,
    CurrentChallengeResponseBuilder challengeResponseBuilder)
{
    public async Task<SessionResult<SessionResponse>> StartAsync(
        StartSessionRequest request,
        CancellationToken cancellationToken)
    {
        var playerName = request.PlayerName.Trim();
        if (playerName.Length is < 2 or > 80)
        {
            return SessionResults.Validation<SessionResponse>(new Dictionary<string, string[]>
            {
                ["playerName"] = ["Namnet måste innehålla mellan 2 och 80 tecken."]
            });
        }

        var firstChallenge = await LoadOrderedChallenges()
            .FirstOrDefaultAsync(cancellationToken);
        if (firstChallenge is null)
        {
            return SessionResults.Unavailable<SessionResponse>(
                "Inga aktiva uppdrag",
                "En administratör måste aktivera minst ett uppdrag innan spelet kan starta.");
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

        return SessionResults.Success(ToSessionResponse(session, now));
    }

    public async Task<SessionResult<SessionResponse>> GetAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        return session is null
            ? SessionResults.NotFound<SessionResponse>()
            : SessionResults.Success(
                ToSessionResponse(session, timeProvider.GetUtcNow()));
    }

    public async Task<SessionResult<object>> GetCurrentChallengeAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return SessionResults.NotFound<object>();
        }

        if (session.Status == SessionStatus.Completed || session.CurrentChallengeId is null)
        {
            return SessionResults.Success<object>(new SessionCompletedResponse(true));
        }

        var challenge = await db.Challenges.AsNoTracking()
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == session.CurrentChallengeId, cancellationToken);
        var response = await challengeResponseBuilder.BuildAsync(
            session,
            challenge,
            timeProvider.GetUtcNow(),
            cancellationToken);
        return SessionResults.Success<object>(response);
    }

    public async Task<SessionResult<object>> RegisterTimeoutAsync(
        Guid sessionId,
        ChallengeTimeoutRequest request,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return SessionResults.NotFound<object>();
        }

        if (session.Status != SessionStatus.InProgress || session.CurrentChallengeId is null)
        {
            return SessionResults.Conflict<object>("Spelsessionen är redan avslutad.");
        }

        if (session.CurrentChallengeId != request.ChallengeId)
        {
            return SessionResults.BadRequest<object>("Tiden gäller inte det aktuella uppdraget.");
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return SessionResults.Conflict<object>("Frågan är redan klar. Gå vidare till nästa fråga.");
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var limit = SessionTimeCalculator.GetTimeLimitSeconds(challenge);
        var elapsed = SessionTimeCalculator.CalculateChallengeElapsed(
            session,
            now,
            includeCurrentPenalty: true);
        var secondsRemaining = limit - elapsed.TotalSeconds;
        if (secondsRemaining > 0)
        {
            return SessionResults.Success<object>(new ChallengeTimeRemainingResponse(
                false,
                session.CurrentChallengeStartedAtUtc.Value,
                limit,
                secondsRemaining));
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
        session.PixelRevealCount = 0;
        session.CurrentChallengePenaltyMilliseconds = 0;
        await db.SaveChangesAsync(cancellationToken);

        return SessionResults.Success<object>(new ChallengeExpiredResponse(
            true,
            "Tiden tog slut. Försök igen.",
            now,
            limit,
            0,
            limit));
    }

    public async Task<SessionResult<bool>> MoveToNextChallengeAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return SessionResults.NotFound<bool>();
        }

        if (session.Status != SessionStatus.InProgress || session.CurrentChallengeId is null)
        {
            return SessionResults.Conflict<bool>("Spelsessionen är redan avslutad.");
        }

        if (session.CurrentChallengeStartedAtUtc is not null)
        {
            return SessionResults.Conflict<bool>("Besvara den aktuella frågan innan du går vidare.");
        }

        var currentChallenge = await db.Challenges.AsNoTracking()
            .Where(candidate => candidate.Id == session.CurrentChallengeId)
            .Select(candidate => new { candidate.GameId, candidate.Game.Type })
            .SingleAsync(cancellationToken);
        var orderedChallenges = await LoadOrderedChallenges()
            .Select(candidate => new { candidate.Id, candidate.GameId })
            .ToListAsync(cancellationToken);
        var currentIndex = orderedChallenges.FindIndex(
            candidate => candidate.Id == session.CurrentChallengeId.Value);
        var nextChallenge = currentIndex < 0
            ? null
            : orderedChallenges
                .Skip(currentIndex + 1)
                .FirstOrDefault(candidate =>
                    currentChallenge.Type != GameType.Matching ||
                    candidate.GameId != currentChallenge.GameId);
        var nextChallengeId = nextChallenge?.Id;
        var now = timeProvider.GetUtcNow();
        if (session.PausedAtUtc is { } pausedAt)
        {
            session.TotalPausedMilliseconds += Math.Max(
                0,
                (long)(now - pausedAt).TotalMilliseconds);
            session.PausedAtUtc = null;
        }

        session.CurrentChallengeId = nextChallengeId;
        session.CurrentChallengeStartedAtUtc = nextChallengeId is null ? null : now;
        session.PixelRevealCount = 0;
        session.CurrentChallengePenaltyMilliseconds = 0;
        if (nextChallengeId is null)
        {
            session.Status = SessionStatus.Completed;
            session.CompletedAtUtc = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return SessionResults.Success(true);
    }

    public async Task<List<LeaderboardEntryResponse>> GetLeaderboardAsync(
        CancellationToken cancellationToken)
    {
        var sessions = await db.GameSessions.AsNoTracking()
            .Where(session =>
                session.Status == SessionStatus.Completed &&
                session.CompletedAtUtc != null)
            .OrderBy(session => session.CompletedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        return sessions
            .Select(session => new
            {
                Session = session,
                ElapsedMilliseconds = SessionTimeCalculator.CalculateElapsedMilliseconds(
                    session,
                    session.CompletedAtUtc!.Value)
            })
            .OrderBy(result => result.ElapsedMilliseconds)
            .ThenBy(result => result.Session.CompletedAtUtc)
            .Take(10)
            .Select((result, index) => new LeaderboardEntryResponse(
                index + 1,
                result.Session.Id,
                result.Session.PlayerName,
                result.ElapsedMilliseconds,
                result.Session.CompletedAtUtc))
            .ToList();
    }

    private IQueryable<Challenge> LoadOrderedChallenges() => db.Challenges
        .Where(challenge =>
            challenge.Game.IsActive &&
            challenge.IsActive &&
            challenge.IsEnabled)
        .OrderBy(challenge => challenge.Game.SortOrder)
        .ThenBy(challenge => challenge.SortOrder);

    private static SessionResponse ToSessionResponse(GameSession session, DateTimeOffset now) => new(
        session.Id,
        session.PlayerName,
        session.StartedAtUtc,
        session.CompletedAtUtc,
        session.Status.ToString(),
        SessionTimeCalculator.CalculateElapsedMilliseconds(session, now));
}
