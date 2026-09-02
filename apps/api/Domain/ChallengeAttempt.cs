namespace EscapeRoom.Api.Domain;

public sealed class ChallengeAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GameSessionId { get; set; }
    public GameSession GameSession { get; set; } = null!;
    public Guid ChallengeId { get; set; }
    public Challenge Challenge { get; set; } = null!;
    public Guid? SelectedOptionId { get; set; }
    public DateTimeOffset SubmittedAtUtc { get; set; }
    public bool IsCorrect { get; set; }
    public bool WasExpired { get; set; }
}
