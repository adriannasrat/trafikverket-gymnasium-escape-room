namespace EscapeRoom.Api.Domain;

public sealed class ChallengeOption
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChallengeId { get; set; }
    public Challenge Challenge { get; set; } = null!;
    public required string Text { get; set; }
    public int SortOrder { get; set; }
    public bool IsCorrect { get; set; }
}
