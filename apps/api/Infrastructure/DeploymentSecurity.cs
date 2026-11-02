using System.Net;
using Npgsql;

namespace EscapeRoom.Api.Infrastructure;

public sealed record DeploymentSecuritySettings(
    bool IsPublic,
    bool RequireHttps,
    bool SecureCookies,
    bool PersistDataProtectionKeysToDatabase,
    bool TrustPlatformProxyHeaders,
    string[] KnownProxies);

public static class DeploymentSecurity
{
    public static void LoadFileSecrets(ConfigurationManager configuration)
    {
        LoadFileSecret(configuration, "Admin:Password", "Secrets:AdminPasswordFile");
        LoadFileSecret(configuration, "Database:Password", "Secrets:DatabasePasswordFile");
    }

    public static string ResolveDatabaseConnectionString(IConfiguration configuration)
    {
        var configuredConnectionString = configuration.GetConnectionString("Database");
        if (!string.IsNullOrWhiteSpace(configuredConnectionString))
        {
            return NormalizeDatabaseConnectionString(configuredConnectionString);
        }

        var password = configuration["Database:Password"];
        if (string.IsNullOrEmpty(password))
        {
            throw new InvalidOperationException(
                "Configure ConnectionStrings:Database or a database password file.");
        }

        return new NpgsqlConnectionStringBuilder
        {
            Host = configuration["Database:Host"] ?? "db",
            Port = configuration.GetValue("Database:Port", 5432),
            Database = configuration["Database:Name"] ?? "escape_room",
            Username = configuration["Database:Username"] ?? "escape_room",
            Password = password
        }.ConnectionString;
    }

