using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class AdminTimeLimitTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AdminTimeLimitAppliesToEveryChallengeAcrossAllGameTypes()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.NotNull(games);
        Assert.Equal(7, games.Count);

        var expectedLimits = new Dictionary<Guid, int>();
        foreach (var (game, index) in games.OrderBy(game => game.SortOrder).Select((game, index) => (game, index)))
        {
            var expectedLimit = game.Type == "Sorting" ? 120 : 41 + index;
            expectedLimits[game.Id] = expectedLimit;
            using var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/games/{game.Id}")
            {
                Content = JsonContent.Create(new
                {
                    game.Title,
                    game.Summary,
                    game.IsActive,
                    DefaultTimeLimitSeconds = expectedLimit,
                    game.SuccessMessage,
                    game.Challenges
                })
            };
            await AddAntiforgeryTokenAsync(updateRequest);

            var updateResponse = await Client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updatedGame = await updateResponse.Content.ReadFromJsonAsync<AdminGameResponse>();
            Assert.NotNull(updatedGame);
            Assert.Equal(expectedLimit, updatedGame.DefaultTimeLimitSeconds);
            Assert.All(updatedGame.Challenges, challenge => Assert.Null(challenge.TimeLimitSeconds));
        }

        var started = await Client.PostAsJsonAsync("/api/sessions/", new { playerName = "Tidstestaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persistedGames = await db.Games
            .Include(game => game.Challenges.Where(challenge => challenge.IsActive))
                .ThenInclude(challenge => challenge.Options)
            .OrderBy(game => game.SortOrder)
            .ToListAsync();
        var persistedSession = await db.GameSessions.SingleAsync(candidate => candidate.Id == session.Id);

        foreach (var game in persistedGames)
        {
            var expectedLimit = expectedLimits[game.Id];
            Assert.Equal(expectedLimit, game.DefaultTimeLimitSeconds);
            Assert.All(game.Challenges, challenge => Assert.Null(challenge.TimeLimitSeconds));

            var firstChallenge = game.Challenges.OrderBy(challenge => challenge.SortOrder).First();
            // Existing installations can still contain these old per-question values.
            // The public game flow must ignore them and use the time shown in admin.
            firstChallenge.TimeLimitSeconds = 60;
            persistedSession.CurrentChallengeId = firstChallenge.Id;
            persistedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();

            var current = await Client.GetFromJsonAsync<ChallengeEnvelope>(
                $"/api/sessions/{session.Id}/current-challenge");
            Assert.NotNull(current);
            Assert.Equal(expectedLimit, current.Challenge.TimeLimitSeconds);

            if (game.Type == GameType.Sorting)
            {
                persistedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow.AddSeconds(-70);
                await db.SaveChangesAsync();

                var sortingResponse = await Client.PostAsJsonAsync(
                    $"/api/sessions/{session.Id}/sorting",
                    new
                    {
                        challengeId = firstChallenge.Id,
                        placements = firstChallenge.Options.Select(option => new
                        {
                            optionId = option.Id,
                            category = (string?)null
                        })
                    });
                sortingResponse.EnsureSuccessStatusCode();
                var sortingResult = await sortingResponse.Content.ReadFromJsonAsync<SortingTimerResponse>();
                Assert.NotNull(sortingResult);
                Assert.False(sortingResult.Expired);
                Assert.Equal(120, sortingResult.TimeLimitSeconds);
                Assert.InRange(sortingResult.SecondsRemaining, 39, 41);
            }
        }
    }

}

