using System.Text.RegularExpressions;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public interface IChallengeImageStore
{
    Task<string> SaveAsync(Stream source, string extension, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(string imagePath, CancellationToken cancellationToken);
    Task<IReadOnlyList<StoredChallengeImage>> ListAsync(CancellationToken cancellationToken);
}

public sealed record StoredChallengeImage(string ImagePath, long SizeBytes);

public sealed partial class ChallengeImageStore : IChallengeImageStore
{
    private readonly string rootPath;
    private readonly ILogger<ChallengeImageStore> logger;

    [GeneratedRegex("^[a-f0-9]{32}\\.(png|jpg|webp)$", RegexOptions.IgnoreCase)]
    private static partial Regex ManagedFileNamePattern();

    public ChallengeImageStore(
        IConfiguration configuration,
        ILogger<ChallengeImageStore> logger)
    {
        rootPath = Path.GetFullPath(
            configuration["Uploads:Path"] ?? Path.Combine(AppContext.BaseDirectory, "uploads"));
        this.logger = logger;
        Directory.CreateDirectory(rootPath);
    }

    public async Task<string> SaveAsync(
        Stream source,
        string extension,
        CancellationToken cancellationToken)
    {
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var destination = Path.Combine(rootPath, fileName);
        try
        {
            await using var output = new FileStream(
                destination,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true);
            await source.CopyToAsync(output, cancellationToken);
            return $"/uploads/{fileName}";
        }
        catch
        {
            File.Delete(destination);
            throw;
        }
    }

    public Task<bool> DeleteAsync(string imagePath, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var fullPath = ResolveManagedPath(imagePath);
        if (fullPath is null)
        {
            return Task.FromResult(false);
        }

        try
        {
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
            return Task.FromResult(true);
        }
        catch (IOException exception)
        {
            LogDeleteWarning(logger, imagePath, exception);
            return Task.FromResult(false);
        }
        catch (UnauthorizedAccessException exception)
        {
            LogDeleteWarning(logger, imagePath, exception);
            return Task.FromResult(false);
        }
    }

    public Task<IReadOnlyList<StoredChallengeImage>> ListAsync(
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Directory.CreateDirectory(rootPath);
        var images = Directory.EnumerateFiles(rootPath, "*", SearchOption.TopDirectoryOnly)
            .Select(path => new FileInfo(path))
            .Where(file => ManagedFileNamePattern().IsMatch(file.Name))
            .Select(file => new StoredChallengeImage($"/uploads/{file.Name}", file.Length))
            .OrderBy(file => file.ImagePath, StringComparer.Ordinal)
            .ToArray();
        return Task.FromResult<IReadOnlyList<StoredChallengeImage>>(images);
    }

    private string? ResolveManagedPath(string imagePath)
    {
        const string prefix = "/uploads/";
        if (!imagePath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var fileName = imagePath[prefix.Length..];
        if (!ManagedFileNamePattern().IsMatch(fileName))
        {
            return null;
        }

        var fullPath = Path.GetFullPath(Path.Combine(rootPath, fileName));
        return Path.GetDirectoryName(fullPath) == rootPath ? fullPath : null;
    }

    [LoggerMessage(
        EventId = 2101,
        Level = LogLevel.Warning,
        Message = "Could not delete challenge image {ImagePath}.")]
    private static partial void LogDeleteWarning(
        ILogger logger,
        string imagePath,
        Exception exception);
}

public enum ChallengeImageOperationStatus
{
    Success,
    NotFound,
    ValidationFailed,
    UploadsDisabled
}

public sealed record ChallengeImageMutation(string? ImagePath, bool IsEnabled);

public sealed record ChallengeImageOperationResult(
    ChallengeImageOperationStatus Status,
    ChallengeImageMutation? Mutation = null,
    string? Error = null);

public sealed record ImageCleanupFile(string ImagePath, long SizeBytes, bool Deleted);

public sealed record ImageCleanupReport(
    bool DryRun,
    int CandidateCount,
    int DeletedCount,
    int SkippedCount,
    long TotalBytes,
    IReadOnlyList<ImageCleanupFile> Files);

public sealed class ChallengeImageService(
    AppDbContext db,
    IChallengeImageStore store,
    IConfiguration configuration,
    TimeProvider timeProvider)
{
    private const long MaximumBytes = 5 * 1024 * 1024;

    public async Task<ChallengeImageOperationResult> UploadAsync(
        Guid challengeId,
        IFormFile image,
        string actor,
        CancellationToken cancellationToken)
    {
        if (!UploadsEnabled())
        {
            return UploadsDisabled();
        }

        if (image.Length is <= 0 or > MaximumBytes)
        {
            return Validation("Bilden måste vara JPG, PNG eller WebP och högst 5 MB.");
        }

        var extension = await DetectImageExtensionAsync(image, cancellationToken);
        if (extension is null)
        {
            return Validation("Filen är inte en giltig JPG-, PNG- eller WebP-bild.");
        }

        var challenge = await FindChallengeAsync(challengeId, cancellationToken);
        if (challenge is null)
        {
            return new(ChallengeImageOperationStatus.NotFound);
        }

        if (!challenge.Game.Type.SupportsChallengeImages())
        {
            return Validation("Den här speltypen använder inte bilder.");
        }

        var previousImagePath = challenge.ImagePath;
        string newImagePath;
        await using (var source = image.OpenReadStream())
        {
            newImagePath = await store.SaveAsync(source, extension, cancellationToken);
        }

        try
        {
            challenge.ImagePath = newImagePath;
            AddAudit(actor, "uploaded-image", challenge, "Uploaded or replaced a challenge image.");
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await store.DeleteAsync(newImagePath, CancellationToken.None);
            throw;
        }

        // The database mutation has committed. File cleanup is intentionally
        // independent of a disconnected request; any failure leaves a safe
        // orphan that the cleanup preview can find later.
        await DeleteIfUnreferencedAsync(previousImagePath, CancellationToken.None);
        return new(
            ChallengeImageOperationStatus.Success,
            new ChallengeImageMutation(challenge.ImagePath, challenge.IsEnabled));
    }

    public async Task<ChallengeImageOperationResult> RemoveAsync(
        Guid challengeId,
        string actor,
        CancellationToken cancellationToken)
    {
        if (!UploadsEnabled())
        {
            return UploadsDisabled();
        }

        var challenge = await FindChallengeAsync(challengeId, cancellationToken);
        if (challenge is null)
        {
            return new(ChallengeImageOperationStatus.NotFound);
        }

        if (!challenge.Game.Type.SupportsChallengeImages())
        {
            return Validation("Den här speltypen använder inte bilder.");
        }

        if (challenge.ImagePath is null)
        {
            return new(
                ChallengeImageOperationStatus.Success,
                new ChallengeImageMutation(null, challenge.IsEnabled));
        }

        if (challenge.Game.Type.RequiresChallengeImages())
        {
            var hasAnotherPlayableChallenge = await db.Challenges.AnyAsync(
                candidate =>
                    candidate.GameId == challenge.GameId &&
                    candidate.Id != challenge.Id &&
                    candidate.IsActive &&
                    candidate.IsEnabled &&
                    candidate.ImagePath != null,
                cancellationToken);
            if (!hasAnotherPlayableChallenge)
            {
                return Validation(
                    "Bilden krävs för Pixeljakten. Aktivera först en annan bildfråga eller byt bilden i stället.");
            }

            challenge.IsEnabled = false;
        }

        var previousImagePath = challenge.ImagePath;
        challenge.ImagePath = null;
        AddAudit(actor, "removed-image", challenge, "Removed a challenge image reference.");
        await db.SaveChangesAsync(cancellationToken);
        await DeleteIfUnreferencedAsync(previousImagePath, CancellationToken.None);

        return new(
            ChallengeImageOperationStatus.Success,
            new ChallengeImageMutation(null, challenge.IsEnabled));
    }

    public async Task DeleteIfUnreferencedAsync(
        string? imagePath,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(imagePath))
        {
            return;
        }

        var isReferenced = await db.Challenges.AsNoTracking()
            .AnyAsync(challenge => challenge.ImagePath == imagePath, cancellationToken);
        if (!isReferenced)
        {
            await store.DeleteAsync(imagePath, cancellationToken);
        }
    }

    public async Task<ImageCleanupReport> CleanupAsync(
        bool dryRun,
        string actor,
        CancellationToken cancellationToken)
    {
        var referencedPaths = await db.Challenges.AsNoTracking()
            .Where(challenge => challenge.ImagePath != null)
            .Select(challenge => challenge.ImagePath!)
            .ToHashSetAsync(cancellationToken);
        var storedImages = await store.ListAsync(cancellationToken);
        var candidates = storedImages
            .Where(image => !referencedPaths.Contains(image.ImagePath))
            .ToArray();

        var files = new List<ImageCleanupFile>(candidates.Length);
        var deletedCount = 0;
        var skippedCount = 0;
        foreach (var candidate in candidates)
        {
            var deleted = false;
            if (!dryRun)
            {
                // Re-check immediately before deletion so a concurrently saved
                // reference can never be removed based on a stale preview.
                var becameReferenced = await db.Challenges.AsNoTracking().AnyAsync(
                    challenge => challenge.ImagePath == candidate.ImagePath,
                    cancellationToken);
                if (!becameReferenced)
                {
                    deleted = await store.DeleteAsync(candidate.ImagePath, cancellationToken);
                }

                if (deleted) deletedCount++;
                else skippedCount++;
            }

            files.Add(new ImageCleanupFile(candidate.ImagePath, candidate.SizeBytes, deleted));
        }

        if (!dryRun && candidates.Length > 0)
        {
            db.AuditEntries.Add(new AuditEntry
            {
                OccurredAtUtc = timeProvider.GetUtcNow(),
                Actor = actor,
                Action = "cleaned-images",
                EntityType = "uploads",
                EntityId = "challenge-images",
                Summary = $"Deleted {deletedCount} unused challenge image(s); skipped {skippedCount}."
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        return new ImageCleanupReport(
            dryRun,
            candidates.Length,
            deletedCount,
            skippedCount,
            candidates.Sum(candidate => candidate.SizeBytes),
            files);
    }

    private bool UploadsEnabled() =>
        configuration.GetValue("Features:ChallengeImageUploads", true);

    private Task<Challenge?> FindChallengeAsync(Guid challengeId, CancellationToken cancellationToken) =>
        db.Challenges
            .Include(candidate => candidate.Game)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == challengeId && candidate.IsActive,
                cancellationToken);

    private void AddAudit(string actor, string action, Challenge challenge, string summary) =>
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = actor,
            Action = action,
            EntityType = "challenge",
            EntityId = challenge.Id.ToString(),
            Summary = summary
        });

    private static ChallengeImageOperationResult Validation(string error) =>
        new(ChallengeImageOperationStatus.ValidationFailed, Error: error);

    private static ChallengeImageOperationResult UploadsDisabled() =>
        new(
            ChallengeImageOperationStatus.UploadsDisabled,
            Error: "Onlineversionen använder permanenta demobilder. Bildändringar kräver beständig fillagring.");

    private static async Task<string?> DetectImageExtensionAsync(
        IFormFile image,
        CancellationToken cancellationToken)
    {
        var header = new byte[12];
        await using var stream = image.OpenReadStream();
        var bytesRead = await stream.ReadAsync(header, cancellationToken);

        if (bytesRead >= 8 && header.AsSpan(0, 8).SequenceEqual(
                new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
        {
            return ".png";
        }

        if (bytesRead >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff)
        {
            return ".jpg";
        }

        if (bytesRead >= 12 &&
            header.AsSpan(0, 4).SequenceEqual("RIFF"u8) &&
            header.AsSpan(8, 4).SequenceEqual("WEBP"u8))
        {
            return ".webp";
        }

        return null;
    }
}
