using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin")
            .RequireAuthorization()
            .WithTags("Administration");

        group.MapGet("/games", GetGamesAsync);
        group.MapPut("/games/{gameId:guid}", UpdateGameAsync)
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));
        group.MapPost("/games/{gameId:guid}/challenges", AddChallengeAsync)
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
            .Include(candidate => candidate.Challenges.Where(challenge => challenge.IsActive))
                .ThenInclude(challenge => challenge.Options)
            .SingleOrDefaultAsync(candidate => candidate.Id == gameId, cancellationToken);
        if (game is null)
        {
            return Results.NotFound();
        }

        var validationErrors = Validate(request, game);
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
            challenge.TimeLimitSeconds = challengeUpdate.TimeLimitSeconds;
            foreach (var optionUpdate in challengeUpdate.Options)
            {
                var option = challenge.Options.Single(candidate => candidate.Id == optionUpdate.Id);
                option.Text = optionUpdate.Text.Trim();
                option.IsCorrect = optionUpdate.IsCorrect;
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

    private static async Task<IResult> AddChallengeAsync(
        Guid gameId,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var game = await db.Games
            .SingleOrDefaultAsync(candidate => candidate.Id == gameId, cancellationToken);
        if (game is null)
        {
            return Results.NotFound();
        }

        var highestSortOrder = await db.Challenges
            .Where(candidate => candidate.GameId == game.Id && candidate.IsActive)
            .MaxAsync(candidate => (int?)candidate.SortOrder, cancellationToken) ?? 0;
        var challenge = new Challenge
        {
            GameId = game.Id,
            Prompt = "Ny fråga",
            SortOrder = highestSortOrder + 1,
            Options =
            [
                new ChallengeOption { Text = "Svarsalternativ A", SortOrder = 1, IsCorrect = true },
                new ChallengeOption { Text = "Svarsalternativ B", SortOrder = 2 },
                new ChallengeOption { Text = "Svarsalternativ C", SortOrder = 3 },
                new ChallengeOption { Text = "Svarsalternativ D", SortOrder = 4 }
            ]
        };

        db.Challenges.Add(challenge);
        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = timeProvider.GetUtcNow(),
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "created",
            EntityType = "challenge",
            EntityId = challenge.Id.ToString(),
            Summary = $"Added a new challenge to game '{game.Title}'."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/admin/challenges/{challenge.Id}", ToAdminChallenge(challenge));
    }

    private static async Task<IResult> DeleteChallengeAsync(
        Guid challengeId,
        ClaimsPrincipal principal,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var challenge = await db.Challenges
            .Include(candidate => candidate.Game)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == challengeId && candidate.IsActive,
                cancellationToken);
        if (challenge is null)
        {
            return Results.NotFound();
        }

        var remainingChallenges = await db.Challenges
            .Where(candidate =>
                candidate.GameId == challenge.GameId &&
                candidate.IsActive &&
                candidate.Id != challenge.Id)
            .OrderBy(candidate => candidate.SortOrder)
            .ToListAsync(cancellationToken);
        if (remainingChallenges.Count == 0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["challenge"] = ["Spelet måste innehålla minst en fråga."]
            });
        }

        var nextChallengeId = await db.Challenges
            .Where(candidate =>
                candidate.IsActive &&
                candidate.Id != challenge.Id &&
                candidate.Game.IsActive &&
                (candidate.Game.SortOrder > challenge.Game.SortOrder ||
                 (candidate.GameId == challenge.GameId && candidate.SortOrder > challenge.SortOrder)))
            .OrderBy(candidate => candidate.Game.SortOrder)
            .ThenBy(candidate => candidate.SortOrder)
            .Select(candidate => (Guid?)candidate.Id)
            .FirstOrDefaultAsync(cancellationToken);

        challenge.IsActive = false;
        for (var index = 0; index < remainingChallenges.Count; index++)
        {
            remainingChallenges[index].SortOrder = index + 1;
        }

        var affectedSessions = await db.GameSessions
            .Where(session =>
                session.Status == SessionStatus.InProgress &&
                session.CurrentChallengeId == challenge.Id)
            .ToListAsync(cancellationToken);
        var now = timeProvider.GetUtcNow();
        foreach (var session in affectedSessions)
        {
            session.CurrentChallengeId = nextChallengeId;
            session.CurrentChallengeStartedAtUtc = nextChallengeId is null ? null : now;
            if (nextChallengeId is null)
            {
                session.Status = SessionStatus.Completed;
                session.CompletedAtUtc = now;
            }
        }

        db.AuditEntries.Add(new AuditEntry
        {
            OccurredAtUtc = now,
            Actor = principal.Identity?.Name ?? "unknown",
            Action = "deleted",
            EntityType = "challenge",
            EntityId = challenge.Id.ToString(),
            Summary = $"Removed challenge '{challenge.Prompt}' from game '{challenge.Game.Title}'."
        });
        await db.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

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

    private static Dictionary<string, string[]> Validate(UpdateGameRequest request, Game game)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 160)
        {
            errors["title"] = ["Titeln måste innehålla mellan 1 och 160 tecken."];
        }

        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Length > 500)
        {
            errors["summary"] = ["Sammanfattningen måste innehålla mellan 1 och 500 tecken."];
        }

        if (request.DefaultTimeLimitSeconds is < 5 or > 900)
        {
            errors["defaultTimeLimitSeconds"] = ["Tidsgränsen måste vara mellan 5 och 900 sekunder."];
        }

        if (request.Challenges.Count != game.Challenges.Count ||
            request.Challenges.Any(update => game.Challenges.All(challenge => challenge.Id != update.Id)))
        {
            errors["challenges"] = ["Uppdragslistan matchar inte spelets befintliga uppdrag."];
            return errors;
        }

        foreach (var update in request.Challenges)
        {
            var challenge = game.Challenges.Single(candidate => candidate.Id == update.Id);
            if (string.IsNullOrWhiteSpace(update.Prompt) || update.Prompt.Length > 1200)
            {
                errors[$"challenges.{update.Id}.prompt"] = ["Instruktionen måste innehålla mellan 1 och 1200 tecken."];
            }

            if (update.TimeLimitSeconds is < 5 or > 900)
            {
                errors[$"challenges.{update.Id}.timeLimitSeconds"] = ["Frågans tidsgräns måste vara mellan 5 och 900 sekunder."];
            }

            if (update.Options.Count != challenge.Options.Count ||
                update.Options.Any(option => challenge.Options.All(existing => existing.Id != option.Id)))
            {
                errors[$"challenges.{update.Id}.options"] = ["Svarsalternativen matchar inte de befintliga alternativen."];
                continue;
            }

            if (update.Options.Count(option => option.IsCorrect) != 1)
            {
                errors[$"challenges.{update.Id}.correctAnswer"] = ["Exakt ett svar måste vara markerat som korrekt."];
            }

            if (update.Options.Any(option =>
                    string.IsNullOrWhiteSpace(option.Text) || option.Text.Length > 500))
            {
                errors[$"challenges.{update.Id}.optionText"] = ["Svarsalternativ måste innehålla mellan 1 och 500 tecken."];
            }
        }

        return errors;
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
        options = challenge.Options.OrderBy(option => option.SortOrder).Select(option => new
        {
            option.Id,
            option.Text,
            option.SortOrder,
            option.IsCorrect
        })
    };

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
        int? TimeLimitSeconds,
        List<UpdateOptionRequest> Options);

    public sealed record UpdateOptionRequest(Guid Id, string Text, bool IsCorrect);
}
