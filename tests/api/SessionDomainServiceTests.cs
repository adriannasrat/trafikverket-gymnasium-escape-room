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
}
