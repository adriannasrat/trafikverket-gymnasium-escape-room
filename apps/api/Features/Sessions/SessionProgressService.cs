using EscapeRoom.Api.Domain;

namespace EscapeRoom.Api.Features.Sessions;

public sealed class SessionProgressService
{
    private const int MinimumChallengeScore = 100;
    private const int MaximumChallengeScore = 1_000;

    public SessionProgressResponse Snapshot(GameSession session) => new(
        session.Score,
        0,
        session.LivesRemaining,
        false,
        session.Status == SessionStatus.Abandoned);

    public SessionProgressResponse AwardChallengeScore(
        GameSession session,
        Challenge challenge,
        DateTimeOffset now)
    {
        var elapsed = SessionTimeCalculator.CalculateChallengeElapsed(
            session,
            now,
            includeCurrentPenalty: true);
        var timeLimit = SessionTimeCalculator.GetTimeLimitSeconds(challenge);
        var remainingRatio = Math.Clamp(
            1d - elapsed.TotalSeconds / timeLimit,
            0d,
            1d);
        var rawScore = MinimumChallengeScore +
            (MaximumChallengeScore - MinimumChallengeScore) * remainingRatio;
        var scoreAwarded = Math.Clamp(
            (int)(Math.Round(rawScore / 10d, MidpointRounding.AwayFromZero) * 10),
            MinimumChallengeScore,
            MaximumChallengeScore);

        session.Score += scoreAwarded;
        return new SessionProgressResponse(
            session.Score,
            scoreAwarded,
            session.LivesRemaining,
            false,
            false);
    }

    public SessionProgressResponse RegisterFailedAttempt(
        GameSession session,
        DateTimeOffset now)
    {
        if (session.Status != SessionStatus.InProgress)
        {
            return Snapshot(session);
        }

        session.LivesRemaining = Math.Max(0, session.LivesRemaining - 1);
        var gameOver = session.LivesRemaining == 0;
        if (gameOver)
        {
            session.Status = SessionStatus.Abandoned;
            session.CompletedAtUtc = now;
            session.CurrentChallengeStartedAtUtc = null;
            session.PausedAtUtc = null;
        }

        return new SessionProgressResponse(
            session.Score,
            0,
            session.LivesRemaining,
            true,
            gameOver);
    }

    public SessionProgressResponse RegisterTimeout(
        GameSession session,
        DateTimeOffset now)
    {
        if (session.Status != SessionStatus.InProgress)
        {
            return Snapshot(session);
        }

        var lifeLost = session.LivesRemaining > 0;
        session.LivesRemaining = 0;
        session.Status = SessionStatus.Abandoned;
        session.CompletedAtUtc = now;
        session.CurrentChallengeStartedAtUtc = null;
        session.PausedAtUtc = null;

        return new SessionProgressResponse(
            session.Score,
            0,
            0,
            lifeLost,
            true);
    }
}