    public static DeploymentSecuritySettings ReadAndValidate(
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var isPublic = configuration.GetValue("Deployment:Public", false);
        var secureCookies = configuration.GetValue<bool?>("Security:SecureCookies")
            ?? (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"));
        var requireHttps = configuration.GetValue("Security:RequireHttps", isPublic);
        var persistDataProtectionKeysToDatabase = configuration.GetValue(
            "DataProtection:PersistKeysToDatabase",
            false);
        var proxyMode = configuration["ReverseProxy:Mode"] ?? "KnownProxies";
        var trustPlatformProxyHeaders = proxyMode.Equals(
            "Render",
            StringComparison.OrdinalIgnoreCase);
        var knownProxies = configuration
            .GetSection("ReverseProxy:KnownProxies")
            .Get<string[]>() ?? [];

        if (!proxyMode.Equals("KnownProxies", StringComparison.OrdinalIgnoreCase) &&
            !trustPlatformProxyHeaders)
        {
            throw new InvalidOperationException(
                "ReverseProxy:Mode must be KnownProxies or Render.");
        }

        foreach (var proxy in knownProxies)
        {
            if (!IPAddress.TryParse(proxy, out _))
            {
                throw new InvalidOperationException(
                    $"ReverseProxy:KnownProxies contains an invalid IP address: {proxy}");
            }
        }

        if (isPublic)
        {
            ValidatePublicDeployment(
                configuration,
                environment,
                secureCookies,
                requireHttps,
                persistDataProtectionKeysToDatabase,
                trustPlatformProxyHeaders,
                knownProxies);
        }

        return new DeploymentSecuritySettings(
            isPublic,
            requireHttps,
            secureCookies,
            persistDataProtectionKeysToDatabase,
            trustPlatformProxyHeaders,
            knownProxies);
    }

    private static void LoadFileSecret(
        ConfigurationManager configuration,
        string targetKey,
        string fileKey)
    {
        var filePath = configuration[fileKey];
        if (string.IsNullOrWhiteSpace(filePath))
        {
            return;
        }

        if (!File.Exists(filePath))
        {
            throw new InvalidOperationException($"The secret file configured by {fileKey} does not exist.");
        }

        var value = File.ReadAllText(filePath).TrimEnd('\r', '\n');
        if (string.IsNullOrEmpty(value))
        {
            throw new InvalidOperationException($"The secret file configured by {fileKey} is empty.");
        }

        configuration[targetKey] = value;
    }

    private static void ValidatePublicDeployment(
        IConfiguration configuration,
        IHostEnvironment environment,
        bool secureCookies,
        bool requireHttps,
        bool persistDataProtectionKeysToDatabase,
        bool trustPlatformProxyHeaders,
        string[] knownProxies)
    {
        var errors = new List<string>();
        var publicDomain = configuration["Deployment:PublicDomain"];
        var allowedHosts = configuration["AllowedHosts"];
        var adminPassword = configuration["Admin:Password"];
        var databasePassword = ReadDatabasePassword(configuration);

        if (environment.IsDevelopment())
        {
            errors.Add("a public deployment cannot use the Development environment");
        }

        if (!secureCookies)
        {
            errors.Add("Security:SecureCookies must be true");
        }

        if (!requireHttps)
        {
            errors.Add("Security:RequireHttps must be true");
        }

        if (string.IsNullOrWhiteSpace(publicDomain) ||
            Uri.CheckHostName(publicDomain) != UriHostNameType.Dns ||
            publicDomain.Equals("localhost", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Deployment:PublicDomain must contain a public DNS host name without a scheme");
        }

        var allowedHostValues = (allowedHosts ?? string.Empty)
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (allowedHostValues.Length == 0 || allowedHostValues.Contains("*"))
        {
            errors.Add("AllowedHosts must explicitly list the production domain");
        }
        else if (!string.IsNullOrWhiteSpace(publicDomain) &&
                 !allowedHostValues.Contains(publicDomain, StringComparer.OrdinalIgnoreCase))
        {
            errors.Add("AllowedHosts must include Deployment:PublicDomain");
        }

        if (!trustPlatformProxyHeaders && knownProxies.Length == 0)
        {
            errors.Add("at least one trusted ReverseProxy:KnownProxies address is required");
        }

        if (!persistDataProtectionKeysToDatabase &&
            string.IsNullOrWhiteSpace(configuration["DataProtection:KeysPath"]))
        {
            errors.Add(
                "data-protection keys must use persistent database or file-system storage");
        }

        if (string.IsNullOrWhiteSpace(configuration["Admin:Username"]))
        {
            errors.Add("Admin:Username must be configured");
        }

        if (string.IsNullOrEmpty(adminPassword) || adminPassword.Length < 16 ||
            adminPassword.Contains("replace-with", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("the admin password must be a unique secret of at least 16 characters");
        }

        if (string.IsNullOrEmpty(databasePassword) || databasePassword.Length < 16 ||
            databasePassword.Contains("replace-with", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("the database password must be a unique secret of at least 16 characters");
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                "Public deployment configuration is unsafe:" + Environment.NewLine +
                string.Join(Environment.NewLine, errors.Select(error => $"- {error}")));
        }
    }

    private static string? ReadDatabasePassword(IConfiguration configuration)
    {
        if (!string.IsNullOrEmpty(configuration["Database:Password"]))
        {
            return configuration["Database:Password"];
        }

        var connectionString = configuration.GetConnectionString("Database");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        try
        {
            return new NpgsqlConnectionStringBuilder(
                NormalizeDatabaseConnectionString(connectionString)).Password;
        }
        catch (Exception exception) when (
            exception is ArgumentException or FormatException or UriFormatException)
        {
            return null;
        }
    }

    private static string NormalizeDatabaseConnectionString(string connectionString)
    {
        if (!connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return connectionString;
        }

        var uri = new Uri(connectionString, UriKind.Absolute);
        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo.Length != 2 || string.IsNullOrWhiteSpace(uri.AbsolutePath.Trim('/')))
        {
            throw new FormatException("The PostgreSQL URL is missing credentials or a database name.");
        }

        return new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.Trim('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = Uri.UnescapeDataString(userInfo[1]),
            SslMode = SslMode.Require,
            MaxPoolSize = 10
        }.ConnectionString;
    }
}
