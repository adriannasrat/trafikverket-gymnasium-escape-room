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
        ChallengeImageService imageService,
        CancellationToken cancellationToken)
    {
        var result = await imageService.UploadAsync(
            challengeId,
            image,
            principal.Identity?.Name ?? "unknown",
            cancellationToken);
        return ToImageResult(result);
    }

    private static async Task<IResult> RemoveChallengeImageAsync(
        Guid challengeId,
        ClaimsPrincipal principal,
        ChallengeImageService imageService,
        CancellationToken cancellationToken)
    {
        var result = await imageService.RemoveAsync(
            challengeId,
            principal.Identity?.Name ?? "unknown",
            cancellationToken);
        return ToImageResult(result);
    }

    private static async Task<IResult> PreviewUnusedImagesAsync(
        ClaimsPrincipal principal,
        ChallengeImageService imageService,
        CancellationToken cancellationToken) =>
        Results.Ok(await imageService.CleanupAsync(
            dryRun: true,
            principal.Identity?.Name ?? "unknown",
            cancellationToken));

    private static async Task<IResult> CleanupUnusedImagesAsync(
        ClaimsPrincipal principal,
        ChallengeImageService imageService,
        CancellationToken cancellationToken) =>
        Results.Ok(await imageService.CleanupAsync(
            dryRun: false,
            principal.Identity?.Name ?? "unknown",
            cancellationToken));

    private static IResult ToImageResult(ChallengeImageOperationResult result) =>
        result.Status switch
        {
            ChallengeImageOperationStatus.Success => Results.Ok(result.Mutation),
            ChallengeImageOperationStatus.NotFound => Results.NotFound(),
            ChallengeImageOperationStatus.UploadsDisabled => Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Bildändringar är avstängda",
                detail: result.Error),
            _ => Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["image"] = [result.Error ?? "Bilden kunde inte hanteras."]
            })
        };
}

