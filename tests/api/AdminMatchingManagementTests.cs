using System.Net;
using System.Net.Http.Json;

namespace EscapeRoom.Api.Tests;

public sealed class AdminMatchingManagementTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AdminCanAddAndRemoveAMatchingDestination()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var matchingGame = games!.Single(candidate => candidate.Type == "Matching");
        var originalDestinationCount = matchingGame.Challenges[0].Options.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/games/{matchingGame.Id}/matching-destinations");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await Client.SendAsync(addRequest);
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
        var addScenarioResponse = await Client.SendAsync(addScenarioRequest);
        Assert.Equal(HttpStatusCode.Created, addScenarioResponse.StatusCode);
        var addedScenario = await addScenarioResponse.Content.ReadFromJsonAsync<AdminChallengeResponse>();
        Assert.NotNull(addedScenario);
        Assert.Equal(sortOrder, Assert.Single(addedScenario.Options, option => option.IsCorrect).SortOrder);

        using var deleteScenarioRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{addedScenario.Id}");
        await AddAntiforgeryTokenAsync(deleteScenarioRequest);
        var deleteScenarioResponse = await Client.SendAsync(deleteScenarioRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteScenarioResponse.StatusCode);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/games/{matchingGame.Id}/matching-destinations/{sortOrder}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var updatedMatchingGame = updatedGames!.Single(candidate => candidate.Id == matchingGame.Id);
        Assert.All(
            updatedMatchingGame.Challenges,
            challenge => Assert.Equal(originalDestinationCount, challenge.Options.Count));
    }

    [Fact]
    public async Task AdminCanReorderMatchingScenarios()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
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
        var updateResponse = await Client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updatedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var updatedMatchingGame = updatedGames!.Single(candidate => candidate.Id == matchingGame.Id);
        Assert.Equal(second.Id, updatedMatchingGame.Challenges.OrderBy(challenge => challenge.SortOrder).First().Id);
        Assert.Equal(first.Id, updatedMatchingGame.Challenges.OrderBy(challenge => challenge.SortOrder).Skip(1).First().Id);
    }

}

