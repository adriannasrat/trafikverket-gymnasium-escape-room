using System.Net;
using System.Net.Http.Json;

namespace EscapeRoom.Api.Tests;

public sealed class AdminChallengeAvailabilityTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AdminCanDisableSupportedQuestionsWithoutRemovingThemFromAdmin()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
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
        var addResponse = await Client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(added);

        games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        quiz = games!.Single(candidate => candidate.Id == quiz.Id);
        var disabledId = quiz.Challenges.OrderBy(challenge => challenge.SortOrder).First().Id;

        var disableResponse = await UpdateChallengeAvailabilityAsync(quiz, disabledId, false);
        Assert.Equal(HttpStatusCode.OK, disableResponse.StatusCode);
        var updatedQuiz = await disableResponse.Content.ReadFromJsonAsync<AdminGameResponse>();
        Assert.NotNull(updatedQuiz);
        Assert.False(updatedQuiz.Challenges.Single(challenge => challenge.Id == disabledId).IsEnabled);

        var adminGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Contains(
            adminGames!.Single(game => game.Id == quiz.Id).Challenges,
            challenge => challenge.Id == disabledId && !challenge.IsEnabled);

        var disableLastResponse = await UpdateChallengeAvailabilityAsync(
            updatedQuiz,
            added.Id,
            false);
        Assert.Equal(HttpStatusCode.BadRequest, disableLastResponse.StatusCode);

        var started = await Client.PostAsJsonAsync("/api/sessions/", new { playerName = "Aktiveringstest" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        var current = await Client.GetFromJsonAsync<ChallengeEnvelope>(
            $"/api/sessions/{session!.Id}/current-challenge");
        Assert.NotEqual(disabledId, current!.Challenge.Id);

        var enableResponse = await UpdateChallengeAvailabilityAsync(updatedQuiz, disabledId, true);
        Assert.Equal(HttpStatusCode.OK, enableResponse.StatusCode);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }


    [Fact]
    public async Task AdminCanAddAndRemoveATrueFalseStatement()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var trueFalseGame = games!.Single(candidate => candidate.Type == "TrueFalse");
        var initialCount = trueFalseGame.Challenges.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{trueFalseGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await Client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);

        var added = await addResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(added);
        Assert.Equal(["Sant", "Falskt"], added.Options.Select(option => option.Text));
        Assert.Single(added.Options, option => option.IsCorrect);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialCount,
            updatedGames!.Single(candidate => candidate.Id == trueFalseGame.Id).Challenges.Count);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveAPixelImageQuestion()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var pixelGame = games!.Single(candidate => candidate.Type == "PixelHunt");
        var initialCount = pixelGame.Challenges.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{pixelGame.Id}/challenges");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await Client.SendAsync(addRequest);
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
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialCount,
            updatedGames!.Single(candidate => candidate.Id == pixelGame.Id).Challenges.Count);
    }

}

