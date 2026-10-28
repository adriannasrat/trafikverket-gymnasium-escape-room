namespace EscapeRoom.Api.Features.Sessions;

public static partial class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sessions").WithTags("Sessions");
        group.MapPost("/", StartSessionAsync)
            .RequireRateLimiting("session-start");
        group.MapGet("/{sessionId:guid}", GetSessionAsync);
        group.MapGet("/{sessionId:guid}/current-challenge", GetCurrentChallengeAsync);
        group.MapPost("/{sessionId:guid}/answers", SubmitAnswerAsync);
        group.MapPost("/{sessionId:guid}/matches", SubmitMatchesAsync);
        group.MapPost("/{sessionId:guid}/pixel-reveal", RevealPixelAsync);
        group.MapPost("/{sessionId:guid}/sorting", SubmitSortingAsync);
        group.MapPost("/{sessionId:guid}/word-assembly", SubmitWordAssemblyAsync);
        group.MapPost("/{sessionId:guid}/hangman-guesses", SubmitHangmanGuessAsync);
        group.MapPost("/{sessionId:guid}/timeout", RegisterTimeoutAsync);
        group.MapPost("/{sessionId:guid}/retry", RetryChallengeAsync);
        group.MapPost("/{sessionId:guid}/next", MoveToNextChallengeAsync);

        endpoints.MapGet("/api/leaderboard", GetLeaderboardAsync).WithTags("Leaderboard");
        return endpoints;
    }

    private static async Task<IResult> StartSessionAsync(
        StartSessionRequest request,
        SessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.StartAsync(request, cancellationToken);
        return result.Kind == SessionResultKind.Success
            ? Results.Created($"/api/sessions/{result.Value!.Id}", result.Value)
            : ToErrorResult(result);
    }

    private static async Task<IResult> GetSessionAsync(
        Guid sessionId,
        SessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.GetAsync(sessionId, cancellationToken);
        return result.Kind == SessionResultKind.Success
            ? Results.Ok(result.Value)
            : ToErrorResult(result);
    }

    private static async Task<IResult> GetCurrentChallengeAsync(
        Guid sessionId,
        SessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.GetCurrentChallengeAsync(sessionId, cancellationToken);
        return result.Kind == SessionResultKind.Success
            ? Results.Ok(result.Value)
            : ToErrorResult(result);
    }

    private static async Task<IResult> RegisterTimeoutAsync(
        Guid sessionId,
        ChallengeTimeoutRequest request,
        SessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.RegisterTimeoutAsync(sessionId, request, cancellationToken);
        return result.Kind == SessionResultKind.Success
            ? Results.Ok(result.Value)
            : ToErrorResult(result);
    }

    private static async Task<IResult> MoveToNextChallengeAsync(
        Guid sessionId,
        SessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.MoveToNextChallengeAsync(sessionId, cancellationToken);
        return result.Kind == SessionResultKind.Success
            ? Results.NoContent()
            : ToErrorResult(result);
    }

    private static async Task<IResult> RetryChallengeAsync(
        Guid sessionId,
        RetryChallengeRequest request,
        SessionService sessions,
        CancellationToken cancellationToken)
    {
        var result = await sessions.RetryChallengeAsync(sessionId, request, cancellationToken);
        return result.Kind == SessionResultKind.Success
            ? Results.Ok(result.Value)
            : ToErrorResult(result);
    }

    private static async Task<IResult> GetLeaderboardAsync(
        SessionService sessions,
        CancellationToken cancellationToken) =>
        Results.Ok(await sessions.GetLeaderboardAsync(cancellationToken));

    private static IResult ToErrorResult<T>(SessionResult<T> result) => result.Kind switch
    {
        SessionResultKind.NotFound => Results.NotFound(),
        SessionResultKind.BadRequest => Results.BadRequest(new ErrorResponse(result.Message!)),
        SessionResultKind.Conflict => Results.Conflict(new ErrorResponse(result.Message!)),
        SessionResultKind.Validation => Results.ValidationProblem(result.Errors!),
        SessionResultKind.Unavailable => Results.Problem(
            title: result.Title,
            detail: result.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable),
        _ => throw new InvalidOperationException("A successful session result cannot be mapped as an error.")
    };
}
