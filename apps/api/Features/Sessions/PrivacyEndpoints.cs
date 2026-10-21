using EscapeRoom.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace EscapeRoom.Api.Features.Sessions;

public static class PrivacyEndpoints
{
    public static IEndpointRouteBuilder MapPrivacyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
            "/api/privacy",
            (IOptions<ExperienceOptions> experience, IOptions<DataRetentionOptions> retention) =>
                Results.Ok(new
                {
                    mode = experience.Value.Mode.ToString(),
                    retentionDays = retention.Value.RetentionDays
                }))
            .WithTags("Privacy");

        return endpoints;
    }
}
