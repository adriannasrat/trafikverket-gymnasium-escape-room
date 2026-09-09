using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class SessionFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task HealthEndpointIsAvailable()
    {
        var response = await client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PlayerCanCompleteActiveGameAndReachLeaderboard()
    {
        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Testspelaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var challenge = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(challenge);
        Assert.DoesNotContain(challenge.Challenge.Options, option => option.IsCorrect is not null);
        Assert.Equal(1, challenge.Challenge.Number);
        Assert.True(challenge.Challenge.Total >= 1);

        Guid correctOptionId;
        using (var scope = factory.Services.CreateScope())
        {
            correctOptionId = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option => option.IsCorrect)
                .Select(option => option.Id)
                .SingleAsync();
        }

        var answer = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/answers",
            new { challengeId = challenge.Challenge.Id, optionId = correctOptionId });
        answer.EnsureSuccessStatusCode();
        var result = await answer.Content.ReadFromJsonAsync<AnswerResponse>();
        Assert.True(result?.Correct);
        Assert.True(result?.Completed);

        var leaderboard = await client.GetFromJsonAsync<List<LeaderboardResponse>>("/api/leaderboard");
        Assert.Contains(leaderboard!, entry => entry.PlayerName == "Testspelaren" && entry.Rank == 1);
    }

    [Fact]
    public async Task ExpiredChallengeIsRegisteredAndItsTimerRestarts()
    {
        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Tidstestaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var challenge = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(challenge);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedSession = await db.GameSessions.SingleAsync(candidate => candidate.Id == session.Id);
            storedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        }

        var timeout = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/timeout",
            new { challengeId = challenge.Challenge.Id });
        timeout.EnsureSuccessStatusCode();
        var result = await timeout.Content.ReadFromJsonAsync<TimeoutResponse>();
        Assert.True(result?.Expired);
        Assert.Equal("Tiden tog slut. Försök igen.", result?.Message);

        await using var verificationScope = factory.Services.CreateAsyncScope();
        var attempt = await verificationScope.ServiceProvider
            .GetRequiredService<AppDbContext>()
            .ChallengeAttempts
            .SingleAsync(candidate =>
                candidate.GameSessionId == session.Id && candidate.ChallengeId == challenge.Challenge.Id);
        Assert.True(attempt.WasExpired);
        Assert.False(attempt.IsCorrect);
        Assert.Null(attempt.SelectedOptionId);
    }

    private sealed record SessionResponse(Guid Id);
    private sealed record ChallengeResponse(ChallengeBody Challenge);
    private sealed record ChallengeBody(Guid Id, int Number, int Total, List<OptionBody> Options);
    private sealed record OptionBody(Guid Id, string Text, bool? IsCorrect);
    private sealed record AnswerResponse(bool Correct, bool Completed);
    private sealed record TimeoutResponse(bool Expired, string Message);
    private sealed record LeaderboardResponse(int Rank, string PlayerName);
}
