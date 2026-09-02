namespace EscapeRoom.Api.Domain;

public sealed class Game
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Slug { get; set; }
    public required string Title { get; set; }
    public required string Summary { get; set; }
    public GameType Type { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public int DefaultTimeLimitSeconds { get; set; } = 60;
    public required string SuccessMessage { get; set; }
    public List<Challenge> Challenges { get; set; } = [];
}
