using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    private const string HangmanAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
    private const int HangmanMaximumMistakes = 6;

    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sessions").WithTags("Sessions");
        group.MapPost("/", StartSessionAsync);
        group.MapGet("/{sessionId:guid}", GetSessionAsync);
        group.MapGet("/{sessionId:guid}/current-challenge", GetCurrentChallengeAsync);
        group.MapPost("/{sessionId:guid}/answers", SubmitAnswerAsync);
        group.MapPost("/{sessionId:guid}/matches", SubmitMatchesAsync);
        group.MapPost("/{sessionId:guid}/pixel-reveal", RevealPixelAsync);
        group.MapPost("/{sessionId:guid}/sorting", SubmitSortingAsync);
        group.MapPost("/{sessionId:guid}/word-assembly", SubmitWordAssemblyAsync);
        group.MapPost("/{sessionId:guid}/hangman-guesses", SubmitHangmanGuessAsync);
        group.MapPost("/{sessionId:guid}/timeout", RegisterTimeoutAsync);
        group.MapPost("/{sessionId:guid}/next", MoveToNextChallengeAsync);

        endpoints.MapGet("/api/leaderboard", GetLeaderboardAsync).WithTags("Leaderboard");
        return endpoints;
    }

    private static async Task<IResult> StartSessionAsync(
        StartSessionRequest request,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var playerName = request.PlayerName.Trim();
        if (playerName.Length is < 2 or > 80)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["playerName"] = ["Namnet måste innehålla mellan 2 och 80 tecken."]
            });
        }

        var firstChallenge = await LoadOrderedChallenges(db)
            .FirstOrDefaultAsync(cancellationToken);
        if (firstChallenge is null)
        {
            return Results.Problem(
                title: "Inga aktiva uppdrag",
                detail: "En administratör måste aktivera minst ett uppdrag innan spelet kan starta.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var now = timeProvider.GetUtcNow();
        var session = new GameSession
        {
            PlayerName = playerName,
            StartedAtUtc = now,
            CurrentChallengeId = firstChallenge.Id,
            CurrentChallengeStartedAtUtc = now
        };
        db.GameSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/sessions/{session.Id}", ToSessionResponse(session, now));
    }

    private static async Task<IResult> GetSessionAsync(
        Guid sessionId,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        return session is null
            ? Results.NotFound()
            : Results.Ok(ToSessionResponse(session, timeProvider.GetUtcNow()));
    }

    private static async Task<IResult> GetCurrentChallengeAsync(
        Guid sessionId,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }

        if (session.Status == SessionStatus.Completed || session.CurrentChallengeId is null)
        {
            return Results.Ok(new { completed = true });
        }

        var challenge = await db.Challenges.AsNoTracking()
            .Include(candidate => candidate.Game)
            .Include(candidate => candidate.Options)
            .SingleAsync(candidate => candidate.Id == session.CurrentChallengeId, cancellationToken);
        var limit = GetTimeLimitSeconds(challenge);
        var now = timeProvider.GetUtcNow();
        var awaitingNext = session.CurrentChallengeStartedAtUtc is null;
        var startedAt = session.CurrentChallengeStartedAtUtc ?? now;
        var elapsed = awaitingNext ? TimeSpan.Zero : now - startedAt;
        var currentChallengePenaltyMilliseconds = challenge.Game.Type == GameType.Sorting
            ? session.CurrentChallengePenaltyMilliseconds
            : 0;
        var challengeIds = await db.Challenges.AsNoTracking()
            .Where(candidate => candidate.GameId == challenge.GameId && candidate.IsActive)
            .OrderBy(candidate => candidate.SortOrder)
            .Select(candidate => candidate.Id)
            .ToListAsync(cancellationToken);
        var activeGameIds = await db.Games.AsNoTracking()
            .Where(game => game.IsActive && game.Challenges.Any(candidate => candidate.IsActive))
            .OrderBy(game => game.SortOrder)
            .Select(game => game.Id)
            .ToListAsync(cancellationToken);
        var gameNumber = activeGameIds.IndexOf(challenge.GameId) + 1;
        var questionNumber = challengeIds.IndexOf(challenge.Id) + 1;

        object? matching = null;
        if (challenge.Game.Type == GameType.Matching)
        {
            var scenarios = await db.Challenges.AsNoTracking()
                .Where(candidate => candidate.GameId == challenge.GameId && candidate.IsActive)
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
            matching = new
            {
                scenarios,
                destinations = scenarios.FirstOrDefault()?.Options
                    .Select(option => new { text = option.Text, iconKey = option.MatchingIconKey })
                    .ToList() ?? []
            };
        }

        object? sorting = null;
        if (challenge.Game.Type == GameType.Sorting)
        {
            sorting = new
            {
                cards = challenge.Options
                    .OrderBy(option => option.SortOrder)
                    .Select(option => new { option.Id, option.Text }),
                categories = challenge.Options
                    .Where(option => option.SortingCategory != null)
                    .Select(option => option.SortingCategory!)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
            };
        }

        object? wordAssembly = null;
        if (challenge.Game.Type == GameType.WordAssembly)
        {
            var wordParts = challenge.Options
                .OrderBy(option => option.SortOrder)
                .Select(option => new WordPartResponse(option.Id, option.Text))
                .ToList();
            if (!awaitingNext)
            {
                var correctOrder = wordParts.Select(part => part.Id).ToList();
                wordParts = wordParts.OrderBy(_ => Random.Shared.Next()).ToList();
                if (wordParts.Select(part => part.Id).SequenceEqual(correctOrder))
                {
                    wordParts = [.. wordParts.Skip(1), wordParts[0]];
                }
            }

            wordAssembly = new
            {
                parts = wordParts
            };
        }

        object? hangman = null;
        if (challenge.Game.Type == GameType.Hangman)
        {
            var answer = NormalizeHangmanAnswer(challenge.Options.Single().Text);
            var guessedLetters = awaitingNext
                ? answer.Where(char.IsLetter).Select(character => character.ToString()).Distinct().ToList()
                : await db.ChallengeAttempts.AsNoTracking()
                    .Where(attempt => attempt.GameSessionId == session.Id &&
                        attempt.ChallengeId == challenge.Id &&
                        attempt.SubmittedValue != null &&
                        attempt.SubmittedAtUtc > startedAt)
                    .Select(attempt => attempt.SubmittedValue!)
                    .Distinct()
                    .ToListAsync(cancellationToken);
            hangman = BuildHangmanState(answer, guessedLetters);
        }

        return Results.Ok(new
        {
            completed = false,
            sessionId = session.Id,
            session.PlayerName,
            session.StartedAtUtc,
            elapsedMilliseconds = CalculateElapsedMilliseconds(session, now),
            game = new
            {
                challenge.Game.Id,
                challenge.Game.Slug,
                challenge.Game.Title,
                challenge.Game.Summary,
                challenge.Game.SortOrder,
                type = challenge.Game.Type.ToString()
            },
            challenge = new
            {
                challenge.Id,
                challenge.Prompt,
                challenge.ImagePath,
                number = gameNumber,
                total = activeGameIds.Count,
                questionNumber,
                questionTotal = challengeIds.Count,
                pixelRevealCount = challenge.Game.Type == GameType.PixelHunt ? session.PixelRevealCount : 0,
                currentChallengePenaltyMilliseconds,
                awaitingNext,
                timeLimitSeconds = limit,
                challengeStartedAtUtc = startedAt,
                secondsRemaining = Math.Max(
                    0,
                    limit - elapsed.TotalSeconds - currentChallengePenaltyMilliseconds / 1000d),
                options = challenge.Game.Type == GameType.Hangman
                    ? new List<ChallengeOptionResponse>()
                    : challenge.Options
                        .OrderBy(option => option.SortOrder)
                        .Select(option => new ChallengeOptionResponse(option.Id, option.Text))
                        .ToList()
            },
            matching,
            sorting,
            wordAssembly,
            hangman
        });
    }

    private static async Task<IResult> RegisterTimeoutAsync(
        Guid sessionId,
        ChallengeTimeoutRequest request,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }

        if (session.Status != SessionStatus.InProgress || session.CurrentChallengeId is null)
        {
            return Results.Conflict(new { message = "Spelsessionen är redan avslutad." });
        }

        if (session.CurrentChallengeId != request.ChallengeId)
        {
            return Results.BadRequest(new { message = "Tiden gäller inte det aktuella uppdraget." });
        }

        if (session.CurrentChallengeStartedAtUtc is null)
        {
            return Results.Conflict(new { message = "Frågan är redan klar. Gå vidare till nästa fråga." });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleAsync(candidate => candidate.Id == request.ChallengeId, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var limit = GetTimeLimitSeconds(challenge);
        var elapsed = now - session.CurrentChallengeStartedAtUtc.Value +
            TimeSpan.FromMilliseconds(session.CurrentChallengePenaltyMilliseconds);
        var secondsRemaining = limit - elapsed.TotalSeconds;
        if (secondsRemaining > 0)
        {
            return Results.Ok(new
            {
                expired = false,
                challengeStartedAtUtc = session.CurrentChallengeStartedAtUtc.Value,
                timeLimitSeconds = limit,
                secondsRemaining
            });
        }

        db.ChallengeAttempts.Add(new ChallengeAttempt
        {
            GameSessionId = session.Id,
            ChallengeId = challenge.Id,
            SubmittedAtUtc = now,
            IsCorrect = false,
            WasExpired = true
        });
        session.CurrentChallengeStartedAtUtc = now;
        session.PixelRevealCount = 0;
        session.CurrentChallengePenaltyMilliseconds = 0;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            expired = true,
            message = "Tiden tog slut. Försök igen.",
            challengeStartedAtUtc = now,
            timeLimitSeconds = limit,
            currentChallengePenaltyMilliseconds = 0,
            secondsRemaining = (double)limit
        });
    }

    private static async Task<IResult> MoveToNextChallengeAsync(
        Guid sessionId,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var session = await db.GameSessions
            .SingleOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return Results.NotFound();
        }

        if (session.Status != SessionStatus.InProgress || session.CurrentChallengeId is null)
        {
            return Results.Conflict(new { message = "Spelsessionen är redan avslutad." });
        }

        if (session.CurrentChallengeStartedAtUtc is not null)
        {
            return Results.Conflict(new { message = "Besvara den aktuella frågan innan du går vidare." });
        }

        var currentChallenge = await db.Challenges.AsNoTracking()
            .Where(candidate => candidate.Id == session.CurrentChallengeId)
            .Select(candidate => new { candidate.GameId, candidate.Game.Type })
            .SingleAsync(cancellationToken);
        var orderedChallenges = await LoadOrderedChallenges(db)
            .Select(candidate => new { candidate.Id, candidate.GameId })
            .ToListAsync(cancellationToken);
        var currentIndex = orderedChallenges.FindIndex(candidate => candidate.Id == session.CurrentChallengeId.Value);
        var nextChallenge = currentIndex < 0
            ? null
            : orderedChallenges
                .Skip(currentIndex + 1)
                .FirstOrDefault(candidate =>
                    currentChallenge.Type != GameType.Matching || candidate.GameId != currentChallenge.GameId);
        var nextChallengeId = nextChallenge?.Id;
        var now = timeProvider.GetUtcNow();
        if (session.PausedAtUtc is { } pausedAt)
        {
            session.TotalPausedMilliseconds += Math.Max(0, (long)(now - pausedAt).TotalMilliseconds);
            session.PausedAtUtc = null;
        }

        session.CurrentChallengeId = nextChallengeId;
        session.CurrentChallengeStartedAtUtc = nextChallengeId is null ? null : now;
        session.PixelRevealCount = 0;
        session.CurrentChallengePenaltyMilliseconds = 0;
        if (nextChallengeId is null)
        {
            session.Status = SessionStatus.Completed;
            session.CompletedAtUtc = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> GetLeaderboardAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var sessions = await db.GameSessions.AsNoTracking()
            .Where(session => session.Status == SessionStatus.Completed && session.CompletedAtUtc != null)
            .OrderBy(session => session.CompletedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        var leaderboard = sessions
            .Select(session => new
            {
                session.Id,
                session.PlayerName,
                session.CompletedAtUtc,
                elapsedMilliseconds = CalculateElapsedMilliseconds(session, session.CompletedAtUtc!.Value)
            })
            .OrderBy(result => result.elapsedMilliseconds)
            .ThenBy(result => result.CompletedAtUtc)
            .Take(10)
            .Select((result, index) => new
            {
                rank = index + 1,
                result.Id,
                result.PlayerName,
                result.elapsedMilliseconds,
                result.CompletedAtUtc
            });

        return Results.Ok(leaderboard);
    }

    private static IQueryable<Challenge> LoadOrderedChallenges(AppDbContext db) =>
        db.Challenges
            .Where(challenge => challenge.Game.IsActive && challenge.IsActive)
            .OrderBy(challenge => challenge.Game.SortOrder)
            .ThenBy(challenge => challenge.SortOrder);

    private static object ToSessionResponse(GameSession session, DateTimeOffset now) => new
    {
        session.Id,
        session.PlayerName,
        session.StartedAtUtc,
        session.CompletedAtUtc,
        status = session.Status.ToString(),
        elapsedMilliseconds = CalculateElapsedMilliseconds(session, now)
    };

    private static long CalculateElapsedMilliseconds(GameSession session, DateTimeOffset now)
    {
        var end = session.CompletedAtUtc ?? now;
        var pausedMilliseconds = session.TotalPausedMilliseconds;
        if (session.PausedAtUtc is { } pausedAt)
        {
            pausedMilliseconds += Math.Max(0, (long)(end - pausedAt).TotalMilliseconds);
        }

        var totalMilliseconds = (long)(end - session.StartedAtUtc).TotalMilliseconds;
        return Math.Max(0, totalMilliseconds - pausedMilliseconds + session.TotalPenaltyMilliseconds);
    }

    private static int GetTimeLimitSeconds(Challenge challenge) =>
        // Admin exposes one time per game. Ignore legacy per-question values that
        // can still exist in databases created by earlier versions.
        challenge.Game.DefaultTimeLimitSeconds;

    private static string NormalizeHangmanAnswer(string answer) => answer.Trim().ToUpperInvariant();

    private static HangmanStateResponse BuildHangmanState(string answer, IEnumerable<string> guesses)
    {
        var guessedLetters = guesses
            .Select(guess => guess.Trim().ToUpperInvariant())
            .Where(guess => guess.Length == 1 && HangmanAlphabet.Contains(guess, StringComparison.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var guessedCharacters = guessedLetters.Select(guess => guess[0]).ToHashSet();
        var pattern = answer
            .Select(character => !char.IsLetter(character) || guessedCharacters.Contains(character)
                ? character.ToString()
                : null)
            .ToList();
        var mistakes = guessedLetters.Count(guess => !answer.Contains(guess, StringComparison.Ordinal));
        return new HangmanStateResponse(
            pattern,
            guessedLetters,
            Math.Min(mistakes, HangmanMaximumMistakes),
            HangmanMaximumMistakes,
            pattern.All(character => character is not null));
    }

    public sealed record StartSessionRequest(string PlayerName);
    public sealed record SubmitAnswerRequest(Guid ChallengeId, Guid OptionId);
    public sealed record SubmitMatchesRequest(Guid ChallengeId, List<MatchSelectionRequest> Selections);
    public sealed record MatchSelectionRequest(Guid ChallengeId, Guid OptionId);
    public sealed record SubmitSortingRequest(Guid ChallengeId, List<SortingPlacementRequest> Placements);
    public sealed record SortingPlacementRequest(Guid OptionId, string? Category);
    public sealed record SubmitWordAssemblyRequest(Guid ChallengeId, List<Guid> OrderedOptionIds);
    public sealed record SubmitHangmanGuessRequest(Guid ChallengeId, string Letter);
    public sealed record ChallengeTimeoutRequest(Guid ChallengeId);
    public sealed record PixelRevealRequest(Guid ChallengeId);
    private sealed record MatchingScenarioResponse(
        Guid Id,
        string Prompt,
        string? ImagePath,
        List<MatchingOptionResponse> Options);
    private sealed record MatchingOptionResponse(Guid Id, string Text, string MatchingIconKey);
    private sealed record WordPartResponse(Guid Id, string Text);
    private sealed record ChallengeOptionResponse(Guid Id, string Text);
    private sealed record HangmanStateResponse(
        List<string?> Pattern,
        List<string> GuessedLetters,
        int Mistakes,
        int MaxMistakes,
        bool Solved);
}
