using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EscapeRoom.Api.Tests;

public sealed class SecurityConfigurationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ResponsesIncludeSecurityHeadersAndCompatibleContentSecurityPolicy()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/live");

        response.EnsureSuccessStatusCode();
        Assert.Equal("nosniff", GetSingleHeader(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", GetSingleHeader(response, "X-Frame-Options"));
        Assert.Equal("same-origin", GetSingleHeader(response, "Cross-Origin-Opener-Policy"));
        Assert.Equal("same-origin", GetSingleHeader(response, "Cross-Origin-Resource-Policy"));

        var contentSecurityPolicy = GetSingleHeader(response, "Content-Security-Policy");
        Assert.Contains("default-src 'self'", contentSecurityPolicy);
        Assert.Contains("object-src 'none'", contentSecurityPolicy);
        Assert.Contains("frame-ancestors 'none'", contentSecurityPolicy);
        Assert.Contains("connect-src 'self'", contentSecurityPolicy);
        Assert.Contains("img-src 'self' data: blob:", contentSecurityPolicy);
    }

    [Fact]
    public async Task PublicDeploymentRedirectsToHttpsAndAddsHsts()
    {
        var keysPath = Path.Combine(
            Path.GetTempPath(),
            $"escape-room-security-test-{Guid.NewGuid():N}");

        try
        {
            using var publicFactory = factory.WithWebHostBuilder(builder =>
            {
                builder.UseSetting("Deployment:Public", "true");
                builder.UseSetting("Deployment:PublicDomain", "test.example");
                builder.UseSetting("AllowedHosts", "test.example");
                builder.UseSetting("Security:SecureCookies", "true");
                builder.UseSetting("Security:RequireHttps", "true");
                builder.UseSetting("DataProtection:KeysPath", keysPath);
                builder.UseSetting("ReverseProxy:KnownProxies:0", "127.0.0.1");
                builder.UseSetting(
                    "ConnectionStrings:Database",
                    "Host=localhost;Database=tests;Username=tests;Password=a-long-test-database-password");
            });

            using var httpClient = publicFactory.CreateClient(
                new WebApplicationFactoryClientOptions
                {
                    AllowAutoRedirect = false,
                    BaseAddress = new Uri("http://test.example")
                });
            var redirect = await httpClient.GetAsync("/api/auth/me");

            Assert.Equal(HttpStatusCode.PermanentRedirect, redirect.StatusCode);
            Assert.Equal(
                new Uri("https://test.example/api/auth/me"),
                redirect.Headers.Location);

            using var httpsClient = publicFactory.CreateClient(
                new WebApplicationFactoryClientOptions
                {
                    BaseAddress = new Uri("https://test.example")
                });
            var secureResponse = await httpsClient.GetAsync("/health/live");

            secureResponse.EnsureSuccessStatusCode();
            Assert.Contains(
                "max-age=2592000",
                GetSingleHeader(secureResponse, "Strict-Transport-Security"));
            Assert.Contains(
                "upgrade-insecure-requests",
                GetSingleHeader(secureResponse, "Content-Security-Policy"));
        }
        finally
        {
            if (Directory.Exists(keysPath))
            {
                Directory.Delete(keysPath, recursive: true);
            }
        }
    }

    [Fact]
    public async Task StartingTooManySessionsFromOneAddressIsRateLimited()
    {
        using var limitedFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:SessionStartPermitLimit", "1");
            builder.UseSetting("RateLimiting:SessionStartWindowSeconds", "60");
        });
        using var client = limitedFactory.CreateClient();

        var first = await client.PostAsJsonAsync(
            "/api/sessions/",
            new { playerName = "Första spelaren" });
        var second = await client.PostAsJsonAsync(
            "/api/sessions/",
            new { playerName = "Andra spelaren" });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
        Assert.True(second.Headers.Contains("Retry-After"));
        Assert.Contains("För många försök", await second.Content.ReadAsStringAsync());
    }

    private static string GetSingleHeader(HttpResponseMessage response, string name) =>
        Assert.Single(response.Headers.GetValues(name));
}
