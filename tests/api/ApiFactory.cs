using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace EscapeRoom.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"escape-room-tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Database", "Host=localhost;Database=tests;Username=tests;Password=tests");
        builder.UseSetting("Admin:Username", "event-admin");
        builder.UseSetting("Admin:Password", "a-long-test-password");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(databaseName));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<DatabaseInitializer>()
            .SeedForTestsAsync()
            .GetAwaiter()
            .GetResult();
        return host;
    }
}
