using EscapeRoom.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Games;

public static class GameEndpoints
{
    public static IEndpointRouteBuilder MapGameEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/games", async (AppDbContext db, CancellationToken cancellationToken) =>
        {
            var games = await db.Games
                .AsNoTracking()
                .Where(game => game.IsActive)
                .OrderBy(game => game.SortOrder)
                .Select(game => new
                {
                    game.Id,
                    game.Slug,
                    game.Title,
                    game.Summary,
                    game.SortOrder,
                    type = game.Type.ToString()
                })
                .ToListAsync(cancellationToken);

            return Results.Ok(games);
        }).WithTags("Games");

        return endpoints;
    }
}
