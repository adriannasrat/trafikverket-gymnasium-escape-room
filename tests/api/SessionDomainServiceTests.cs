using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Features.Sessions;

namespace EscapeRoom.Api.Tests;

public sealed class SessionDomainServiceTests
{
    [Fact]
    public void ElapsedTimeExcludesPausesAndIncludesPenalties()
    {
        var startedAt = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        var session = new GameSession
        {
            PlayerName = "Testspelaren",
            StartedAtUtc = startedAt,
            TotalPausedMilliseconds = 10_000,
            PausedAtUtc = startedAt.AddSeconds(80),
            TotalPenaltyMilliseconds = 5_000
        };

        var elapsed = SessionTimeCalculator.CalculateElapsedMilliseconds(
            session,
            startedAt.AddSeconds(100));

        Assert.Equal(75_000, elapsed);
    }

    [Fact]
    public void GameTimeLimitOverridesLegacyChallengeValue()
    {
        var challenge = new Challenge
        {
            Prompt = "Test",
            TimeLimitSeconds = 60,
            Game = new Game
            {
                Slug = "test",
                Title = "Test",
                Summary = "Test",
                SuccessMessage = "Klart",
                DefaultTimeLimitSeconds = 120
            }
        };

        Assert.Equal(120, SessionTimeCalculator.GetTimeLimitSeconds(challenge));
    }

    [Fact]
    public void HangmanRulesNormalizeGuessesAndBuildTheVisiblePattern()
    {
        var answer = HangmanRules.NormalizeAnswer("  Väg-Säker  ");

        var state = HangmanRules.BuildState(answer, ["v", "Ä", "x", "x", "ogiltig"]);

        Assert.Equal("VÄG-SÄKER", answer);
        Assert.Equal(["V", "Ä", "X"], state.GuessedLetters);
        Assert.Equal(1, state.Mistakes);
        Assert.Equal(["V", "Ä", null, "-", null, "Ä", null, null, null], state.Pattern);
        Assert.False(state.Solved);
    }

    [Fact]
    public void ScoreDependsOnTimeRemainingAndIsAddedToTheSession()
    {
        var startedAt = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        var session = new GameSession
        {
            PlayerName = "Poängtestaren",
            StartedAtUtc = startedAt,
            CurrentChallengeStartedAtUtc = startedAt
        };
        var challenge = new Challenge
        {
            Prompt = "Test",
            Game = new Game
            {
                Slug = "test",
                Title = "Test",
                Summary = "Test",
                SuccessMessage = "Klart",
                DefaultTimeLimitSeconds = 60
            }
        };

        var progress = new SessionProgressService().AwardChallengeScore(
            session,
            challenge,
            startedAt.AddSeconds(30));

        Assert.Equal(550, progress.ScoreAwarded);
        Assert.Equal(550, progress.Score);
        Assert.Equal(550, session.Score);
        Assert.Equal(GameSession.InitialLives, progress.LivesRemaining);
    }

    [Fact]
    public void FiveFailedAttemptsConsumeTheSharedLivesAndEndTheSession()
    {
        var now = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        var session = new GameSession
        {
            PlayerName = "Livtestaren",
            StartedAtUtc = now,
            CurrentChallengeStartedAtUtc = now
        };
        var service = new SessionProgressService();

        for (var attempt = 1; attempt <= GameSession.InitialLives; attempt++)
        {
            var progress = service.RegisterFailedAttempt(session, now.AddSeconds(attempt));
            Assert.Equal(GameSession.InitialLives - attempt, progress.LivesRemaining);
            Assert.Equal(attempt == GameSession.InitialLives, progress.GameOver);
        }

        Assert.Equal(SessionStatus.Abandoned, session.Status);
        Assert.Equal(0, session.LivesRemaining);
        Assert.Equal(now.AddSeconds(GameSession.InitialLives), session.CompletedAtUtc);
    }

    [Fact]
    public void TimeoutConsumesAllRemainingLivesAndEndsTheSession()
    {
        var now = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        var session = new GameSession
        {
            PlayerName = "Timeouttestaren",
            StartedAtUtc = now,
            CurrentChallengeStartedAtUtc = now,
            LivesRemaining = 4
        };

        var progress = new SessionProgressService().RegisterTimeout(
            session,
            now.AddMinutes(1));

        Assert.True(progress.LifeLost);
        Assert.True(progress.GameOver);
        Assert.Equal(0, progress.LivesRemaining);
        Assert.Equal(0, session.LivesRemaining);
        Assert.Equal(SessionStatus.Abandoned, session.Status);
        Assert.Equal(now.AddMinutes(1), session.CompletedAtUtc);
    }
}
