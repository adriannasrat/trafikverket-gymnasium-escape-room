using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;

namespace EscapeRoom.Api.Tests;

public sealed class AdminImageManagementTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ReplacingAndRemovingAnImageDeletesOnlyTheUnreferencedFile()
    {
        using var isolatedFactory = new ApiFactory();
        using var isolatedClient = isolatedFactory.CreateClient();
        await LoginAsync(isolatedClient);
        var games = await isolatedClient.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var challenge = games!.Single(game => game.Type == "Quiz").Challenges[0];

        var first = await UploadImageAsync(isolatedClient, challenge.Id, [
            137, 80, 78, 71, 13, 10, 26, 10, 1
        ]);
        Assert.Equal(HttpStatusCode.OK, (await isolatedClient.GetAsync(first.ImagePath)).StatusCode);

        var second = await UploadImageAsync(isolatedClient, challenge.Id, [
            137, 80, 78, 71, 13, 10, 26, 10, 2
        ]);
        Assert.NotEqual(first.ImagePath, second.ImagePath);
        Assert.Equal(HttpStatusCode.NotFound, (await isolatedClient.GetAsync(first.ImagePath)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await isolatedClient.GetAsync(second.ImagePath)).StatusCode);

        using var removeRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{challenge.Id}/image");
        await AddAntiforgeryTokenAsync(removeRequest, isolatedClient);
        var removeResponse = await isolatedClient.SendAsync(removeRequest);
        Assert.Equal(HttpStatusCode.OK, removeResponse.StatusCode);
        var removed = await removeResponse.Content.ReadFromJsonAsync<ImageMutationResponse>();
        Assert.Null(removed?.ImagePath);
        Assert.True(removed?.IsEnabled);
        Assert.Equal(HttpStatusCode.NotFound, (await isolatedClient.GetAsync(second.ImagePath)).StatusCode);
    }

    [Fact]
    public async Task ReplacingASharedImageKeepsItUntilTheLastReferenceIsRemoved()
    {
        using var isolatedFactory = new ApiFactory();
        using var isolatedClient = isolatedFactory.CreateClient();
        await LoginAsync(isolatedClient);
        var games = await isolatedClient.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var pixelGame = games!.Single(game => game.Type == "PixelHunt");
        var originalChallenge = pixelGame.Challenges[0];
        var shared = await UploadImageAsync(isolatedClient, originalChallenge.Id, [
            137, 80, 78, 71, 13, 10, 26, 10, 3
        ]);

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{pixelGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest, isolatedClient);
        var addResponse = await isolatedClient.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.Equal(shared.ImagePath, added?.ImagePath);

        var replacement = await UploadImageAsync(isolatedClient, originalChallenge.Id, [
            137, 80, 78, 71, 13, 10, 26, 10, 4
        ]);
        Assert.Equal(HttpStatusCode.OK, (await isolatedClient.GetAsync(shared.ImagePath)).StatusCode);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added!.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest, isolatedClient);
        Assert.Equal(HttpStatusCode.NoContent, (await isolatedClient.SendAsync(deleteRequest)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await isolatedClient.GetAsync(shared.ImagePath)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await isolatedClient.GetAsync(replacement.ImagePath)).StatusCode);
    }

    [Fact]
    public async Task ImageCleanupPreviewsBeforeDeletingAndNeverDeletesReferencedFiles()
    {
        using var isolatedFactory = new ApiFactory();
        using var isolatedClient = isolatedFactory.CreateClient();
        await LoginAsync(isolatedClient);
        var games = await isolatedClient.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var challenge = games!.Single(game => game.Type == "Quiz").Challenges[0];
        var referenced = await UploadImageAsync(isolatedClient, challenge.Id, [
            137, 80, 78, 71, 13, 10, 26, 10, 5
        ]);

        Directory.CreateDirectory(isolatedFactory.UploadsPath);
        var orphanName = $"{Guid.NewGuid():N}.png";
        var orphanPath = Path.Combine(isolatedFactory.UploadsPath, orphanName);
        await File.WriteAllBytesAsync(orphanPath, [137, 80, 78, 71, 13, 10, 26, 10, 6]);
        var unmanagedPath = Path.Combine(isolatedFactory.UploadsPath, "manual-file.png");
        await File.WriteAllBytesAsync(unmanagedPath, [1, 2, 3]);

        var preview = await isolatedClient.GetFromJsonAsync<ImageCleanupResponse>(
            "/api/admin/images/unused");
        Assert.NotNull(preview);
        Assert.True(preview.DryRun);
        Assert.Equal(1, preview.CandidateCount);
        Assert.Equal($"/uploads/{orphanName}", Assert.Single(preview.Files).ImagePath);
        Assert.True(File.Exists(orphanPath));
        Assert.True(File.Exists(Path.Combine(
            isolatedFactory.UploadsPath,
            Path.GetFileName(referenced.ImagePath))));

        using var cleanupRequest = new HttpRequestMessage(HttpMethod.Post, "/api/admin/images/cleanup");
        await AddAntiforgeryTokenAsync(cleanupRequest, isolatedClient);
        var cleanupResponse = await isolatedClient.SendAsync(cleanupRequest);
        Assert.Equal(HttpStatusCode.OK, cleanupResponse.StatusCode);
        var cleaned = await cleanupResponse.Content.ReadFromJsonAsync<ImageCleanupResponse>();
        Assert.False(cleaned?.DryRun);
        Assert.Equal(1, cleaned?.DeletedCount);
        Assert.False(File.Exists(orphanPath));
        Assert.True(File.Exists(unmanagedPath));
        Assert.Equal(HttpStatusCode.OK, (await isolatedClient.GetAsync(referenced.ImagePath)).StatusCode);
    }

    [Fact]
    public async Task ChallengeImagesAreAvailableOnlyForSupportedGameTypes()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.NotNull(games);

        var supportedTypes = new HashSet<string>
        {
            "Quiz", "Matching", "PixelHunt", "Hangman"
        };

        foreach (var game in games)
        {
            var expectedSupport = supportedTypes.Contains(game.Type);
            Assert.Equal(expectedSupport, game.SupportsChallengeImages);
            Assert.Equal(expectedSupport, game.AllowsChallengeImageUploads);
            Assert.Equal(game.Type == "PixelHunt", game.RequiresChallengeImages);

            var challenge = game.Challenges.OrderBy(candidate => candidate.SortOrder).First();
            using var image = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]);
            // Deliberately use a generic browser content type. The server should
            // inspect the file itself instead of trusting this header.
            image.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            using var form = new MultipartFormDataContent();
            form.Add(image, "image", "skylt.bin");
            using var uploadRequest = new HttpRequestMessage(
                HttpMethod.Post,
                $"/api/admin/challenges/{challenge.Id}/image")
            {
                Content = form
            };
            await AddAntiforgeryTokenAsync(uploadRequest);

            var response = await Client.SendAsync(uploadRequest);
            Assert.Equal(
                expectedSupport ? HttpStatusCode.OK : HttpStatusCode.BadRequest,
                response.StatusCode);
        }
    }

    [Fact]
    public async Task HostedDemoKeepsPixelImagesButRejectsImageChanges()
    {
        using var hostedFactory = Factory.WithWebHostBuilder(builder =>
            builder.UseSetting("Features:ChallengeImageUploads", "false"));
        using var hostedClient = hostedFactory.CreateClient();
        await LoginAsync(hostedClient);

        var games = await hostedClient.GetFromJsonAsync<List<AdminGameResponse>>(
            "/api/admin/games");
        Assert.NotNull(games);
        Assert.All(games, game => Assert.False(game.AllowsChallengeImageUploads));

        var pixelGame = games.Single(game => game.Type == "PixelHunt");
        Assert.True(pixelGame.IsActive);
        Assert.Equal(4, pixelGame.Challenges.Count);
        Assert.Equal(
            "/assets/images/pixel/roundabout.jpg",
            pixelGame.Challenges.Single(challenge =>
                challenge.Prompt == "Vad visar bilden?").ImagePath);

        var challenge = pixelGame.Challenges[0];
        using var image = new ByteArrayContent([137, 80, 78, 71, 13, 10, 26, 10]);
        using var form = new MultipartFormDataContent();
        form.Add(image, "image", "skylt.png");
        using var uploadRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{challenge.Id}/image")
        {
            Content = form
        };
        await AddAntiforgeryTokenAsync(uploadRequest, hostedClient);
        var uploadResponse = await hostedClient.SendAsync(uploadRequest);
        Assert.Equal(HttpStatusCode.Conflict, uploadResponse.StatusCode);

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{pixelGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest, hostedClient);
        var addResponse = await hostedClient.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Conflict, addResponse.StatusCode);
    }

}

