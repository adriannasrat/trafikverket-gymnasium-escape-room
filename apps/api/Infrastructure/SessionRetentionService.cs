using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EscapeRoom.Api.Infrastructure;

public sealed class SessionRetentionService(
    AppDbContext db,
    TimeProvider timeProvider,
    IOptions<DataRetentionOptions> options)
{
    public async Task<int> DeleteExpiredSessionsAsync(
        CancellationToken cancellationToken = default)
    {
        if (!options.Value.Enabled)
        {
            return 0;
        }

        var cutoff = timeProvider.GetUtcNow().AddDays(-options.Value.RetentionDays);
        var expiredSessions = await db.GameSessions
            .Include(session => session.Attempts)
            .Where(session => (session.CompletedAtUtc ?? session.StartedAtUtc) < cutoff)
            .ToListAsync(cancellationToken);

        if (expiredSessions.Count == 0)
        {
            return 0;
        }

        db.GameSessions.RemoveRange(expiredSessions);
        await db.SaveChangesAsync(cancellationToken);
        return expiredSessions.Count;
    }
}

public sealed class SessionRetentionWorker(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    IOptions<DataRetentionOptions> options,
    ILogger<SessionRetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            return;
        }

        await CleanupAsync(stoppingToken);

        using var timer = new PeriodicTimer(
            TimeSpan.FromHours(options.Value.CleanupIntervalHours),
            timeProvider);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await CleanupAsync(stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var deleted = await scope.ServiceProvider
                .GetRequiredService<SessionRetentionService>()
                .DeleteExpiredSessionsAsync(cancellationToken);
            if (deleted > 0)
            {
                ExpiredSessionsDeleted(logger, deleted, options.Value.RetentionDays, null);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        catch (Exception exception)
        {
            CleanupFailed(logger, exception);
        }
    }

    private static readonly Action<ILogger, int, int, Exception?> ExpiredSessionsDeleted =
        LoggerMessage.Define<int, int>(
            LogLevel.Information,
            new EventId(2001, nameof(ExpiredSessionsDeleted)),
            "Deleted {DeletedCount} game sessions older than the {RetentionDays}-day retention period.");

    private static readonly Action<ILogger, Exception?> CleanupFailed =
        LoggerMessage.Define(
            LogLevel.Error,
            new EventId(2002, nameof(CleanupFailed)),
            "Automatic game-session cleanup failed.");
}
