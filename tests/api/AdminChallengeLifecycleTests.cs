using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class AdminChallengeLifecycleTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AdminCanAddUploadImageAndRemoveAChallenge()
    {
        await LoginAsync();
        var initialGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var game = initialGames!.Single(candidate => candidate.Type == "Quiz");
        var initialChallengeCount = game.Challenges.Count;

        var createRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{game.Id}/challenges");
        await AddAntiforgeryTokenAsync(createRequest);
        var createResponse = await Client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(created);
        Assert.Equal(4, created.Options.Count);
        Assert.Single(created.Options, option => option.IsCorrect);

        using var image = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]);
        image.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        using var form = new MultipartFormDataContent();
        form.Add(image, "image", "skylt.png");
        using var uploadRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{created.Id}/image")
        {
            Content = form
        };
        await AddAntiforgeryTokenAsync(uploadRequest);
        var uploadResponse = await Client.SendAsync(uploadRequest);
        Assert.Equal(HttpStatusCode.OK, uploadResponse.StatusCode);
        var uploaded = await uploadResponse.Content.ReadFromJsonAsync<ImageResponse>();
        Assert.StartsWith("/uploads/", uploaded?.ImagePath);
        var storedImageResponse = await Client.GetAsync(uploaded!.ImagePath);
        Assert.Equal(HttpStatusCode.OK, storedImageResponse.StatusCode);
        Assert.Equal("image/png", storedImageResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal(
            [137, 80, 78, 71, 13, 10, 26, 10],
            await storedImageResponse.Content.ReadAsByteArrayAsync());

        var started = await Client.PostAsJsonAsync("/api/sessions/", new { playerName = "Bildtestaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var firstChallenge = await Client.GetFromJsonAsync<ChallengeEnvelope>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(firstChallenge);
        Guid correctOptionId;
        await using (var answerScope = Factory.Services.CreateAsyncScope())
        {
            correctOptionId = await answerScope.ServiceProvider
                .GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option =>
                    option.ChallengeId == firstChallenge.Challenge.Id && option.IsCorrect)
                .Select(option => option.Id)
                .SingleAsync();
        }

        var answer = await Client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/answers",
            new { challengeId = firstChallenge.Challenge.Id, optionId = correctOptionId });
        answer.EnsureSuccessStatusCode();

        var pausedBefore = await Client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        await Task.Delay(100);
        var pausedAfter = await Client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.InRange(
            Math.Abs(pausedAfter!.ElapsedMilliseconds - pausedBefore!.ElapsedMilliseconds),
            0,
            10);

        var nextResponse = await Client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, nextResponse.StatusCode);

        await using (var pauseScope = Factory.Services.CreateAsyncScope())
        {
            var pausedSession = await pauseScope.ServiceProvider
                .GetRequiredService<AppDbContext>()
                .GameSessions
                .SingleAsync(candidate => candidate.Id == session.Id);
            Assert.Null(pausedSession.PausedAtUtc);
            Assert.True(pausedSession.TotalPausedMilliseconds >= 100);
        }

        var imageChallenge = await Client.GetFromJsonAsync<ChallengeEnvelope>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.Equal(created.Id, imageChallenge?.Challenge.Id);
        Assert.Equal(uploaded?.ImagePath, imageChallenge?.Challenge.ImagePath);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{created.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialChallengeCount,
            updatedGames!.Single(candidate => candidate.Id == game.Id).Challenges.Count);
        var completedSession = await Client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.Equal("InProgress", completedSession?.Status);

        await using var scope = Factory.Services.CreateAsyncScope();
        var deletedChallenge = await scope.ServiceProvider
            .GetRequiredService<AppDbContext>()
            .Challenges
            .SingleAsync(challenge => challenge.Id == created.Id);
        Assert.False(deletedChallenge.IsActive);
        Assert.Null(deletedChallenge.ImagePath);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync(uploaded!.ImagePath)).StatusCode);
    }

}

