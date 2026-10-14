using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EscapeRoom.Api.Tests;

public sealed class AdminAuthenticationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ConfiguredCredentialsReplaceStaleAdminCredentialsAndCanLogIn()
    {
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.AdminUsers.SingleAsync();
            user.Username = "old-admin";
            user.PasswordHash = new PasswordHasher<AdminUser>()
                .HashPassword(user, "an-old-password");
            user.FailedLoginCount = 4;
            user.LockoutEndUtc = DateTimeOffset.UtcNow.AddMinutes(15);
            await db.SaveChangesAsync();

            await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>()
                .SeedForTestsAsync();
        }

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.AdminUsers.SingleAsync();
            Assert.Equal("event-admin", user.Username);
            Assert.Equal(0, user.FailedLoginCount);
            Assert.Null(user.LockoutEndUtc);
        }

        using var client = factory.CreateClient();
        var anonymousSession = await client.GetFromJsonAsync<AuthStatusResponse>("/api/auth/me");
        Assert.NotNull(anonymousSession);
        Assert.False(anonymousSession.Authenticated);
        Assert.Null(anonymousSession.Username);

        var anonymousAuditResponse = await client.GetAsync("/api/admin/audit");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousAuditResponse.StatusCode);

        var antiforgery = await client.GetFromJsonAsync<AntiforgeryResponse>("/api/auth/csrf");
        Assert.NotNull(antiforgery);

        using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new
            {
                username = "event-admin",
                password = "a-long-test-password"
            })
        };
        loginRequest.Headers.Add("X-CSRF-TOKEN", antiforgery.Token);

        var loginResponse = await client.SendAsync(loginRequest);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var authenticatedSession = await client.GetFromJsonAsync<AuthStatusResponse>("/api/auth/me");
        Assert.NotNull(authenticatedSession);
        Assert.True(authenticatedSession.Authenticated);
        Assert.Equal("event-admin", authenticatedSession.Username);

        var auditResponse = await client.GetAsync("/api/admin/audit");
        Assert.Equal(HttpStatusCode.OK, auditResponse.StatusCode);
    }

    [Fact]
    public async Task HostedAuthenticationCookiesAreSecureHttpOnlyAndStrict()
    {
        using var hostedFactory = factory.WithWebHostBuilder(builder =>
            builder.UseSetting("Security:SecureCookies", "true"));
        using var client = hostedFactory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost")
            });

        var antiforgeryResponse = await client.GetAsync("/api/auth/csrf");
        antiforgeryResponse.EnsureSuccessStatusCode();
        AssertCookieIsHardened(antiforgeryResponse, "trv-antiforgery-v2");
        var antiforgery = await antiforgeryResponse.Content
            .ReadFromJsonAsync<AntiforgeryResponse>();
        Assert.NotNull(antiforgery);

        using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new
            {
                username = "event-admin",
                password = "a-long-test-password"
            })
        };
        loginRequest.Headers.Add("X-CSRF-TOKEN", antiforgery.Token);

        var loginResponse = await client.SendAsync(loginRequest);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        AssertCookieIsHardened(loginResponse, "trv-admin-session-v2");
    }

    private static void AssertCookieIsHardened(
        HttpResponseMessage response,
        string cookieName)
    {
        var cookie = Assert.Single(
            response.Headers.GetValues("Set-Cookie"),
            value => value.StartsWith($"{cookieName}=", StringComparison.Ordinal));
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
    }

    private sealed record AntiforgeryResponse(string Token);
    private sealed record AuthStatusResponse(bool Authenticated, string? Username);
}
