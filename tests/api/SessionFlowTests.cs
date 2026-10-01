using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class SessionFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task HealthEndpointIsAvailable()
    {
        var response = await client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PlayerCanCompleteActiveGameAndReachLeaderboard()
    {
        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Testspelaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var challenge = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(challenge);
        Assert.DoesNotContain(challenge.Challenge.Options, option => option.IsCorrect is not null);
        Assert.Equal(1, challenge.Challenge.Number);
        Assert.Equal(6, challenge.Challenge.Total);

        Guid correctOptionId;
        using (var scope = factory.Services.CreateScope())
        {
            correctOptionId = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option => option.ChallengeId == challenge.Challenge.Id && option.IsCorrect)
                .Select(option => option.Id)
                .SingleAsync();
        }

        var answer = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/answers",
            new { challengeId = challenge.Challenge.Id, optionId = correctOptionId });
        answer.EnsureSuccessStatusCode();
        var result = await answer.Content.ReadFromJsonAsync<AnswerResponse>();
        Assert.True(result?.Correct);
        Assert.False(result?.Completed);

        var nextResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, nextResponse.StatusCode);
        var matching = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(matching?.Matching);
        Assert.Equal("Matching", matching.Game.Type);
        Assert.Equal(3, matching.Matching.Scenarios.Count);
        Assert.All(matching.Matching.Destinations, destination => Assert.False(string.IsNullOrWhiteSpace(destination.IconKey)));

        var wrongSelections = matching.Matching.Scenarios
            .Select((scenario, index) =>
            {
                var wrongDestination = matching.Matching.Destinations[
                    (index + 1) % matching.Matching.Destinations.Count];
                var option = scenario.Options.Single(candidate => candidate.Text == wrongDestination.Text);
                return new MatchSelectionRequest(scenario.Id, option.Id);
            })
            .ToList();
        var wrongMatchResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/matches",
            new { challengeId = matching.Challenge.Id, selections = wrongSelections });
        wrongMatchResponse.EnsureSuccessStatusCode();
        var wrongMatchResult = await wrongMatchResponse.Content.ReadFromJsonAsync<MatchingAnswerResponse>();
        Assert.False(wrongMatchResult?.Correct);
        Assert.Equal(3, wrongMatchResult?.IncorrectChallengeIds.Count);

        List<MatchSelectionRequest> selections;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var scenarioIds = matching.Matching.Scenarios.Select(scenario => scenario.Id).ToList();
            selections = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option => scenarioIds.Contains(option.ChallengeId) && option.IsCorrect)
                .Select(option => new MatchSelectionRequest(option.ChallengeId, option.Id))
                .ToListAsync();
        }

        var matchResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/matches",
            new { challengeId = matching.Challenge.Id, selections });
        matchResponse.EnsureSuccessStatusCode();
        var matchResult = await matchResponse.Content.ReadFromJsonAsync<AnswerResponse>();
        Assert.True(matchResult?.Correct);
        Assert.False(matchResult?.Completed);

        var nextGameResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, nextGameResponse.StatusCode);

        var trueFalse = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(trueFalse);
        Assert.Equal("TrueFalse", trueFalse.Game.Type);
        Assert.Equal(3, trueFalse.Challenge.Number);
        Assert.Equal(["Sant", "Falskt"], trueFalse.Challenge.Options.Select(option => option.Text));

        for (var question = 0; question < 3; question++)
        {
            Guid trueFalseOptionId;
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                trueFalseOptionId = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                    .ChallengeOptions
                    .Where(option =>
                        option.ChallengeId == trueFalse.Challenge.Id && option.IsCorrect)
                    .Select(option => option.Id)
                    .SingleAsync();
            }

            var trueFalseAnswer = await client.PostAsJsonAsync(
                $"/api/sessions/{session.Id}/answers",
                new { challengeId = trueFalse.Challenge.Id, optionId = trueFalseOptionId });
            trueFalseAnswer.EnsureSuccessStatusCode();
            var trueFalseResult = await trueFalseAnswer.Content.ReadFromJsonAsync<AnswerResponse>();
            Assert.True(trueFalseResult?.Correct);
            Assert.False(trueFalseResult?.Completed);

            var advanceResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
            Assert.Equal(HttpStatusCode.NoContent, advanceResponse.StatusCode);
            if (question < 2)
            {
                trueFalse = await client.GetFromJsonAsync<ChallengeResponse>(
                    $"/api/sessions/{session.Id}/current-challenge");
                Assert.NotNull(trueFalse);
                Assert.Equal(question + 2, trueFalse.Challenge.QuestionNumber);
            }
        }

        var pixelHunt = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(pixelHunt);
        Assert.Equal("PixelHunt", pixelHunt.Game.Type);
        Assert.Equal(4, pixelHunt.Challenge.Number);
        Assert.Equal(3, pixelHunt.Challenge.QuestionTotal);
        Assert.Equal(0, pixelHunt.Challenge.PixelRevealCount);
        Assert.Equal(4, pixelHunt.Challenge.Options.Count);

        for (var question = 0; question < 3; question++)
        {
            Guid pixelOptionId;
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                pixelOptionId = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                    .ChallengeOptions
                    .Where(option => option.ChallengeId == pixelHunt.Challenge.Id && option.IsCorrect)
                    .Select(option => option.Id)
                    .SingleAsync();
            }

            var pixelAnswer = await client.PostAsJsonAsync(
                $"/api/sessions/{session.Id}/answers",
                new { challengeId = pixelHunt.Challenge.Id, optionId = pixelOptionId });
            pixelAnswer.EnsureSuccessStatusCode();
            var pixelResult = await pixelAnswer.Content.ReadFromJsonAsync<AnswerResponse>();
            Assert.True(pixelResult?.Correct);
            Assert.False(pixelResult?.Completed);

            var advanceResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
            Assert.Equal(HttpStatusCode.NoContent, advanceResponse.StatusCode);
            if (question < 2)
            {
                pixelHunt = await client.GetFromJsonAsync<ChallengeResponse>(
                    $"/api/sessions/{session.Id}/current-challenge");
                Assert.NotNull(pixelHunt);
                Assert.Equal(question + 2, pixelHunt.Challenge.QuestionNumber);
                Assert.Equal(4, pixelHunt.Challenge.Options.Count);
            }
        }

        var sorting = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(sorting?.Sorting);
        Assert.Equal("Sorting", sorting.Game.Type);
        Assert.Equal(5, sorting.Challenge.Number);
        Assert.Equal(12, sorting.Sorting.Cards.Count);
        Assert.Equal(3, sorting.Sorting.Categories.Count);

        var wrongSortingResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/sorting",
            new
            {
                challengeId = sorting.Challenge.Id,
                placements = sorting.Sorting.Cards.Select(card => new { optionId = card.Id, category = (string?)null })
            });
        wrongSortingResponse.EnsureSuccessStatusCode();
        var wrongSortingResult = await wrongSortingResponse.Content.ReadFromJsonAsync<SortingAnswerResponse>();
        Assert.False(wrongSortingResult?.Correct);
        Assert.False(wrongSortingResult?.Expired);
        Assert.Equal(9, wrongSortingResult?.IncorrectOptionIds.Count);
        Assert.Equal(10_000, wrongSortingResult?.CurrentChallengePenaltyMilliseconds);
        Assert.True(wrongSortingResult?.ElapsedMilliseconds >= 10_000);

        List<SortingPlacementRequest> sortingPlacements;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            sortingPlacements = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option => option.ChallengeId == sorting.Challenge.Id)
                .OrderBy(option => option.SortOrder)
                .Select(option => new SortingPlacementRequest(option.Id, option.SortingCategory))
                .ToListAsync();
        }

        var sortingResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/sorting",
            new { challengeId = sorting.Challenge.Id, placements = sortingPlacements });
        sortingResponse.EnsureSuccessStatusCode();
        var sortingResult = await sortingResponse.Content.ReadFromJsonAsync<SortingAnswerResponse>();
        Assert.True(sortingResult?.Correct);
        Assert.Empty(sortingResult!.IncorrectOptionIds);

        var wordGameResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
        Assert.Equal(HttpStatusCode.NoContent, wordGameResponse.StatusCode);

        var wordAssembly = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(wordAssembly?.WordAssembly);
        Assert.Equal("WordAssembly", wordAssembly.Game.Type);
        Assert.Equal(6, wordAssembly.Challenge.Number);
        Assert.Equal(4, wordAssembly.Challenge.QuestionTotal);
        Assert.Equal(3, wordAssembly.WordAssembly.Parts.Count);

        List<Guid> firstCorrectWordOrder;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            firstCorrectWordOrder = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                .ChallengeOptions
                .Where(option => option.ChallengeId == wordAssembly.Challenge.Id)
                .OrderBy(option => option.SortOrder)
                .Select(option => option.Id)
                .ToListAsync();
        }
        Assert.False(firstCorrectWordOrder.SequenceEqual(
            wordAssembly.WordAssembly.Parts.Select(part => part.Id)));
        var wrongWordOrder = firstCorrectWordOrder.Skip(1).Append(firstCorrectWordOrder[0]);
        var wrongWordResponse = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/word-assembly",
            new
            {
                challengeId = wordAssembly.Challenge.Id,
                orderedOptionIds = wrongWordOrder
            });
        wrongWordResponse.EnsureSuccessStatusCode();
        var wrongWordResult = await wrongWordResponse.Content.ReadFromJsonAsync<WordAssemblyAnswerResponse>();
        Assert.False(wrongWordResult?.Correct);
        Assert.False(wrongWordResult?.Expired);
        Assert.NotEmpty(wrongWordResult!.IncorrectOptionIds);

        for (var question = 0; question < 4; question++)
        {
            List<Guid> correctWordOrder;
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                correctWordOrder = await scope.ServiceProvider.GetRequiredService<AppDbContext>()
                    .ChallengeOptions
                    .Where(option => option.ChallengeId == wordAssembly.Challenge.Id)
                    .OrderBy(option => option.SortOrder)
                    .Select(option => option.Id)
                    .ToListAsync();
            }

            var wordResponse = await client.PostAsJsonAsync(
                $"/api/sessions/{session.Id}/word-assembly",
                new { challengeId = wordAssembly.Challenge.Id, orderedOptionIds = correctWordOrder });
            wordResponse.EnsureSuccessStatusCode();
            var wordResult = await wordResponse.Content.ReadFromJsonAsync<WordAssemblyAnswerResponse>();
            Assert.True(wordResult?.Correct);
            Assert.Empty(wordResult!.IncorrectOptionIds);

            var advanceResponse = await client.PostAsync($"/api/sessions/{session.Id}/next", null);
            Assert.Equal(HttpStatusCode.NoContent, advanceResponse.StatusCode);
            if (question < 3)
            {
                wordAssembly = await client.GetFromJsonAsync<ChallengeResponse>(
                    $"/api/sessions/{session.Id}/current-challenge");
                Assert.NotNull(wordAssembly?.WordAssembly);
                Assert.Equal(question + 2, wordAssembly.Challenge.QuestionNumber);
            }
        }

        var completedSession = await client.GetFromJsonAsync<SessionStatusResponse>(
            $"/api/sessions/{session.Id}");
        Assert.Equal("Completed", completedSession?.Status);

        var leaderboard = await client.GetFromJsonAsync<List<LeaderboardResponse>>("/api/leaderboard");
        Assert.Contains(leaderboard!, entry => entry.PlayerName == "Testspelaren" && entry.Rank == 1);
    }

    [Fact]
    public async Task ExpiredChallengeIsRegisteredAndItsTimerRestarts()
    {
        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Tidstestaren" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        var challenge = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.NotNull(challenge);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedSession = await db.GameSessions.SingleAsync(candidate => candidate.Id == session.Id);
            storedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        }

        var timeout = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/timeout",
            new { challengeId = challenge.Challenge.Id });
        timeout.EnsureSuccessStatusCode();
        var result = await timeout.Content.ReadFromJsonAsync<TimeoutResponse>();
        Assert.True(result?.Expired);
        Assert.Equal("Tiden tog slut. Försök igen.", result?.Message);

        await using var verificationScope = factory.Services.CreateAsyncScope();
        var attempt = await verificationScope.ServiceProvider
            .GetRequiredService<AppDbContext>()
            .ChallengeAttempts
            .SingleAsync(candidate =>
                candidate.GameSessionId == session.Id && candidate.ChallengeId == challenge.Challenge.Id);
        Assert.True(attempt.WasExpired);
        Assert.False(attempt.IsCorrect);
        Assert.Null(attempt.SelectedOptionId);
    }

    [Fact]
    public async Task PixelRevealsAddPermanentPenaltyAndResetAfterWrongAnswerAndTimeout()
    {
        var started = await client.PostAsJsonAsync("/api/sessions/", new { playerName = "Pixeltestaren" });
        var session = await started.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.NotNull(session);

        Guid pixelChallengeId;
        Guid wrongOptionId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var pixelChallenge = await db.Challenges
                .Include(challenge => challenge.Game)
                .Include(challenge => challenge.Options)
                .Where(challenge => challenge.Game.Type == EscapeRoom.Api.Domain.GameType.PixelHunt)
                .OrderBy(challenge => challenge.SortOrder)
                .FirstAsync();
            pixelChallengeId = pixelChallenge.Id;
            wrongOptionId = pixelChallenge.Options.Single(option => !option.IsCorrect && option.SortOrder == 1).Id;
            var storedSession = await db.GameSessions.SingleAsync(candidate => candidate.Id == session.Id);
            storedSession.CurrentChallengeId = pixelChallengeId;
            storedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        var unrelatedReveal = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/pixel-reveal",
            new { challengeId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, unrelatedReveal.StatusCode);

        for (var reveal = 1; reveal <= 5; reveal++)
        {
            var response = await client.PostAsJsonAsync(
                $"/api/sessions/{session.Id}/pixel-reveal",
                new { challengeId = pixelChallengeId });
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<PixelRevealResponse>();
            Assert.Equal(reveal, result?.PixelRevealCount);
            Assert.Equal(reveal * 5, result?.PenaltySeconds);
            Assert.True(result?.ElapsedMilliseconds >= reveal * 5_000);
        }

        var sixthReveal = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/pixel-reveal",
            new { challengeId = pixelChallengeId });
        Assert.Equal(HttpStatusCode.Conflict, sixthReveal.StatusCode);

        var wrongAnswer = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/answers",
            new { challengeId = pixelChallengeId, optionId = wrongOptionId });
        wrongAnswer.EnsureSuccessStatusCode();
        Assert.False((await wrongAnswer.Content.ReadFromJsonAsync<AnswerResponse>())?.Correct);

        var restarted = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.Equal(0, restarted?.Challenge.PixelRevealCount);
        Assert.True(restarted?.ElapsedMilliseconds >= 25_000);

        var oneMoreReveal = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/pixel-reveal",
            new { challengeId = pixelChallengeId });
        oneMoreReveal.EnsureSuccessStatusCode();
        Assert.Equal(30, (await oneMoreReveal.Content.ReadFromJsonAsync<PixelRevealResponse>())?.PenaltySeconds);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedSession = await db.GameSessions.SingleAsync(candidate => candidate.Id == session.Id);
            storedSession.CurrentChallengeStartedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        }

        var timeout = await client.PostAsJsonAsync(
            $"/api/sessions/{session.Id}/timeout",
            new { challengeId = pixelChallengeId });
        timeout.EnsureSuccessStatusCode();
        Assert.True((await timeout.Content.ReadFromJsonAsync<TimeoutResponse>())?.Expired);

        var afterTimeout = await client.GetFromJsonAsync<ChallengeResponse>(
            $"/api/sessions/{session.Id}/current-challenge");
        Assert.Equal(0, afterTimeout?.Challenge.PixelRevealCount);
        await using var verificationScope = factory.Services.CreateAsyncScope();
        var verifiedSession = await verificationScope.ServiceProvider.GetRequiredService<AppDbContext>()
            .GameSessions.SingleAsync(candidate => candidate.Id == session.Id);
        Assert.Equal(30_000, verifiedSession.TotalPenaltyMilliseconds);
    }

    private sealed record SessionResponse(Guid Id);
    private sealed record ChallengeResponse(
        GameBody Game,
        ChallengeBody Challenge,
        MatchingBody? Matching,
        SortingBody? Sorting,
        WordAssemblyBody? WordAssembly,
        long ElapsedMilliseconds);
    private sealed record GameBody(string Type);
    private sealed record ChallengeBody(
        Guid Id,
        int Number,
        int Total,
        int QuestionNumber,
        int QuestionTotal,
        int PixelRevealCount,
        List<OptionBody> Options);
    private sealed record MatchingBody(
        List<MatchingScenarioBody> Scenarios,
        List<MatchingDestinationBody> Destinations);
    private sealed record MatchingDestinationBody(string Text, string IconKey);
    private sealed record MatchingScenarioBody(Guid Id, string Prompt, List<OptionBody> Options);
    private sealed record SortingBody(List<OptionBody> Cards, List<string> Categories);
    private sealed record WordAssemblyBody(List<OptionBody> Parts);
    private sealed record MatchSelectionRequest(Guid ChallengeId, Guid OptionId);
    private sealed record SortingPlacementRequest(Guid OptionId, string? Category);
    private sealed record OptionBody(Guid Id, string Text, bool? IsCorrect);
    private sealed record AnswerResponse(bool Correct, bool Completed);
    private sealed record MatchingAnswerResponse(bool Correct, List<Guid> IncorrectChallengeIds);
    private sealed record SortingAnswerResponse(
        bool Correct,
        bool Expired,
        List<Guid> IncorrectOptionIds,
        long CurrentChallengePenaltyMilliseconds,
        long ElapsedMilliseconds);
    private sealed record WordAssemblyAnswerResponse(
        bool Correct,
        bool Expired,
        List<Guid> IncorrectOptionIds);
    private sealed record SessionStatusResponse(string Status);
    private sealed record TimeoutResponse(bool Expired, string Message);
    private sealed record PixelRevealResponse(int PixelRevealCount, int PenaltySeconds, long ElapsedMilliseconds);
    private sealed record LeaderboardResponse(int Rank, string PlayerName);
}
