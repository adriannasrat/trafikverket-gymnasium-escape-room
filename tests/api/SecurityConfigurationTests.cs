using System.Net;
using System.Net.Http.Json;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace EscapeRoom.Api.Tests;

public sealed class SecurityConfigurationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public void NeonPostgresUrlIsConvertedToSecureNpgsqlConnectionString()
    {
        var configuration = new ConfigurationManager();
        configuration["ConnectionStrings:Database"] =
            "postgresql://demo_user:a%2Flong-demo-password@ep-demo-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

        var connectionString = DeploymentSecurity.ResolveDatabaseConnectionString(configuration);
        var parsed = new NpgsqlConnectionStringBuilder(connectionString);

        Assert.Equal("ep-demo-pooler.eu-central-1.aws.neon.tech", parsed.Host);
        Assert.Equal("demo_user", parsed.Username);
        Assert.Equal("a/long-demo-password", parsed.Password);
        Assert.Equal("neondb", parsed.Database);
        Assert.Equal(SslMode.Require, parsed.SslMode);
        Assert.Equal(10, parsed.MaxPoolSize);
    }

    [Fact]
    public void NeonEnvironmentUsesPooledTrafficAndDirectMigrations()
    {
        var configuration = new ConfigurationManager
        {
            ["DATABASE_URL"] =
                "postgresql://demo:a-long-demo-password@ep-demo-pooler.neon.tech/neondb?sslmode=require",
            ["DATABASE_URL_UNPOOLED"] =
                "postgresql://demo:a-long-demo-password@ep-demo.neon.tech/neondb?sslmode=require"
        };

        var applicationConnection = new NpgsqlConnectionStringBuilder(
            DeploymentSecurity.ResolveDatabaseConnectionString(configuration));
        var migrationConnection = new NpgsqlConnectionStringBuilder(
            DeploymentSecurity.ResolveMigrationDatabaseConnectionString(configuration));

        Assert.Equal("ep-demo-pooler.neon.tech", applicationConnection.Host);
        Assert.Equal("ep-demo.neon.tech", migrationConnection.Host);
        Assert.Equal(SslMode.Require, applicationConnection.SslMode);
        Assert.Equal(SslMode.Require, migrationConnection.SslMode);
    }

    [Fact]
    public void DatabaseDataProtectionKeysSurviveServiceProviderRestart()
    {
        var databaseRoot = new InMemoryDatabaseRoot();
        using var firstProvider = CreateDataProtectionServiceProvider(databaseRoot);
        var protectedValue = firstProvider
            .GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("restart-test")
            .Protect("admin-session");

        using var restartedProvider = CreateDataProtectionServiceProvider(databaseRoot);
        var unprotectedValue = restartedProvider
            .GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("restart-test")
            .Unprotect(protectedValue);

        Assert.Equal("admin-session", unprotectedValue);
    }

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
    public async Task RenderDeploymentPersistsDataProtectionKeysInDatabase()
    {
        using var renderFactory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Deployment:Public", "true");
            builder.UseSetting("Deployment:PublicDomain", "escape-room.onrender.com");
            builder.UseSetting("AllowedHosts", "escape-room.onrender.com");
            builder.UseSetting("Security:SecureCookies", "true");
            builder.UseSetting("Security:RequireHttps", "true");
            builder.UseSetting("DataProtection:PersistKeysToDatabase", "true");
            builder.UseSetting("ReverseProxy:Mode", "Render");
            builder.UseSetting(
                "ConnectionStrings:Database",
                "postgresql://demo:a-long-test-database-password@db.example/neondb?sslmode=require");
        });
        using var client = renderFactory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                BaseAddress = new Uri("http://escape-room.onrender.com")
            });
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.10");

        var response = await client.GetAsync("/api/auth/csrf");

        response.EnsureSuccessStatusCode();
        Assert.Contains(
            "max-age=2592000",
            GetSingleHeader(response, "Strict-Transport-Security"));
        Assert.Contains(
            response.Headers.GetValues("Set-Cookie"),
            cookie => cookie.Contains("secure", StringComparison.OrdinalIgnoreCase));
        using var scope = renderFactory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.DataProtectionKeys.AnyAsync());
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

    private static ServiceProvider CreateDataProtectionServiceProvider(
        InMemoryDatabaseRoot databaseRoot)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(
            "data-protection-restart-test",
            databaseRoot));
        services
            .AddDataProtection()
            .SetApplicationName("TrafikverketEscapeRoomTests")
            .PersistKeysToDbContext<AppDbContext>();
        return services.BuildServiceProvider();
    }
}
