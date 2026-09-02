using EscapeRoom.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Infrastructure;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<ChallengeOption> ChallengeOptions => Set<ChallengeOption>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<ChallengeAttempt> ChallengeAttempts => Set<ChallengeAttempt>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasIndex(game => game.Slug).IsUnique();
            entity.Property(game => game.Slug).HasMaxLength(80);
            entity.Property(game => game.Title).HasMaxLength(160);
            entity.Property(game => game.Summary).HasMaxLength(500);
            entity.Property(game => game.SuccessMessage).HasMaxLength(1000);
            entity.HasMany(game => game.Challenges)
                .WithOne(challenge => challenge.Game)
                .HasForeignKey(challenge => challenge.GameId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Challenge>(entity =>
        {
            entity.Property(challenge => challenge.Prompt).HasMaxLength(1200);
            entity.Property(challenge => challenge.ImagePath).HasMaxLength(500);
            entity.HasMany(challenge => challenge.Options)
                .WithOne(option => option.Challenge)
                .HasForeignKey(option => option.ChallengeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChallengeOption>(entity =>
            entity.Property(option => option.Text).HasMaxLength(500));

        modelBuilder.Entity<GameSession>(entity =>
        {
            entity.Property(session => session.PlayerName).HasMaxLength(80);
            entity.HasIndex(session => new { session.Status, session.CompletedAtUtc });
            entity.HasOne(session => session.CurrentChallenge)
                .WithMany()
                .HasForeignKey(session => session.CurrentChallengeId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ChallengeAttempt>(entity =>
        {
            entity.HasOne(attempt => attempt.GameSession)
                .WithMany(session => session.Attempts)
                .HasForeignKey(attempt => attempt.GameSessionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(attempt => attempt.Challenge)
                .WithMany()
                .HasForeignKey(attempt => attempt.ChallengeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.HasIndex(user => user.Username).IsUnique();
            entity.Property(user => user.Username).HasMaxLength(80);
            entity.Property(user => user.PasswordHash).HasMaxLength(1000);
        });

        modelBuilder.Entity<AuditEntry>(entity =>
        {
            entity.HasIndex(entry => entry.OccurredAtUtc);
            entity.Property(entry => entry.Actor).HasMaxLength(80);
            entity.Property(entry => entry.Action).HasMaxLength(80);
            entity.Property(entry => entry.EntityType).HasMaxLength(80);
            entity.Property(entry => entry.EntityId).HasMaxLength(100);
            entity.Property(entry => entry.Summary).HasMaxLength(1000);
        });
    }
}
