using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class AdminChallengeManagementTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task AdminCanAddUploadImageAndRemoveAChallenge()
    {
        await LoginAsync();
        var initialGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var game = Assert.Single(initialGames!);
        var initialChallengeCount = game.Challenges.Count;

        var createRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{game.Id}/challenges");
        await AddAntiforgeryTokenAsync(createRequest);
        var createResponse = await client.SendAsync(createRequest);
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
        var uploadResponse = await client.SendAsync(uploadRequest);
        Assert.Equal(HttpStatusCode.OK, uploadResponse.StatusCode);
        var uploaded = await uploadResponse.Content.ReadFromJsonAsync<ImageResponse>();
        Assert.StartsWith("/uploads/", uploaded?.ImagePath);

        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Bildtestaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var firstChallenge = await client.GetFromJsonAsync<ChallengeEnvelope>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(firstChallenge);
        Guid correctOptionId;
        await using (var answerScope = factory.Services.CreateAsyncScope())
        {
            correctOptionId = await answerScope.ServiceProvider
                .GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option =>
                    option.ChallengeId == firstChallenge.Challenge.Id && option.IsCorrect)
                .Select(option => option.Id)
                .SingleAsync();
        }

        var answer = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/answers",
            new { challengeId = firstChallenge.Challenge.Id, optionId = correctOptionId });
        answer.EnsureSuccessStatusCode();
        var nextResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, nextResponse.StatusCode);
        var imageChallenge = await client.GetFromJsonAsync<ChallengeEnvelope>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.Equal(created.Id, imageChallenge?.Challenge.Id);
        Assert.Equal(uploaded?.ImagePath, imageChallenge?.Challenge.ImagePath);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{created.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(initialChallengeCount, Assert.Single(updatedGames!).Challenges.Count);
        var completedSession = await client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.Equal("Completed", completedSession?.Status);

        await using var scope = factory.Services.CreateAsyncScope();
        var deletedChallenge = await scope.ServiceProvider
            .GetRequiredService<AppDbContext>()
            .Challenges
            .SingleAsync(challenge => challenge.Id == created.Id);
        Assert.False(deletedChallenge.IsActive);
        Assert.NotNull(deletedChallenge.ImagePath);
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
    private sealed record ImageResponse(string ImagePath);
    private sealed record SessionResponse(Guid Id);
    private sealed record SessionStatusResponse(string Status);
    private sealed record ChallengeEnvelope(AdminChallengeBody Challenge);
    private sealed record AdminChallengeBody(Guid Id, string? ImagePath);
    private sealed record AdminGameResponse(Guid Id, List<AdminChallengeResponse> Challenges);
    private sealed record AdminChallengeResponse(
        Guid Id,
        string Prompt,
        string? ImagePath,
        int SortOrder,
        int? TimeLimitSeconds,
        List<AdminOptionResponse> Options);
    private sealed record AdminOptionResponse(Guid Id, string Text, int SortOrder, bool IsCorrect);
}
