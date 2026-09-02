namespace EscapeRoom.Api.Domain;

public sealed class AuditEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset OccurredAtUtc { get; set; }
    public required string Actor { get; set; }
    public required string Action { get; set; }
    public required string EntityType { get; set; }
    public required string EntityId { get; set; }
    public required string Summary { get; set; }
}
