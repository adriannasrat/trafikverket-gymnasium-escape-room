using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace EscapeRoom.Api.Tests;

public abstract class AdminApiTestBase : IDisposable
{
    protected ApiFactory Factory { get; }
    protected HttpClient Client { get; }

    protected AdminApiTestBase(ApiFactory factory)
    {
        Factory = factory;
        Client = factory.CreateClient();
    }

    protected Task LoginAsync() => LoginAsync(Client);

    protected static async Task LoginAsync(HttpClient targetClient)
    {
        var status = await targetClient.GetFromJsonAsync<AuthStatusResponse>("/api/auth/me");
        if (status?.Authenticated == true)
        {
            return;
        }

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new
            {
                username = "event-admin",
                password = "a-long-test-password"
            })
        };
        await AddAntiforgeryTokenAsync(request, targetClient);
        var response = await targetClient.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    protected async Task<HttpResponseMessage> UpdateChallengeAvailabilityAsync(
        AdminGameResponse game,
        Guid challengeId,
        bool isEnabled)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/games/{game.Id}")
        {
            Content = JsonContent.Create(new
            {
                game.Title,
                game.Summary,
                game.IsActive,
                game.DefaultTimeLimitSeconds,
                game.SuccessMessage,
                challenges = game.Challenges.Select(challenge => new
                {
                    challenge.Id,
                    challenge.Prompt,
                    IsEnabled = challenge.Id == challengeId ? isEnabled : challenge.IsEnabled,
                    challenge.SortOrder,
                    challenge.TimeLimitSeconds,
                    challenge.Options
                })
            })
        };
        await AddAntiforgeryTokenAsync(request);
        return await Client.SendAsync(request);
    }

    protected Task AddAntiforgeryTokenAsync(HttpRequestMessage request) =>
        AddAntiforgeryTokenAsync(request, Client);

    protected static async Task AddAntiforgeryTokenAsync(
        HttpRequestMessage request,
        HttpClient targetClient)
    {
        var antiforgery = await targetClient.GetFromJsonAsync<AntiforgeryResponse>("/api/auth/csrf");
        Assert.NotNull(antiforgery);
        request.Headers.Add("X-CSRF-TOKEN", antiforgery.Token);
    }

    protected static async Task<ImageResponse> UploadImageAsync(
        HttpClient targetClient,
        Guid challengeId,
        byte[] bytes)
    {
        using var image = new ByteArrayContent(bytes);
        image.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        using var form = new MultipartFormDataContent();
        form.Add(image, "image", "test.png");
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{challengeId}/image")
        {
            Content = form
        };
        await AddAntiforgeryTokenAsync(request, targetClient);
        var response = await targetClient.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ImageResponse>())!;
    }

    protected sealed record AntiforgeryResponse(string Token);
    protected sealed record AuthStatusResponse(bool Authenticated);
    protected sealed record ImageResponse(string ImagePath);
    protected sealed record ImageMutationResponse(string? ImagePath, bool IsEnabled);
    protected sealed record ImageCleanupFileResponse(string ImagePath, long SizeBytes, bool Deleted);
    protected sealed record ImageCleanupResponse(
        bool DryRun,
        int CandidateCount,
        int DeletedCount,
        int SkippedCount,
        long TotalBytes,
        List<ImageCleanupFileResponse> Files);
    protected sealed record SessionResponse(Guid Id);
    protected sealed record SessionStatusResponse(string Status, long ElapsedMilliseconds);
    protected sealed record SortingTimerResponse(
        bool Expired,
        int TimeLimitSeconds,
        double SecondsRemaining);
    protected sealed record AddedOptionsResponse(List<AddedOptionResponse> Options);
    protected sealed record AddedOptionResponse(
        Guid ChallengeId,
        Guid Id,
        string Text,
        int SortOrder,
        bool IsCorrect,
        string? MatchingIconKey);
    protected sealed record ChallengeEnvelope(AdminChallengeBody Challenge);
    protected sealed record AdminChallengeBody(Guid Id, string? ImagePath, int TimeLimitSeconds);
    protected sealed record AdminGameResponse(
        Guid Id,
        string Type,
        string Title,
        string Summary,
        bool IsActive,
        int SortOrder,
        int DefaultTimeLimitSeconds,
        string SuccessMessage,
        bool SupportsChallengeImages,
        bool AllowsChallengeImageUploads,
        bool RequiresChallengeImages,
        bool SupportsChallengeActivation,
        List<AdminChallengeResponse> Challenges);
    protected sealed record AdminChallengeResponse(
        Guid Id,
        string Prompt,
        string? ImagePath,
        bool IsEnabled,
        int SortOrder,
        int? TimeLimitSeconds,
        List<AdminOptionResponse> Options);
    protected sealed record AdminOptionResponse(
        Guid Id,
        string Text,
        int SortOrder,
        bool IsCorrect,
        string? SortingCategory,
        string? MatchingIconKey);

    public void Dispose()
    {
        Client.Dispose();
        GC.SuppressFinalize(this);
    }
}

