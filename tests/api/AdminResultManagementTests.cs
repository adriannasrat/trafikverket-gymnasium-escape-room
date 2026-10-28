using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class AdminResultManagementTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task AdminCanDeleteOneOrAllCompletedResultsWithoutInterruptingActiveSessions()
    {
        await LoginAsync();

        Guid fastestId;
        Guid slowerId;
        Guid activeId;
        Guid demoId;
        Guid abandonedId;
        Guid fastestAttemptId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var challengeId = await db.Challenges
                .OrderBy(challenge => challenge.Game.SortOrder)
                .ThenBy(challenge => challenge.SortOrder)
                .Select(challenge => challenge.Id)
                .FirstAsync();
            var now = DateTimeOffset.UtcNow;
            var fastest = new GameSession
            {
                PlayerName = "Snabb spelare",
                StartedAtUtc = now.AddSeconds(-12),
                CompletedAtUtc = now,
                Status = SessionStatus.Completed,
                TotalPausedMilliseconds = 2_000
            };
            var slower = new GameSession
            {
                PlayerName = "Lugn spelare",
                StartedAtUtc = now.AddSeconds(-25),
                CompletedAtUtc = now,
                Status = SessionStatus.Completed
            };
            var active = new GameSession
            {
                PlayerName = "Spelar fortfarande",
                StartedAtUtc = now,
                Status = SessionStatus.InProgress,
                CurrentChallengeId = challengeId,
                CurrentChallengeStartedAtUtc = now
            };
            var abandoned = new GameSession
            {
                PlayerName = "Ej slutförd spelare",
                StartedAtUtc = now.AddSeconds(-18),
                CompletedAtUtc = now,
                Status = SessionStatus.Abandoned,
                LivesRemaining = 0
            };
            var demo = new GameSession
            {
                PlayerName = "Demospelare",
                ExperienceMode = ExperienceMode.Demo,
                StartedAtUtc = now.AddSeconds(-8),
                CompletedAtUtc = now,
                Status = SessionStatus.Completed
            };
            var attempt = new ChallengeAttempt
            {
                GameSession = fastest,
                ChallengeId = challengeId,
                SubmittedAtUtc = now,
                IsCorrect = true
            };
            db.GameSessions.AddRange(fastest, slower, active, demo, abandoned);
            db.ChallengeAttempts.Add(attempt);
            await db.SaveChangesAsync();
            fastestId = fastest.Id;
            slowerId = slower.Id;
            activeId = active.Id;
            demoId = demo.Id;
            abandonedId = abandoned.Id;
            fastestAttemptId = attempt.Id;
        }

        var results = await client.GetFromJsonAsync<List<AdminResultResponse>>(
            "/api/admin/results?mode=Event");
        Assert.NotNull(results);
        Assert.Equal(3, results.Count);
        Assert.Equal(fastestId, results[0].Id);
        Assert.Equal(10_000, results[0].ElapsedMilliseconds);
        Assert.Equal(1, results[0].Rank);
        Assert.All(results, result => Assert.Equal("Event", result.ExperienceMode));
        Assert.DoesNotContain(results, result => result.Id == activeId);
        Assert.Contains(results, result =>
            result.Id == abandonedId && result.Status == "Abandoned");

        var demoResults = await client.GetFromJsonAsync<List<AdminResultResponse>>(
            "/api/admin/results?mode=Demo");
        var demoResult = Assert.Single(demoResults!);
        Assert.Equal(demoId, demoResult.Id);
        Assert.Equal("Demo", demoResult.ExperienceMode);

        using var deleteOneRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/results/{fastestId}");
        await AddAntiforgeryTokenAsync(deleteOneRequest);
        var deleteOneResponse = await client.SendAsync(deleteOneRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteOneResponse.StatusCode);

        await using (var verificationScope = factory.Services.CreateAsyncScope())
        {
            var db = verificationScope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.False(await db.GameSessions.AnyAsync(session => session.Id == fastestId));
            Assert.False(await db.ChallengeAttempts.AnyAsync(attempt => attempt.Id == fastestAttemptId));
        }

        using var deleteAllRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            "/api/admin/results?mode=Event");
        await AddAntiforgeryTokenAsync(deleteAllRequest);
        var deleteAllResponse = await client.SendAsync(deleteAllRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteAllResponse.StatusCode);

        await using var finalScope = factory.Services.CreateAsyncScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await finalDb.GameSessions.AnyAsync(session => session.Id == slowerId));
        Assert.False(await finalDb.GameSessions.AnyAsync(session => session.Id == abandonedId));
        Assert.True(await finalDb.GameSessions.AnyAsync(session => session.Id == activeId));
        Assert.True(await finalDb.GameSessions.AnyAsync(session => session.Id == demoId));
        Assert.Equal(
            2,
            await finalDb.AuditEntries.CountAsync(entry =>
                entry.EntityType == "game-result" || entry.EntityType == "game-results"));
    }

    private async Task LoginAsync()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new
            {
                username = "event-admin",
                password = "a-long-test-password"
            })
        };
        await AddAntiforgeryTokenAsync(request);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task AddAntiforgeryTokenAsync(HttpRequestMessage request)
    {
        var antiforgery = await client.GetFromJsonAsync<AntiforgeryResponse>("/api/auth/csrf");
        Assert.NotNull(antiforgery);
        request.Headers.Add("X-CSRF-TOKEN", antiforgery.Token);
    }

    private sealed record AntiforgeryResponse(string Token);
    private sealed record AdminResultResponse(
        int Rank,
        Guid Id,
        string PlayerName,
        string ExperienceMode,
        string Status,
        long ElapsedMilliseconds,
        DateTimeOffset CompletedAtUtc);
}
