using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    private static async Task<IResult> GetAuditAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var entries = await db.AuditEntries.AsNoTracking()
            .OrderByDescending(entry => entry.OccurredAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);
        return Results.Ok(entries);
    }

    private static async Task<IResult> UploadChallengeImageAsync(
        Guid challengeId,
        IFormFile image,
        ClaimsPrincipal principal,
        AppDbContext db,
        IConfiguration configuration,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        const long maximumBytes = 5 * 1024 * 1024;
        if (image.Length is <= 0 or > maximumBytes)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["image"] = ["Bilden måste vara JPG, PNG eller WebP och högst 5 MB."]
            });
        }

        var extension = await DetectImageExtensionAsync(image, cancellationToken);
        if (extension is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["image"] = ["Filen är inte en giltig JPG-, PNG- eller WebP-bild."]
            });
        }

        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == challengeId && candidate.IsActive,
                cancellationToken);
        if (challenge is null)
        {
            return Results.NotFound();
        }

        if (!challenge.Game.Type.SupportsChallengeImages())
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["image"] = ["Den här speltypen använder inte bilder."]
            });
        }

        var uploadPath = configuration["Uploads:Path"] ?? Path.Combine(AppContext.BaseDirectory, "uploads");
        Directory.CreateDirectory(uploadPath);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var destination = Path.Combine(uploadPath, fileName);
        try
        {
            await using (var stream = File.Create(destination))
            {
                await image.CopyToAsync(stream, cancellationToken);
            }

            challenge.ImagePath = $"/uploads/{fileName}";
            db.AuditEntries.Add(new AuditEntry
            {
                OccurredAtUtc = timeProvider.GetUtcNow(),
                Actor = principal.Identity?.Name ?? "unknown",
                Action = "uploaded-image",
                EntityType = "challenge",
                EntityId = challenge.Id.ToString(),
                Summary = "Uploaded a new challenge image."
            });
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            File.Delete(destination);
            throw;
        }

        return Results.Ok(new { challenge.ImagePath });
    }

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

