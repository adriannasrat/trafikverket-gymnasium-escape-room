using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static partial class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin")
            .RequireAuthorization()
            .WithTags("Administration");

        group.MapGet("/games", GetGamesAsync);
        group.MapGet("/results", GetResultsAsync);
        group.MapDelete("/results/{sessionId:guid}", DeleteResultAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapDelete("/results", DeleteAllResultsAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPut("/games/{gameId:guid}", UpdateGameAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPost("/games/{gameId:guid}/challenges", AddChallengeAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPost("/games/{gameId:guid}/matching-destinations", AddMatchingDestinationAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapDelete("/games/{gameId:guid}/matching-destinations/{sortOrder:int}", DeleteMatchingDestinationAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPost("/challenges/{challengeId:guid}/sorting-cards", AddSortingCardAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapDelete("/challenges/{challengeId:guid}/sorting-cards/{optionId:guid}", DeleteSortingCardAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPost("/challenges/{challengeId:guid}/word-parts", AddWordPartAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapDelete("/challenges/{challengeId:guid}/word-parts/{optionId:guid}", DeleteWordPartAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapDelete("/challenges/{challengeId:guid}", DeleteChallengeAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPost("/challenges/{challengeId:guid}/image", UploadChallengeImageAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapGet("/audit", GetAuditAsync);
        return endpoints;
    }

    private static async Task<IResult> GetGamesAsync(
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var games = await db.Games.AsNoTracking()
            .AsSplitQuery()
            .Include(game => game.Challenges.Where(challenge => challenge.IsActive))
                .ThenInclude(challenge => challenge.Options)
            .OrderBy(game => game.SortOrder)
            .ToListAsync(cancellationToken);

        return Results.Ok(games.Select(ToAdminGame));
    }


    private static async Task<IResult> UpdateGameAsync(
        Guid gameId,
        UpdateGameRequest request,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var game = await db.Games
            .AsSplitQuery()
            .Include(candidate => candidate.Challenges.Where(challenge => challenge.IsActive))
                .ThenInclude(challenge => challenge.Options)
            .SingleOrDefaultAsync(candidate => candidate.Id == gameId, cancellationToken);
        if (game is null)
        {
            return Results.NotFound();
        }

        var validationErrors = GameConfigurationValidator.Validate(request, game);
        if (validationErrors.Count > 0)
        {
            return Results.ValidationProblem(validationErrors);
        }

        game.Title = request.Title.Trim();
        game.Summary = request.Summary.Trim();
        game.IsActive = request.IsActive;
        game.DefaultTimeLimitSeconds = request.DefaultTimeLimitSeconds;
        game.SuccessMessage = request.SuccessMessage.Trim();

        foreach (var challengeUpdate in request.Challenges)
        {
            var challenge = game.Challenges.Single(candidate => candidate.Id == challengeUpdate.Id);
            challenge.Prompt = challengeUpdate.Prompt.Trim();
            challenge.SortOrder = challengeUpdate.SortOrder;
            // Administration exposes one timer per game. Clear legacy per-challenge
            // overrides so the saved game value is authoritative for every round.
            challenge.TimeLimitSeconds = null;
            foreach (var optionUpdate in challengeUpdate.Options)
            {
                var option = challenge.Options.Single(candidate => candidate.Id == optionUpdate.Id);
                option.Text = optionUpdate.Text.Trim();
                option.SortOrder = optionUpdate.SortOrder;
                option.IsCorrect = game.Type == GameType.Hangman ? false : optionUpdate.IsCorrect;
                option.SortingCategory = game.Type == GameType.Sorting
                    ? string.IsNullOrWhiteSpace(optionUpdate.SortingCategory)
                        ? null
                        : optionUpdate.SortingCategory.Trim()
                    : null;
                option.MatchingIconKey = game.Type == GameType.Matching
                    ? optionUpdate.MatchingIconKey?.Trim() ?? "map-pin"
                    : null;
            }
        }

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "updated",
            EntityType = "game",
            EntityId = game.Id.ToString(),
            Summary = $"Updated game '{game.Title}' and its challenge configuration."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToAdminGame(game));
    }







    private static object ToAdminGame(Game game) => new
    {
        game.Id,
        game.Slug,
        game.Title,
        game.Summary,
        type = game.Type.ToString(),
        game.SortOrder,
        game.IsActive,
        game.DefaultTimeLimitSeconds,
        game.SuccessMessage,
        supportsChallengeImages = game.Type.SupportsChallengeImages(),
        requiresChallengeImages = game.Type.RequiresChallengeImages(),
        challenges = game.Challenges
            .Where(challenge => challenge.IsActive)
            .OrderBy(challenge => challenge.SortOrder)
            .Select(ToAdminChallenge)
    };

    private static object ToAdminChallenge(Challenge challenge) => new
    {
        challenge.Id,
        challenge.Prompt,
        challenge.ImagePath,
        challenge.SortOrder,
        challenge.TimeLimitSeconds,
        options = challenge.Options.OrderBy(option => option.SortOrder).Select(ToAdminOption)
    };

    private static object ToAdminOption(ChallengeOption option) => new
    {
        option.Id,
        option.Text,
        option.SortOrder,
        option.IsCorrect,
        option.SortingCategory,
        option.MatchingIconKey
    };

    private static long CalculateElapsedMilliseconds(GameSession session)
    {
        var totalMilliseconds = (long)(session.CompletedAtUtc!.Value - session.StartedAtUtc).TotalMilliseconds;
        return Math.Max(0, totalMilliseconds - session.TotalPausedMilliseconds + session.TotalPenaltyMilliseconds);
    }

    public sealed record UpdateGameRequest(
        string Title,
        string Summary,
        bool IsActive,
        int DefaultTimeLimitSeconds,
        string SuccessMessage,
        List<UpdateChallengeRequest> Challenges);

    public sealed record UpdateChallengeRequest(
        Guid Id,
        string Prompt,
        int SortOrder,
        int? TimeLimitSeconds,
        List<UpdateOptionRequest> Options);

    public sealed record UpdateOptionRequest(
        Guid Id,
        string Text,
        int SortOrder,
        bool IsCorrect,
        string? SortingCategory,
        string? MatchingIconKey);
}
