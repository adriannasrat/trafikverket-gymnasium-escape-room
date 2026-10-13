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
        var allowedTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp"
        };
        if (image.Length is <= 0 or > maximumBytes || !allowedTypes.TryGetValue(image.ContentType, out var extension))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["image"] = ["Bilden måste vara JPG, PNG eller WebP och högst 5 MB."]
            });
        }

        var challenge = await db.Challenges.SingleOrDefaultAsync(
            candidate => candidate.Id == challengeId && candidate.IsActive,
            cancellationToken);
        if (challenge is null)
        {
            return Results.NotFound();
        }

        var uploadPath = configuration["Uploads:Path"] ?? Path.Combine(AppContext.BaseDirectory, "uploads");
        Directory.CreateDirectory(uploadPath);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var destination = Path.Combine(uploadPath, fileName);
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
        return Results.Ok(new { challenge.ImagePath });
    }
}

