using System.Globalization;
using System.Net;
using System.Threading.RateLimiting;
using EscapeRoom.Api.Features.Admin;
using EscapeRoom.Api.Features.Auth;
using EscapeRoom.Api.Features.Games;
using EscapeRoom.Api.Features.Sessions;
using EscapeRoom.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
DeploymentSecurity.LoadFileSecrets(builder.Configuration);
var deploymentSecurity = DeploymentSecurity.ReadAndValidate(
    builder.Configuration,
    builder.Environment);
var cookieSecurePolicy = deploymentSecurity.SecureCookies
    ? CookieSecurePolicy.Always
    : CookieSecurePolicy.SameAsRequest;

var connectionString = DeploymentSecurity.ResolveDatabaseConnectionString(builder.Configuration);

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<DatabaseInitializer>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<SessionProgressService>();
builder.Services.AddScoped<CurrentChallengeResponseBuilder>();
builder.Services.AddScoped<SessionRetentionService>();
builder.Services.AddHostedService<SessionRetentionWorker>();
builder.Services.AddOptions<ExperienceOptions>()
    .BindConfiguration("Experience")
    .Validate(
        options => Enum.IsDefined(options.Mode),
        "Experience:Mode must be Event or Demo.")
    .ValidateOnStart();
builder.Services.AddOptions<DataRetentionOptions>()
    .BindConfiguration("DataRetention")
    .Validate(
        options => options.RetentionDays is >= 1 and <= 3650,
        "DataRetention:RetentionDays must be between 1 and 3650.")
    .Validate(
        options => options.CleanupIntervalHours is >= 1 and <= 168,
        "DataRetention:CleanupIntervalHours must be between 1 and 168.")
    .ValidateOnStart();

var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
var dataProtection = builder.Services
    .AddDataProtection()
    .SetApplicationName("TrafikverketEscapeRoom");
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
}

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "trv-admin-session-v2";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = cookieSecurePolicy;
        options.ExpireTimeSpan = TimeSpan.FromHours(2);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(
        builder.Configuration.GetValue("Security:HstsMaxAgeDays", 30));
    options.IncludeSubDomains = builder.Configuration.GetValue(
        "Security:HstsIncludeSubDomains",
        false);
    options.Preload = false;
});
builder.Services.AddHttpsRedirection(options =>
{
    options.HttpsPort = 443;
    options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
});
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "trv-antiforgery-v2";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = cookieSecurePolicy;
});

builder.Services.AddRateLimiter(options =>
{
    var loginPermitLimit = builder.Configuration.GetValue("RateLimiting:LoginPermitLimit", 8);
    var sessionStartPermitLimit = builder.Configuration.GetValue(
        "RateLimiting:SessionStartPermitLimit",
        5);
    var sessionStartWindowSeconds = builder.Configuration.GetValue(
        "RateLimiting:SessionStartWindowSeconds",
        60);
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds)
                .ToString(CultureInfo.InvariantCulture);
        }

        await context.HttpContext.Response.WriteAsJsonAsync(
            new
            {
                title = "För många försök",
                detail = "Vänta en kort stund och försök igen.",
                status = StatusCodes.Status429TooManyRequests
            },
            cancellationToken);
    };
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "local",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = loginPermitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    options.AddPolicy("session-start", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "local",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = sessionStartPermitLimit,
                Window = TimeSpan.FromSeconds(sessionStartWindowSeconds),
                QueueLimit = 0
            }));
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;

    if (deploymentSecurity.KnownProxies.Length == 0)
    {
        return;
    }

    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
    foreach (var proxy in deploymentSecurity.KnownProxies)
    {
        options.KnownProxies.Add(IPAddress.Parse(proxy));
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("development", policy => policy
        .WithOrigins("http://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();
var uploadPath = app.Configuration["Uploads:Path"] ?? Path.Combine(AppContext.BaseDirectory, "uploads");
Directory.CreateDirectory(uploadPath);

app.UseForwardedHeaders();

if (deploymentSecurity.RequireHttps)
{
    app.UseHsts();
    app.UseWhen(
        context => !context.Request.Path.StartsWithSegments("/health"),
        branch => branch.UseHttpsRedirection());
}

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["Permissions-Policy"] =
            "camera=(), microphone=(), geolocation=()";
        context.Response.Headers["Content-Security-Policy"] =
            "default-src 'self'; base-uri 'self'; object-src 'none'; " +
            "frame-ancestors 'none'; form-action 'self'; script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; font-src 'self'; " +
            "img-src 'self' data: blob:; connect-src 'self'; media-src 'none'" +
            (deploymentSecurity.IsPublic ? "; upgrade-insecure-requests" : string.Empty);
        context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
        context.Response.Headers["Cross-Origin-Resource-Policy"] = "same-origin";
        return Task.CompletedTask;
    });
    await next();
});

// Public assets are handled before endpoint routing so a backend catch-all
// cannot shadow an uploaded image or the compiled web application.
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadPath),
    RequestPath = "/uploads"
});

app.UseRouting();

if (app.Environment.IsDevelopment())
{
    app.UseCors("development");
}

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapGet("/health/live", () => Results.Ok(new { status = "healthy" }));
app.MapHealthChecks("/health/ready");

app.MapAuthEndpoints();
app.MapGameEndpoints();
app.MapPrivacyEndpoints();
app.MapSessionEndpoints();
app.MapAdminEndpoints();

// Preserve backend semantics for missing routes. All other non-file routes
// belong to the client-side router and receive the React application shell.
app.Map("/api/{**path}", () => Results.NotFound());
app.Map("/health/{**path}", () => Results.NotFound());
app.Map("/uploads/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

if (!app.Environment.IsEnvironment("Testing"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitialiseAsync();
}

app.Run();

public partial class Program;
