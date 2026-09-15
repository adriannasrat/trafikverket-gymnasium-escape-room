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
                .Where(option => option.ChallengeId == challenge.Challenge.Id && option.IsCorrect)
                .Select(option => option.Id)
                .SingleAsync();
        }

        var answer = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/answers",
            new { challengeId = challenge.Challenge.Id, optionId = correctOptionId });
        answer.EnsureSuccessStatusCode();
        var result = await answer.Content.ReadFromJsonAsync<AnswerResponse>();
        Assert.True(result?.Correct);
        Assert.False(result?.Completed);

        var nextResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, nextResponse.StatusCode);
        var matching = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(matching?.Matching);
        Assert.Equal("Matching", matching.Game.Type);
        Assert.Equal(3, matching.Matching.Scenarios.Count);

        var wrongSelections = matching.Matching.Scenarios
            .Select((scenario, index) =>
            {
                var wrongDestination = matching.Matching.Destinations[
                    (index + 1) % matching.Matching.Destinations.Count];
                var option = scenario.Options.Single(candidate => candidate.Text == wrongDestination);
                return new MatchSelectionRequest(scenario.Id, option.Id);
            })
            .ToList();
        var wrongMatchResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/matches",
            new { challengeId = matching.Challenge.Id, selections = wrongSelections });
        wrongMatchResponse.EnsureSuccessStatusCode();
        var wrongMatchResult = await wrongMatchResponse.Content.ReadFromJsonAsync<MatchingAnswerResponse>();
        Assert.False(wrongMatchResult?.Correct);
        Assert.Equal(3, wrongMatchResult?.IncorrectChallengeIds.Count);

        List<MatchSelectionRequest> selections;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var scenarioIds = matching.Matching.Scenarios.Select(scenario => scenario.Id).ToList();
            selections = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option => scenarioIds.Contains(option.ChallengeId) && option.IsCorrect)
                .Select(option => new MatchSelectionRequest(option.ChallengeId, option.Id))
                .ToListAsync();
        }

        var matchResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/matches",
            new { challengeId = matching.Challenge.Id, selections });
        matchResponse.EnsureSuccessStatusCode();
        var matchResult = await matchResponse.Content.ReadFromJsonAsync<AnswerResponse>();
        Assert.True(matchResult?.Correct);
        Assert.False(matchResult?.Completed);

        var finishResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, finishResponse.StatusCode);
        var completedSession = await client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.Equal("Completed", completedSession?.Status);

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
    private sealed record ChallengeResponse(GameBody Game, ChallengeBody Challenge, MatchingBody? Matching);
    private sealed record GameBody(string Type);
    private sealed record ChallengeBody(Guid Id, int Number, int Total, List<OptionBody> Options);
    private sealed record MatchingBody(List<MatchingScenarioBody> Scenarios, List<string> Destinations);
    private sealed record MatchingScenarioBody(Guid Id, string Prompt, List<OptionBody> Options);
    private sealed record MatchSelectionRequest(Guid ChallengeId, Guid OptionId);
    private sealed record OptionBody(Guid Id, string Text, bool? IsCorrect);
    private sealed record AnswerResponse(bool Correct, bool Completed);
    private sealed record MatchingAnswerResponse(bool Correct, List<Guid> IncorrectChallengeIds);
    private sealed record SessionStatusResponse(string Status);
    private sealed record TimeoutResponse(bool Expired, string Message);
    private sealed record LeaderboardResponse(int Rank, string PlayerName);
}
