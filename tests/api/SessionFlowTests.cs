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
    public async Task TeamCanCompleteActiveGameAndReachLeaderboard()
    {
        var started = await client.PostAsJsonAsync("/api/sessions/", new { teamName = "Testlaget" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var challenge = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(challenge);
        Assert.DoesNotContain(challenge.Challenge.Options, option => option.IsCorrect is not null);

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
        Assert.Contains(leaderboard!, entry => entry.TeamName == "Testlaget" && entry.Rank == 1);
    }

    private sealed record SessionResponse(Guid Id);
    private sealed record ChallengeResponse(ChallengeBody Challenge);
    private sealed record ChallengeBody(Guid Id, List<OptionBody> Options);
    private sealed record OptionBody(Guid Id, string Text, bool? IsCorrect);
    private sealed record AnswerResponse(bool Correct, bool Completed);
    private sealed record LeaderboardResponse(int Rank, string TeamName);
}
