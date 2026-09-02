using System.Security.Claims;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EscapeRoom.Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/auth").WithTags("Authentication");

        group.MapGet("/csrf", (HttpContext context, IAntiforgery antiforgery) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Ok(new { token = tokens.RequestToken });
        });

        group.MapPost("/login", LoginAsync)
            .RequireRateLimiting("login")
            .WithMetadata(new RequireAntiforgeryTokenAttribute(true));

        group.MapPost("/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        }).RequireAuthorization().WithMetadata(new RequireAntiforgeryTokenAttribute(true));

        group.MapGet("/me", (ClaimsPrincipal user) =>
            Results.Ok(new { username = user.Identity?.Name }))
            .RequireAuthorization();

        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        HttpContext context,
        AppDbContext db,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var normalizedUsername = request.Username.Trim();
        var user = await db.AdminUsers.SingleOrDefaultAsync(
            candidate => candidate.Username == normalizedUsername,
            cancellationToken);

        var now = timeProvider.GetUtcNow();
        if (user is null || user.LockoutEndUtc > now)
        {
            return Results.Json(
                new { message = "Fel användarnamn eller lösenord." },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var verification = new PasswordHasher<AdminUser>()
            .VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount += 1;
            if (user.FailedLoginCount >= 5)
            {
                user.LockoutEndUtc = now.AddMinutes(15);
                user.FailedLoginCount = 0;
            }

            await db.SaveChangesAsync(cancellationToken);
            return Results.Json(
                new { message = "Fel användarnamn eller lösenord." },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        user.FailedLoginCount = 0;
        user.LockoutEndUtc = null;
        user.LastLoginAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, "Administrator")
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));

        return Results.Ok(new { username = user.Username });
    }

    public sealed record LoginRequest(string Username, string Password);
}
