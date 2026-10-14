namespace EscapeRoom.Api.Domain;

public static class GameCapabilities
{
    public static bool SupportsChallengeImages(this GameType gameType) => gameType is
        GameType.Quiz or
        GameType.Matching or
        GameType.PixelHunt or
        GameType.Hangman;

    public static bool RequiresChallengeImages(this GameType gameType) =>
        gameType == GameType.PixelHunt;

    public static bool SupportsChallengeActivation(this GameType gameType) => gameType is
        GameType.Quiz or
        GameType.TrueFalse or
        GameType.PixelHunt or
        GameType.WordAssembly;
}
