namespace EscapeRoom.Api.Features.Sessions;

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

public sealed record SessionResponse(
    Guid Id,
    string PlayerName,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    string Status,
    long ElapsedMilliseconds);

public sealed record SessionCompletedResponse(bool Completed);

public sealed record CurrentChallengeResponse(
    bool Completed,
    Guid SessionId,
    string PlayerName,
    DateTimeOffset StartedAtUtc,
    long ElapsedMilliseconds,
    SessionGameResponse Game,
    SessionChallengeResponse Challenge,
    MatchingGameResponse? Matching,
    SortingGameResponse? Sorting,
    WordAssemblyGameResponse? WordAssembly,
    HangmanStateResponse? Hangman);

public sealed record SessionGameResponse(
    Guid Id,
    string Slug,
    string Title,
    string Summary,
    int SortOrder,
    string Type);

public sealed record SessionChallengeResponse(
    Guid Id,
    string Prompt,
    string? ImagePath,
    int Number,
    int Total,
    int QuestionNumber,
    int QuestionTotal,
    int PixelRevealCount,
    long CurrentChallengePenaltyMilliseconds,
    bool AwaitingNext,
    int TimeLimitSeconds,
    DateTimeOffset ChallengeStartedAtUtc,
    double SecondsRemaining,
    List<ChallengeOptionResponse> Options);

public sealed record ChallengeOptionResponse(Guid Id, string Text);
public sealed record MatchingScenarioResponse(
    Guid Id,
    string Prompt,
    string? ImagePath,
    List<MatchingOptionResponse> Options);
public sealed record MatchingOptionResponse(Guid Id, string Text, string MatchingIconKey);
public sealed record MatchingDestinationResponse(string Text, string IconKey);
public sealed record MatchingGameResponse(
    List<MatchingScenarioResponse> Scenarios,
    List<MatchingDestinationResponse> Destinations);
public sealed record SortingCardResponse(Guid Id, string Text);
public sealed record SortingGameResponse(List<SortingCardResponse> Cards, List<string> Categories);
public sealed record WordPartResponse(Guid Id, string Text);
public sealed record WordAssemblyGameResponse(List<WordPartResponse> Parts);
public sealed record HangmanStateResponse(
    List<string?> Pattern,
    List<string> GuessedLetters,
    int Mistakes,
    int MaxMistakes,
    bool Solved);

public sealed record ChallengeTimeRemainingResponse(
    bool Expired,
    DateTimeOffset ChallengeStartedAtUtc,
    int TimeLimitSeconds,
    double SecondsRemaining);

public sealed record ChallengeExpiredResponse(
    bool Expired,
    string Message,
    DateTimeOffset ChallengeStartedAtUtc,
    int TimeLimitSeconds,
    long CurrentChallengePenaltyMilliseconds,
    double SecondsRemaining);

public sealed record LeaderboardEntryResponse(
    int Rank,
    Guid Id,
    string PlayerName,
    long ElapsedMilliseconds,
    DateTimeOffset? CompletedAtUtc);

public sealed record ErrorResponse(string Message);

public enum SessionResultKind
{
    Success,
    NotFound,
    BadRequest,
    Conflict,
    Validation,
    Unavailable
}

public sealed record SessionResult<T>(
    SessionResultKind Kind,
    T? Value = default,
    string? Message = null,
    Dictionary<string, string[]>? Errors = null,
    string? Title = null);

public static class SessionResults
{
    public static SessionResult<T> Success<T>(T value) => new(SessionResultKind.Success, value);
    public static SessionResult<T> NotFound<T>() => new(SessionResultKind.NotFound);
    public static SessionResult<T> BadRequest<T>(string message) =>
        new(SessionResultKind.BadRequest, Message: message);
    public static SessionResult<T> Conflict<T>(string message) =>
        new(SessionResultKind.Conflict, Message: message);
    public static SessionResult<T> Validation<T>(Dictionary<string, string[]> errors) =>
        new(SessionResultKind.Validation, Errors: errors);
    public static SessionResult<T> Unavailable<T>(string title, string message) =>
        new(SessionResultKind.Unavailable, Message: message, Title: title);
}
