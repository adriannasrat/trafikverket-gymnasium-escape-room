using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EscapeRoom.Api.Domain;
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
        var game = initialGames!.Single(candidate => candidate.Type == "Quiz");
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
        var storedImageResponse = await client.GetAsync(uploaded!.ImagePath);
        Assert.Equal(HttpStatusCode.OK, storedImageResponse.StatusCode);
        Assert.Equal("image/png", storedImageResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal(
            [137, 80, 78, 71, 13, 10, 26, 10],
            await storedImageResponse.Content.ReadAsByteArrayAsync());

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

        var pausedBefore = await client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        await Task.Delay(100);
        var pausedAfter = await client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.InRange(
            Math.Abs(pausedAfter!.ElapsedMilliseconds - pausedBefore!.ElapsedMilliseconds),
            0,
            10);

        var nextResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, nextResponse.StatusCode);

        await using (var pauseScope = factory.Services.CreateAsyncScope())
        {
            var pausedSession = await pauseScope.ServiceProvider
                .GetRequiredService<AppDbContext>()
                .GameSessions
                .SingleAsync(candidate => candidate.Id == session.Id);
            Assert.Null(pausedSession.PausedAtUtc);
            Assert.True(pausedSession.TotalPausedMilliseconds >= 100);
        }

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
        Assert.Equal(
            initialChallengeCount,
            updatedGames!.Single(candidate => candidate.Id == game.Id).Challenges.Count);
        var completedSession = await client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.Equal("InProgress", completedSession?.Status);

        await using var scope = factory.Services.CreateAsyncScope();
        var deletedChallenge = await scope.ServiceProvider
            .GetRequiredService<AppDbContext>()
            .Challenges
            .SingleAsync(challenge => challenge.Id == created.Id);
        Assert.False(deletedChallenge.IsActive);
        Assert.NotNull(deletedChallenge.ImagePath);
    }

    [Fact]
    public async Task ChallengeImagesAreAvailableOnlyForSupportedGameTypes()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
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

            var response = await client.SendAsync(uploadRequest);
            Assert.Equal(
                expectedSupport ? HttpStatusCode.OK : HttpStatusCode.BadRequest,
                response.StatusCode);
        }
    }

    [Fact]
    public async Task HostedDemoKeepsPixelImagesButRejectsImageChanges()
    {
        using var hostedFactory = factory.WithWebHostBuilder(builder =>
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

    [Fact]
    public async Task AdminCanDisableSupportedQuestionsWithoutRemovingThemFromAdmin()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.NotNull(games);

        var supportedTypes = new HashSet<string>
        {
            "Quiz", "TrueFalse", "PixelHunt", "WordAssembly"
        };
        Assert.All(
            games,
            game => Assert.Equal(
                supportedTypes.Contains(game.Type),
                game.SupportsChallengeActivation));

        var sorting = games.Single(candidate => candidate.Type == "Sorting");
        var unsupportedResponse = await UpdateChallengeAvailabilityAsync(
            sorting,
            sorting.Challenges[0].Id,
            false);
        Assert.Equal(HttpStatusCode.BadRequest, unsupportedResponse.StatusCode);

        var quiz = games.Single(candidate => candidate.Type == "Quiz");
        Assert.Equal("Uppdraget", quiz.Title);
        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{quiz.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(added);

        games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        quiz = games!.Single(candidate => candidate.Id == quiz.Id);
        var disabledId = quiz.Challenges.OrderBy(challenge => challenge.SortOrder).First().Id;

        var disableResponse = await UpdateChallengeAvailabilityAsync(quiz, disabledId, false);
        Assert.Equal(HttpStatusCode.OK, disableResponse.StatusCode);
        var updatedQuiz = await disableResponse.Content.ReadFromJsonAsync<AdminGameResponse>();
        Assert.NotNull(updatedQuiz);
        Assert.False(updatedQuiz.Challenges.Single(challenge => challenge.Id == disabledId).IsEnabled);

        var adminGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Contains(
            adminGames!.Single(game => game.Id == quiz.Id).Challenges,
            challenge => challenge.Id == disabledId && !challenge.IsEnabled);

        var disableLastResponse = await UpdateChallengeAvailabilityAsync(
            updatedQuiz,
            added.Id,
            false);
        Assert.Equal(HttpStatusCode.BadRequest, disableLastResponse.StatusCode);

        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Aktiveringstest" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        var current = await client.GetFromJsonAsync<ChallengeEnvelope>(
            $"/api/sessions/{session!.Id}/current-challenge");
        Assert.NotEqual(disabledId, current!.Challenge.Id);

        var enableResponse = await UpdateChallengeAvailabilityAsync(updatedQuiz, disabledId, true);
        Assert.Equal(HttpStatusCode.OK, enableResponse.StatusCode);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveAMatchingDestination()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var matchingGame = games!.Single(candidate => candidate.Type == "Matching");
        var originalDestinationCount = matchingGame.Challenges[0].Options.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{matchingGame.Id}/matching-destinations");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AddedOptionsResponse>();
        Assert.NotNull(added);
        Assert.Equal(matchingGame.Challenges.Count, added.Options.Count);
        Assert.All(added.Options, option => Assert.False(option.IsCorrect));
        Assert.All(added.Options, option => Assert.Equal("map-pin", option.MatchingIconKey));

        var sortOrder = Assert.Single(added.Options.Select(option => option.SortOrder).Distinct());
        using var addScenarioRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{matchingGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addScenarioRequest);
        var addScenarioResponse = await client.SendAsync(addScenarioRequest);
        Assert.Equal(HttpStatusCode.Created, addScenarioResponse.StatusCode);
        var addedScenario = await addScenarioResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(addedScenario);
        Assert.Equal(sortOrder, Assert.Single(addedScenario.Options, option => option.IsCorrect).SortOrder);

        using var deleteScenarioRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{addedScenario.Id}");
        await AddAntiforgeryTokenAsync(deleteScenarioRequest);
        var deleteScenarioResponse = await client.SendAsync(deleteScenarioRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteScenarioResponse.StatusCode);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/games/{matchingGame.Id}/matching-destinations/{sortOrder}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var updatedMatchingGame = updatedGames!.Single(candidate => candidate.Id == matchingGame.Id);
        Assert.All(
            updatedMatchingGame.Challenges,
            challenge => Assert.Equal(originalDestinationCount, challenge.Options.Count));
    }

    [Fact]
    public async Task AdminCanReorderMatchingScenarios()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var matchingGame = games!.Single(candidate => candidate.Type == "Matching");
        var ordered = matchingGame.Challenges.OrderBy(challenge => challenge.SortOrder).ToList();
        var first = ordered[0];
        var second = ordered[1];

        using var updateRequest = new HttpRequestMessage(
            HttpMethod.Put,
            $"/api/admin/games/{matchingGame.Id}")
        {
            Content = JsonContent.Create(new
            {
                matchingGame.Title,
                matchingGame.Summary,
                matchingGame.IsActive,
                matchingGame.DefaultTimeLimitSeconds,
                matchingGame.SuccessMessage,
                challenges = matchingGame.Challenges.Select(challenge => new
                {
                    challenge.Id,
                    challenge.Prompt,
                    sortOrder = challenge.Id == first.Id
                        ? second.SortOrder
                        : challenge.Id == second.Id
                            ? first.SortOrder
                            : challenge.SortOrder,
                    challenge.TimeLimitSeconds,
                    challenge.Options
                })
            })
        };
        await AddAntiforgeryTokenAsync(updateRequest);
        var updateResponse = await client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updatedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var updatedMatchingGame = updatedGames!.Single(candidate => candidate.Id == matchingGame.Id);
        Assert.Equal(second.Id, updatedMatchingGame.Challenges.OrderBy(challenge => challenge.SortOrder).First().Id);
        Assert.Equal(first.Id, updatedMatchingGame.Challenges.OrderBy(challenge => challenge.SortOrder).Skip(1).First().Id);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveATrueFalseStatement()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var trueFalseGame = games!.Single(candidate => candidate.Type == "TrueFalse");
        var initialCount = trueFalseGame.Challenges.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{trueFalseGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);

        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(added);
        Assert.Equal(["Sant", "Falskt"], added.Options.Select(option => option.Text));
        Assert.Single(added.Options, option => option.IsCorrect);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialCount,
            updatedGames!.Single(candidate => candidate.Id == trueFalseGame.Id).Challenges.Count);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveAPixelImageQuestion()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var pixelGame = games!.Single(candidate => candidate.Type == "PixelHunt");
        var initialCount = pixelGame.Challenges.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{pixelGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(added);
        Assert.Equal(4, added.Options.Count);
        Assert.Single(added.Options, option => option.IsCorrect);
        Assert.NotNull(added.ImagePath);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialCount,
            updatedGames!.Single(candidate => candidate.Id == pixelGame.Id).Challenges.Count);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveASortingRound()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var sortingGame = games!.Single(candidate => candidate.Type == "Sorting");
        var initialCount = sortingGame.Challenges.Count;
        var seededRound = Assert.Single(sortingGame.Challenges);
        Assert.Equal(12, seededRound.Options.Count);
        Assert.Equal(3, seededRound.Options.Count(option => option.SortingCategory is null));
        Assert.Equal(3, seededRound.Options
            .Select(option => option.SortingCategory)
            .Where(category => category is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count());

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{sortingGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(added);
        Assert.Equal(5, added.Options.Count);
        Assert.Equal(2, added.Options
            .Select(option => option.SortingCategory)
            .Where(category => category is not null)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count());

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialCount,
            updatedGames!.Single(candidate => candidate.Id == sortingGame.Id).Challenges.Count);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveAnIndividualSortingCard()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var sortingRound = Assert.Single(
            games!.Single(candidate => candidate.Type == "Sorting").Challenges);
        var initialCount = sortingRound.Options.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{sortingRound.Id}/sorting-cards");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminOptionResponse>();
        Assert.NotNull(added);
        Assert.Equal("Nytt kort", added.Text);
        Assert.Equal(initialCount + 1, added.SortOrder);
        Assert.Null(added.SortingCategory);

        var gamesAfterAdd = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var roundAfterAdd = Assert.Single(
            gamesAfterAdd!.Single(candidate => candidate.Type == "Sorting").Challenges);
        Assert.Equal(initialCount + 1, roundAfterAdd.Options.Count);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{sortingRound.Id}/sorting-cards/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var gamesAfterDelete = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var roundAfterDelete = Assert.Single(
            gamesAfterDelete!.Single(candidate => candidate.Type == "Sorting").Challenges);
        Assert.Equal(initialCount, roundAfterDelete.Options.Count);
        Assert.Equal(
            Enumerable.Range(1, initialCount),
            roundAfterDelete.Options.OrderBy(option => option.SortOrder).Select(option => option.SortOrder));
    }

    [Fact]
    public async Task AdminCanAddReorderAndRemoveAWordPart()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var wordGame = games!.Single(candidate => candidate.Type == "WordAssembly");
        var challenge = wordGame.Challenges.OrderBy(candidate => candidate.SortOrder).First();
        var initialCount = challenge.Options.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{challenge.Id}/word-parts");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminOptionResponse>();
        Assert.NotNull(added);
        Assert.Equal(initialCount + 1, added.SortOrder);

        var gamesAfterAdd = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var updatedGame = gamesAfterAdd!.Single(candidate => candidate.Id == wordGame.Id);
        var updatedChallenge = updatedGame.Challenges.Single(candidate => candidate.Id == challenge.Id);
        var reorderedIds = updatedChallenge.Options
            .OrderByDescending(option => option.SortOrder)
            .Select(option => option.Id)
            .ToList();

        using var updateRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/games/{wordGame.Id}")
        {
            Content = JsonContent.Create(new
            {
                updatedGame.Title,
                updatedGame.Summary,
                updatedGame.IsActive,
                updatedGame.DefaultTimeLimitSeconds,
                updatedGame.SuccessMessage,
                challenges = updatedGame.Challenges.Select(item => new
                {
                    item.Id,
                    item.Prompt,
                    item.SortOrder,
                    item.TimeLimitSeconds,
                    options = item.Options.Select(option => new
                    {
                        option.Id,
                        option.Text,
                        sortOrder = item.Id == challenge.Id
                            ? reorderedIds.IndexOf(option.Id) + 1
                            : option.SortOrder,
                        option.IsCorrect,
                        option.SortingCategory,
                        option.MatchingIconKey
                    })
                })
            })
        };
        await AddAntiforgeryTokenAsync(updateRequest);
        var updateResponse = await client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var reorderedGames = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var reorderedChallenge = reorderedGames!
            .Single(candidate => candidate.Id == wordGame.Id)
            .Challenges.Single(candidate => candidate.Id == challenge.Id);
        Assert.Equal(reorderedIds, reorderedChallenge.Options.OrderBy(option => option.SortOrder).Select(option => option.Id));

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{challenge.Id}/word-parts/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var gamesAfterDelete = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var finalChallenge = gamesAfterDelete!
            .Single(candidate => candidate.Id == wordGame.Id)
            .Challenges.Single(candidate => candidate.Id == challenge.Id);
        Assert.Equal(initialCount, finalChallenge.Options.Count);
        Assert.Equal(
            Enumerable.Range(1, initialCount),
            finalChallenge.Options.OrderBy(option => option.SortOrder).Select(option => option.SortOrder));
    }

    [Fact]
    public async Task AdminTimeLimitAppliesToEveryChallengeAcrossAllGameTypes()
    {
        await LoginAsync();
        var games = await client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
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

            var updateResponse = await client.SendAsync(updateRequest);
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            var updatedGame = await updateResponse.Content.ReadFromJsonAsync<AdminGameResponse>();
            Assert.NotNull(updatedGame);
            Assert.Equal(expectedLimit, updatedGame.DefaultTimeLimitSeconds);
            Assert.All(updatedGame.Challenges, challenge => Assert.Null(challenge.TimeLimitSeconds));
        }

        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Tidstestaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        await using var scope = factory.Services.CreateAsyncScope();
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

            var current = await client.GetFromJsonAsync<ChallengeEnvelope>(
                $"/api/sessions/{session.Id}/current-challenge");
            Assert.NotNull(current);
            Assert.Equal(expectedLimit, current.Challenge.TimeLimitSeconds);

            if (game.Type == GameType.Sorting)
            {
                persistedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow.AddSeconds(-70);
                await db.SaveChangesAsync();

                var sortingResponse = await client.PostAsJsonAsync(
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

    private Task LoginAsync() => LoginAsync(client);

    private static async Task LoginAsync(HttpClient targetClient)
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

    private async Task<HttpResponseMessage> UpdateChallengeAvailabilityAsync(
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
        return await client.SendAsync(request);
    }

    private Task AddAntiforgeryTokenAsync(HttpRequestMessage request) =>
        AddAntiforgeryTokenAsync(request, client);

    private static async Task AddAntiforgeryTokenAsync(
        HttpRequestMessage request,
        HttpClient targetClient)
    {
        var antiforgery = await targetClient.GetFromJsonAsync<AntiforgeryResponse>("/api/auth/csrf");
        Assert.NotNull(antiforgery);
        request.Headers.Add("X-CSRF-TOKEN", antiforgery.Token);
    }

    private sealed record AntiforgeryResponse(string Token);
    private sealed record AuthStatusResponse(bool Authenticated);
    private sealed record ImageResponse(string ImagePath);
    private sealed record SessionResponse(Guid Id);
    private sealed record SessionStatusResponse(string Status, long ElapsedMilliseconds);
    private sealed record SortingTimerResponse(
        bool Expired,
        int TimeLimitSeconds,
        double SecondsRemaining);
    private sealed record AddedOptionsResponse(List<AddedOptionResponse> Options);
    private sealed record AddedOptionResponse(
        Guid ChallengeId,
        Guid Id,
        string Text,
        int SortOrder,
        bool IsCorrect,
        string? MatchingIconKey);
    private sealed record ChallengeEnvelope(AdminChallengeBody Challenge);
    private sealed record AdminChallengeBody(Guid Id, string? ImagePath, int TimeLimitSeconds);
    private sealed record AdminGameResponse(
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
    private sealed record AdminChallengeResponse(
        Guid Id,
        string Prompt,
        string? ImagePath,
        bool IsEnabled,
        int SortOrder,
        int? TimeLimitSeconds,
        List<AdminOptionResponse> Options);
    private sealed record AdminOptionResponse(
        Guid Id,
        string Text,
        int SortOrder,
        bool IsCorrect,
        string? SortingCategory,
        string? MatchingIconKey);
}
