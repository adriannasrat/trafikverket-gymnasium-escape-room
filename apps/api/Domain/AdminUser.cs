namespace EscapeRoom.Api.Domain;

public sealed class AdminUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Username { get; set; }
    public required string PasswordHash { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTimeOffset? LockoutEndUtc { get; set; }
    public DateTimeOffset? LastLoginAtUtc { get; set; }
}
