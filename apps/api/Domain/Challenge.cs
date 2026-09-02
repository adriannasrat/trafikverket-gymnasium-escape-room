namespace EscapeRoom.Api.Domain;

public sealed class Challenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GameId { get; set; }
    public Game Game { get; set; } = null!;
    public required string Prompt { get; set; }
    public string? ImagePath { get; set; }
    public int SortOrder { get; set; }
    public int? TimeLimitSeconds { get; set; }
    public List<ChallengeOption> Options { get; set; } = [];
}
