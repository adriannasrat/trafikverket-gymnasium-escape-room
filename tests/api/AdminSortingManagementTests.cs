using System.Net;
using System.Net.Http.Json;

namespace EscapeRoom.Api.Tests;

public sealed class AdminSortingManagementTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AdminCanAddAndRemoveASortingRound()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
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
        var addResponse = await Client.SendAsync(addRequest);
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
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var updatedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        Assert.Equal(
            initialCount,
            updatedGames!.Single(candidate => candidate.Id == sortingGame.Id).Challenges.Count);
    }

    [Fact]
    public async Task AdminCanAddAndRemoveAnIndividualSortingCard()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var sortingRound = Assert.Single(
            games!.Single(candidate => candidate.Type == "Sorting").Challenges);
        var initialCount = sortingRound.Options.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{sortingRound.Id}/sorting-cards");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await Client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminOptionResponse>();
        Assert.NotNull(added);
        Assert.Equal("Nytt kort", added.Text);
        Assert.Equal(initialCount + 1, added.SortOrder);
        Assert.Null(added.SortingCategory);

        var gamesAfterAdd = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var roundAfterAdd = Assert.Single(
            gamesAfterAdd!.Single(candidate => candidate.Type == "Sorting").Challenges);
        Assert.Equal(initialCount + 1, roundAfterAdd.Options.Count);

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{sortingRound.Id}/sorting-cards/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var gamesAfterDelete = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var roundAfterDelete = Assert.Single(
            gamesAfterDelete!.Single(candidate => candidate.Type == "Sorting").Challenges);
        Assert.Equal(initialCount, roundAfterDelete.Options.Count);
        Assert.Equal(
            Enumerable.Range(1, initialCount),
            roundAfterDelete.Options.OrderBy(option => option.SortOrder).Select(option => option.SortOrder));
    }

}

