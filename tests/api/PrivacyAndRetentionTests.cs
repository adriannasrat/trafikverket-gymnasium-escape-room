using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace EscapeRoom.Api.Tests;

public sealed class PrivacyAndRetentionTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task PrivacySettingsAndNewSessionsUseConfiguredExperienceMode()
    {
        var privacy = await client.GetFromJsonAsync<PrivacyResponse>("/api/privacy");

        Assert.NotNull(privacy);
        Assert.Equal("Event", privacy.Mode);
        Assert.Equal(30, privacy.RetentionDays);

        var response = await client.PostAsJsonAsync(
            "/api/sessions/",
            new { playerName = "Integritetstest" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);
        Assert.Equal("Event", session.ExperienceMode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            ExperienceMode.Event,
            await db.GameSessions
                .Where(candidate => candidate.Id == session.Id)
                .Select(candidate => candidate.ExperienceMode)
                .SingleAsync());
    }

    [Fact]
    public async Task PublicLeaderboardOnlyReturnsConfiguredExperienceMode()
    {
        var now = DateTimeOffset.UtcNow;
        var eventId = Guid.NewGuid();
        var demoId = Guid.NewGuid();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.GameSessions.AddRange(
                new GameSession
                {
                    Id = eventId,
                    PlayerName = "Eventspelare",
                    ExperienceMode = ExperienceMode.Event,
                    StartedAtUtc = now.AddSeconds(-20),
                    CompletedAtUtc = now,
                    Status = SessionStatus.Completed
                },
                new GameSession
                {
                    Id = demoId,
                    PlayerName = "Demospelare",
                    ExperienceMode = ExperienceMode.Demo,
                    StartedAtUtc = now.AddSeconds(-10),
                    CompletedAtUtc = now,
                    Status = SessionStatus.Completed
                });
            await db.SaveChangesAsync();
        }

        var leaderboard = await client.GetFromJsonAsync<List<LeaderboardResponse>>(
            "/api/leaderboard");

        Assert.NotNull(leaderboard);
        Assert.Contains(leaderboard, entry => entry.Id == eventId && entry.ExperienceMode == "Event");
        Assert.DoesNotContain(leaderboard, entry => entry.Id == demoId);
    }

    [Fact]
    public async Task CleanupDeletesExpiredSessionsAndAnswersButKeepsRecentData()
    {
        var now = new DateTimeOffset(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
        var oldCompletedId = Guid.NewGuid();
        var oldActiveId = Guid.NewGuid();
        var recentId = Guid.NewGuid();
        Guid attemptId;

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var challengeId = await db.Challenges.Select(challenge => challenge.Id).FirstAsync();
        var oldCompleted = new GameSession
        {
            Id = oldCompletedId,
            PlayerName = "Gammalt resultat",
            StartedAtUtc = now.AddDays(-40),
            CompletedAtUtc = now.AddDays(-35),
            Status = SessionStatus.Completed
        };
        var oldActive = new GameSession
        {
            Id = oldActiveId,
            PlayerName = "Övergiven omgång",
            ExperienceMode = ExperienceMode.Demo,
            StartedAtUtc = now.AddDays(-31),
            Status = SessionStatus.InProgress,
            CurrentChallengeId = challengeId,
            CurrentChallengeStartedAtUtc = now.AddDays(-31)
        };
        var recent = new GameSession
        {
            Id = recentId,
            PlayerName = "Nytt resultat",
            StartedAtUtc = now.AddDays(-10),
            CompletedAtUtc = now.AddDays(-9),
            Status = SessionStatus.Completed
        };
        var attempt = new ChallengeAttempt
        {
            GameSession = oldCompleted,
            ChallengeId = challengeId,
            SubmittedAtUtc = now.AddDays(-35),
            IsCorrect = true
        };
        db.GameSessions.AddRange(oldCompleted, oldActive, recent);
        db.ChallengeAttempts.Add(attempt);
        await db.SaveChangesAsync();
        attemptId = attempt.Id;

        var service = new SessionRetentionService(
            db,
            new FixedTimeProvider(now),
            Options.Create(new DataRetentionOptions
            {
                RetentionDays = 30,
                CleanupIntervalHours = 6
            }));

        var deletedCount = await service.DeleteExpiredSessionsAsync();

        Assert.Equal(2, deletedCount);
        Assert.False(await db.GameSessions.AnyAsync(session => session.Id == oldCompletedId));
        Assert.False(await db.GameSessions.AnyAsync(session => session.Id == oldActiveId));
        Assert.False(await db.ChallengeAttempts.AnyAsync(candidate => candidate.Id == attemptId));
        Assert.True(await db.GameSessions.AnyAsync(session => session.Id == recentId));
    }

    private sealed record PrivacyResponse(string Mode, int RetentionDays);
    private sealed record SessionResponse(Guid Id, string ExperienceMode);
    private sealed record LeaderboardResponse(Guid Id, string ExperienceMode);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
