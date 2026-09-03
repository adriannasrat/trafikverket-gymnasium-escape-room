using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Domain;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;
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

        var meResponse = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
    }

    private sealed record AntiforgeryResponse(string Token);
}
