namespace EscapeRoom.Api.Domain;

public sealed class GameSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string PlayerName { get; set; }
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.InProgress;
    public Guid? CurrentChallengeId { get; set; }
    public Challenge? CurrentChallenge { get; set; }
    public DateTimeOffset? CurrentChallengeStartedAtUtc { get; set; }
    public List<ChallengeAttempt> Attempts { get; set; } = [];
}
