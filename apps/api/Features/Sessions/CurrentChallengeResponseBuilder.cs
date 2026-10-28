using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public sealed class CurrentChallengeResponseBuilder(AppDbContext db)
{
    public async Task<CurrentChallengeResponse> BuildAsync(
        GameSession session,
        Challenge challenge,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var awaitingNext = session.CurrentChallengeStartedAtUtc is null;
        var retryRequired = !awaitingNext && session.PausedAtUtc is not null;
        var startedAt = session.CurrentChallengeStartedAtUtc ?? now;
        var effectiveNow = retryRequired ? session.PausedAtUtc!.Value : now;
        var elapsed = awaitingNext ? TimeSpan.Zero : effectiveNow - startedAt;
        var limit = SessionTimeCalculator.GetTimeLimitSeconds(challenge);
        var currentPenalty = challenge.Game.Type == GameType.Sorting
            ? session.CurrentChallengePenaltyMilliseconds
            : 0;

        var challengeIds = await db.Challenges.AsNoTracking()
            .Where(candidate =>
                candidate.GameId == challenge.GameId &&
                candidate.IsActive &&
                candidate.IsEnabled)
            .OrderBy(candidate => candidate.SortOrder)
            .Select(candidate => candidate.Id)
            .ToListAsync(cancellationToken);
        var activeGameIds = await db.Games.AsNoTracking()
            .Where(game => game.IsActive && game.Challenges.Any(candidate =>
                candidate.IsActive && candidate.IsEnabled))
            .OrderBy(game => game.SortOrder)
            .Select(game => game.Id)
            .ToListAsync(cancellationToken);

        var payload = await BuildGamePayloadAsync(
            session,
            challenge,
            awaitingNext,
            startedAt,
            cancellationToken);

        return new CurrentChallengeResponse(
            Completed: false,
            SessionId: session.Id,
            PlayerName: session.PlayerName,
            StartedAtUtc: session.StartedAtUtc,
            ElapsedMilliseconds: SessionTimeCalculator.CalculateElapsedMilliseconds(session, now),
            Score: session.Score,
            LivesRemaining: session.LivesRemaining,
            Game: new SessionGameResponse(
                challenge.Game.Id,
                challenge.Game.Slug,
                challenge.Game.Title,
                challenge.Game.Summary,
                challenge.Game.SortOrder,
                challenge.Game.Type.ToString()),
            Challenge: new SessionChallengeResponse(
                challenge.Id,
                challenge.Prompt,
                challenge.Game.Type.SupportsChallengeImages() ? challenge.ImagePath : null,
                activeGameIds.IndexOf(challenge.GameId) + 1,
                activeGameIds.Count,
                challengeIds.IndexOf(challenge.Id) + 1,
                challengeIds.Count,
                challenge.Game.Type == GameType.PixelHunt ? session.PixelRevealCount : 0,
                currentPenalty,
                awaitingNext,
                retryRequired,
                limit,
                startedAt,
                Math.Max(0, limit - elapsed.TotalSeconds - currentPenalty / 1000d),
                challenge.Game.Type == GameType.Hangman
                    ? []
                    : challenge.Options
                        .OrderBy(option => option.SortOrder)
                        .Select(option => new ChallengeOptionResponse(option.Id, option.Text))
                        .ToList()),
            Matching: payload.Matching,
            Sorting: payload.Sorting,
            WordAssembly: payload.WordAssembly,
            Hangman: payload.Hangman);
    }

    private async Task<GameChallengePayload> BuildGamePayloadAsync(
        GameSession session,
        Challenge challenge,
        bool awaitingNext,
        DateTimeOffset startedAt,
        CancellationToken cancellationToken) => challenge.Game.Type switch
        {
            GameType.Matching => new GameChallengePayload(
                Matching: await BuildMatchingAsync(challenge.GameId, cancellationToken)),
            GameType.Sorting => new GameChallengePayload(
                Sorting: BuildSorting(challenge)),
            GameType.WordAssembly => new GameChallengePayload(
                WordAssembly: BuildWordAssembly(challenge, awaitingNext)),
            GameType.Hangman => new GameChallengePayload(
                Hangman: await BuildHangmanAsync(
                    session,
                    challenge,
                    awaitingNext,
                    startedAt,
                    cancellationToken)),
            _ => new GameChallengePayload()
        };

    private async Task<MatchingGameResponse> BuildMatchingAsync(
        Guid gameId,
        CancellationToken cancellationToken)
    {
        var scenarios = await db.Challenges.AsNoTracking()
            .Where(candidate =>
                candidate.GameId == gameId &&
                candidate.IsActive &&
                candidate.IsEnabled)
            .OrderBy(candidate => candidate.SortOrder)
            .Select(candidate => new MatchingScenarioResponse(
                candidate.Id,
                candidate.Prompt,
                candidate.ImagePath,
                candidate.Options
                    .OrderBy(option => option.SortOrder)
                    .Select(option => new MatchingOptionResponse(
                        option.Id,
                        option.Text,
                        option.MatchingIconKey ?? "map-pin"))
                    .ToList()))
            .ToListAsync(cancellationToken);
        var destinations = scenarios.FirstOrDefault()?.Options
            .Select(option => new MatchingDestinationResponse(option.Text, option.MatchingIconKey))
            .ToList() ?? [];
        return new MatchingGameResponse(scenarios, destinations);
    }

    private static SortingGameResponse BuildSorting(Challenge challenge) => new(
        challenge.Options
            .OrderBy(option => option.SortOrder)
            .Select(option => new SortingCardResponse(option.Id, option.Text))
            .ToList(),
        challenge.Options
            .Where(option => option.SortingCategory is not null)
            .Select(option => option.SortingCategory!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList());

    private static WordAssemblyGameResponse BuildWordAssembly(
        Challenge challenge,
        bool awaitingNext)
    {
        var parts = challenge.Options
            .OrderBy(option => option.SortOrder)
            .Select(option => new WordPartResponse(option.Id, option.Text))
            .ToList();
        if (!awaitingNext)
        {
            var correctOrder = parts.Select(part => part.Id).ToList();
            parts = parts.OrderBy(_ => Random.Shared.Next()).ToList();
            if (parts.Select(part => part.Id).SequenceEqual(correctOrder))
            {
                parts = [.. parts.Skip(1), parts[0]];
            }
        }

        return new WordAssemblyGameResponse(parts);
    }

    private async Task<HangmanStateResponse> BuildHangmanAsync(
        GameSession session,
        Challenge challenge,
        bool awaitingNext,
        DateTimeOffset startedAt,
        CancellationToken cancellationToken)
    {
        var answer = HangmanRules.NormalizeAnswer(challenge.Options.Single().Text);
        var guesses = awaitingNext
            ? answer.Where(char.IsLetter)
                .Select(character => character.ToString())
                .Distinct()
                .ToList()
            : await db.ChallengeAttempts.AsNoTracking()
                .Where(attempt => attempt.GameSessionId == session.Id &&
                    attempt.ChallengeId == challenge.Id &&
                    attempt.SubmittedValue != null &&
                    attempt.SubmittedAtUtc > startedAt)
                .Select(attempt => attempt.SubmittedValue!)
                .Distinct()
                .ToListAsync(cancellationToken);
        return HangmanRules.BuildState(answer, guesses);
    }

    private sealed record GameChallengePayload(
        MatchingGameResponse? Matching = null,
        SortingGameResponse? Sorting = null,
        WordAssemblyGameResponse? WordAssembly = null,
        HangmanStateResponse? Hangman = null);
}
