namespace EscapeRoom.Api.Features.Sessions;

public static class HangmanRules
{
    public const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ";
    public const int MaximumMistakes = 6;

    public static string NormalizeAnswer(string answer) => answer.Trim().ToUpperInvariant();

    public static HangmanStateResponse BuildState(string answer, IEnumerable<string> guesses)
    {
        var guessedLetters = guesses
            .Select(guess => guess.Trim().ToUpperInvariant())
            .Where(guess => guess.Length == 1 && Alphabet.Contains(guess, StringComparison.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var guessedCharacters = guessedLetters.Select(guess => guess[0]).ToHashSet();
        var pattern = answer
            .Select(character => !char.IsLetter(character) || guessedCharacters.Contains(character)
                ? character.ToString()
                : null)
            .ToList();
        var mistakes = guessedLetters.Count(guess => !answer.Contains(guess, StringComparison.Ordinal));
        return new HangmanStateResponse(
            pattern,
            guessedLetters,
            Math.Min(mistakes, MaximumMistakes),
            MaximumMistakes,
            pattern.All(character => character is not null));
    }
}
