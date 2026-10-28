using System.Net;
using System.Net.Http.Json;

namespace EscapeRoom.Api.Tests;

public sealed class AdminWordAssemblyManagementTests(ApiFactory factory)
    : AdminApiTestBase(factory), IClassFixture<ApiFactory>
{
    [Fact]
    public async Task AdminCanAddReorderAndRemoveAWordPart()
    {
        await LoginAsync();
        var games = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var wordGame = games!.Single(candidate => candidate.Type == "WordAssembly");
        var challenge = wordGame.Challenges.OrderBy(candidate => candidate.SortOrder).First();
        var initialCount = challenge.Options.Count;

        using var addRequest = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/admin/challenges/{challenge.Id}/word-parts");
        await AddAntiforgeryTokenAsync(addRequest);
        var addResponse = await Client.SendAsync(addRequest);
        Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        var added = await addResponse.Content.ReadFromJsonAsync<AdminOptionResponse>();
        Assert.NotNull(added);
        Assert.Equal(initialCount + 1, added.SortOrder);

        var gamesAfterAdd = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
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
        var updateResponse = await Client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var reorderedGames = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var reorderedChallenge = reorderedGames!
            .Single(candidate => candidate.Id == wordGame.Id)
            .Challenges.Single(candidate => candidate.Id == challenge.Id);
        Assert.Equal(reorderedIds, reorderedChallenge.Options.OrderBy(option => option.SortOrder).Select(option => option.Id));

        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/admin/challenges/{challenge.Id}/word-parts/{added.Id}");
        await AddAntiforgeryTokenAsync(deleteRequest);
        var deleteResponse = await Client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var gamesAfterDelete = await Client.GetFromJsonAsync<List<AdminGameResponse>>("/api/admin/games");
        var finalChallenge = gamesAfterDelete!
            .Single(candidate => candidate.Id == wordGame.Id)
            .Challenges.Single(candidate => candidate.Id == challenge.Id);
        Assert.Equal(initialCount, finalChallenge.Options.Count);
        Assert.Equal(
            Enumerable.Range(1, initialCount),
            finalChallenge.Options.OrderBy(option => option.SortOrder).Select(option => option.SortOrder));
    }

}

