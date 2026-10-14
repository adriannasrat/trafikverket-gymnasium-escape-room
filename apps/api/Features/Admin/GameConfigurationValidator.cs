using EscapeRoom.Api.Domain;

namespace EscapeRoom.Api.Features.Admin;

internal static class GameConfigurationValidator
{
    private static readonly HashSet<string> MatchingIconKeys = new(StringComparer.Ordinal)
    {
        "train", "weather", "school", "map-pin", "shield", "car", "construction", "environment", "warning"
    };

    public static Dictionary<string, string[]> Validate(
        AdminEndpoints.UpdateGameRequest request,
        Game game)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateGameFields(request, errors);
        if (!ValidateChallengeIdentity(request, game, errors))
        {
            return errors;
        }

        ValidateChallengeOrder(request, errors);
        ValidateChallengeAvailability(request, game, errors);
        ValidateSharedChallengeFields(request, game, errors);
        ValidateGameSpecificFields(request, game, errors);
        return errors;
    }

    private static void ValidateGameFields(
        AdminEndpoints.UpdateGameRequest request,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 160)
        {
            errors["title"] = ["Titeln måste innehålla mellan 1 och 160 tecken."];
        }

        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Length > 500)
        {
            errors["summary"] = ["Sammanfattningen måste innehålla mellan 1 och 500 tecken."];
        }

        if (request.DefaultTimeLimitSeconds is < 5 or > 900)
        {
            errors["defaultTimeLimitSeconds"] = ["Tidsgränsen måste vara mellan 5 och 900 sekunder."];
        }
    }

    private static bool ValidateChallengeIdentity(
        AdminEndpoints.UpdateGameRequest request,
        Game game,
        Dictionary<string, string[]> errors)
    {
        if (request.Challenges.Count == game.Challenges.Count &&
            request.Challenges.All(update => game.Challenges.Any(challenge => challenge.Id == update.Id)))
        {
            return true;
        }

        errors["challenges"] = ["Uppdragslistan matchar inte spelets befintliga uppdrag."];
        return false;
    }

    private static void ValidateChallengeOrder(
        AdminEndpoints.UpdateGameRequest request,
        Dictionary<string, string[]> errors)
    {
        var expected = Enumerable.Range(1, request.Challenges.Count);
        var actual = request.Challenges.Select(challenge => challenge.SortOrder).Order().ToArray();
        if (!actual.SequenceEqual(expected))
        {
            errors["challengeOrder"] = ["Händelsernas ordning måste vara sammanhängande och utan dubbletter."];
        }
    }

    private static void ValidateChallengeAvailability(
        AdminEndpoints.UpdateGameRequest request,
        Game game,
        Dictionary<string, string[]> errors)
    {
        if (!game.Type.SupportsChallengeActivation())
        {
            if (request.Challenges.Any(challenge => challenge.IsEnabled == false))
            {
                errors["challengeAvailability"] = ["Frågor kan inte inaktiveras i den här speltypen."];
            }
            return;
        }

        if (request.Challenges.All(challenge => challenge.IsEnabled == false))
        {
            errors["challengeAvailability"] = ["Spelet måste ha minst en aktiv fråga."];
        }
    }

    private static void ValidateSharedChallengeFields(
        AdminEndpoints.UpdateGameRequest request,
        Game game,
        Dictionary<string, string[]> errors)
    {
        foreach (var update in request.Challenges)
        {
            var challenge = game.Challenges.Single(candidate => candidate.Id == update.Id);
            if (game.Type.RequiresChallengeImages() &&
                update.IsEnabled != false &&
                string.IsNullOrWhiteSpace(challenge.ImagePath))
            {
                errors[$"challenges.{update.Id}.image"] = ["Ladda upp en bild till pixeljakten."];
            }

            if (string.IsNullOrWhiteSpace(update.Prompt) || update.Prompt.Length > 1200)
            {
                errors[$"challenges.{update.Id}.prompt"] = ["Instruktionen måste innehålla mellan 1 och 1200 tecken."];
            }

            if (update.Options.Count != challenge.Options.Count ||
                update.Options.Any(option => challenge.Options.All(existing => existing.Id != option.Id)))
            {
                errors[$"challenges.{update.Id}.options"] = ["Svarsalternativen matchar inte de befintliga alternativen."];
                continue;
            }

            if (game.Type is not GameType.Sorting and not GameType.WordAssembly and not GameType.Hangman &&
                update.Options.Count(option => option.IsCorrect) != 1)
            {
                errors[$"challenges.{update.Id}.correctAnswer"] = ["Exakt ett svar måste vara markerat som korrekt."];
            }

            if (update.Options.Any(option => string.IsNullOrWhiteSpace(option.Text) || option.Text.Length > 500))
            {
                errors[$"challenges.{update.Id}.optionText"] = ["Svarsalternativ måste innehålla mellan 1 och 500 tecken."];
            }
        }
    }

    private static void ValidateGameSpecificFields(
        AdminEndpoints.UpdateGameRequest request,
        Game game,
        Dictionary<string, string[]> errors)
    {
        switch (game.Type)
        {
            case GameType.Matching:
                ValidateMatching(request, game, errors);
                break;
            case GameType.TrueFalse:
                ValidateTrueFalse(request, game, errors);
                break;
            case GameType.Sorting:
                ValidateSorting(request, errors);
                break;
            case GameType.WordAssembly:
                ValidateWordAssembly(request, errors);
                break;
            case GameType.Hangman:
                ValidateHangman(request, errors);
                break;
        }
    }

    private static void ValidateMatching(
        AdminEndpoints.UpdateGameRequest request,
        Game game,
        Dictionary<string, string[]> errors)
    {
        if (request.Challenges.Count == 0 ||
            errors.Keys.Any(key => key.EndsWith(".options", StringComparison.Ordinal)))
        {
            return;
        }

        var destinationSets = request.Challenges.Select(update =>
        {
            var challenge = game.Challenges.Single(candidate => candidate.Id == update.Id);
            return update.Options
                .Select(option => new MatchingDestination(
                    challenge.Options.Single(existing => existing.Id == option.Id).SortOrder,
                    option.Text.Trim(),
                    option.MatchingIconKey?.Trim() ?? "map-pin"))
                .OrderBy(option => option.SortOrder)
                .ToArray();
        }).ToList();

        if (destinationSets.Skip(1).Any(set => !set.SequenceEqual(destinationSets[0])))
        {
            errors["destinations"] = ["Riskzonerna måste vara likadana för alla scenarier."];
        }

        if (destinationSets[0].Length < 2 ||
            destinationSets[0].Select(destination => destination.Text)
                .Distinct(StringComparer.OrdinalIgnoreCase).Count() != destinationSets[0].Length)
        {
            errors["destinations"] = ["Ange minst två riskzoner med unika namn."];
        }

        if (destinationSets[0].Any(destination => !MatchingIconKeys.Contains(destination.IconKey)))
        {
            errors["destinationIcons"] = ["Välj en giltig ikon för varje riskzon."];
        }

        if (destinationSets[0].Length < request.Challenges.Count)
        {
            errors["destinations"] = ["Spelet behöver minst lika många riskzoner som scenarier."];
        }

        if (request.Challenges.All(update => update.Options.Count(option => option.IsCorrect) == 1))
        {
            var correctSortOrders = request.Challenges.Select(update =>
            {
                var challenge = game.Challenges.Single(candidate => candidate.Id == update.Id);
                var correctOptionId = update.Options.Single(option => option.IsCorrect).Id;
                return challenge.Options.Single(option => option.Id == correctOptionId).SortOrder;
            }).ToList();
            if (correctSortOrders.Distinct().Count() != correctSortOrders.Count)
            {
                errors["matchingAnswers"] = ["Varje scenario måste ha en egen korrekt riskzon."];
            }
        }
    }

    private static void ValidateTrueFalse(
        AdminEndpoints.UpdateGameRequest request,
        Game game,
        Dictionary<string, string[]> errors)
    {
        foreach (var update in request.Challenges)
        {
            var challenge = game.Challenges.Single(candidate => candidate.Id == update.Id);
            var labels = update.Options
                .Select(option => new
                {
                    SortOrder = challenge.Options.Single(existing => existing.Id == option.Id).SortOrder,
                    Text = option.Text.Trim()
                })
                .OrderBy(option => option.SortOrder)
                .Select(option => option.Text)
                .ToArray();
            if (!labels.SequenceEqual(["Sant", "Falskt"], StringComparer.OrdinalIgnoreCase))
            {
                errors[$"challenges.{update.Id}.options"] =
                    ["Sant eller falskt-frågor måste ha alternativen Sant och Falskt."];
            }
        }
    }

    private static void ValidateSorting(
        AdminEndpoints.UpdateGameRequest request,
        Dictionary<string, string[]> errors)
    {
        foreach (var update in request.Challenges)
        {
            var categoryNames = update.Options
                .Select(option => option.SortingCategory?.Trim())
                .Where(category => !string.IsNullOrWhiteSpace(category))
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (categoryNames.Count < 2)
            {
                errors[$"challenges.{update.Id}.sortingCategories"] =
                    ["Sorteringen måste innehålla minst två kategorier."];
            }

            if (update.Options.Any(option => option.SortingCategory?.Trim().Length > 80))
            {
                errors[$"challenges.{update.Id}.sortingCategories"] =
                    ["Kategorinamn får innehålla högst 80 tecken."];
            }
        }
    }

    private static void ValidateWordAssembly(
        AdminEndpoints.UpdateGameRequest request,
        Dictionary<string, string[]> errors)
    {
        foreach (var update in request.Challenges)
        {
            if (update.Options.Count is < 2 or > 8)
            {
                errors[$"challenges.{update.Id}.wordParts"] =
                    ["Ett ord måste bestå av mellan två och åtta delar."];
                continue;
            }

            var requestedSortOrders = update.Options.Select(option => option.SortOrder).Order().ToArray();
            if (!requestedSortOrders.SequenceEqual(Enumerable.Range(1, update.Options.Count)))
            {
                errors[$"challenges.{update.Id}.wordPartOrder"] =
                    ["Orddelarnas ordning måste vara sammanhängande och utan dubbletter."];
            }

            if (update.Options.Select(option => option.Text.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase).Count() != update.Options.Count)
            {
                errors[$"challenges.{update.Id}.wordParts"] =
                    ["Orddelarna i samma ord måste ha unika texter."];
            }
        }
    }

    private static void ValidateHangman(
        AdminEndpoints.UpdateGameRequest request,
        Dictionary<string, string[]> errors)
    {
        foreach (var update in request.Challenges)
        {
            if (update.Options.Count != 1)
            {
                errors[$"challenges.{update.Id}.hangmanAnswer"] =
                    ["Varje ordgåta måste ha exakt ett hemligt ord."];
                continue;
            }

            var answer = update.Options[0].Text.Trim();
            if (answer.Length is < 3 or > 40 ||
                answer.Any(character => !char.IsLetter(character) && character is not ' ' and not '-'))
            {
                errors[$"challenges.{update.Id}.hangmanAnswer"] =
                    ["Det hemliga ordet måste vara 3–40 tecken och får bara innehålla bokstäver, mellanslag och bindestreck."];
            }
        }
    }

    private sealed record MatchingDestination(int SortOrder, string Text, string IconKey);
}
