using EscapeRoom.Api.Domain;

namespace EscapeRoom.Api.Features.Sessions;

public static class SessionTimeCalculator
{
    public static long CalculateElapsedMilliseconds(GameSession session, DateTimeOffset now)
    {
        var end = session.CompletedAtUtc ?? now;
        var pausedMilliseconds = session.TotalPausedMilliseconds;
        if (session.PausedAtUtc is { } pausedAt)
        {
            pausedMilliseconds += Math.Max(0, (long)(end - pausedAt).TotalMilliseconds);
        }

        var totalMilliseconds = (long)(end - session.StartedAtUtc).TotalMilliseconds;
        return Math.Max(0, totalMilliseconds - pausedMilliseconds + session.TotalPenaltyMilliseconds);
    }

    public static int GetTimeLimitSeconds(Challenge challenge) =>
        // Admin exposes one time per game. Ignore legacy per-question values that
        // can still exist in databases created by earlier versions.
        challenge.Game.DefaultTimeLimitSeconds;

    public static TimeSpan CalculateChallengeElapsed(
        GameSession session,
        DateTimeOffset now,
        bool includeCurrentPenalty = false)
    {
        if (session.CurrentChallengeStartedAtUtc is not { } startedAt)
        {
            return TimeSpan.Zero;
        }

        var elapsed = now - startedAt;
        return includeCurrentPenalty
            ? elapsed + TimeSpan.FromMilliseconds(session.CurrentChallengePenaltyMilliseconds)
            : elapsed;
    }
}
