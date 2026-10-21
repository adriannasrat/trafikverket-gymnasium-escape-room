import type {
  Challenge,
  ChallengeBase,
  ChallengeProgress,
  ChallengeResponse,
  GameType,
} from "../types";

function progressFrom(response: ChallengeResponse): ChallengeProgress {
  const challenge = response.challenge;
  return {
    id: challenge.id,
    prompt: challenge.prompt,
    number: challenge.number,
    total: challenge.total,
    timeLimitSeconds: challenge.timeLimitSeconds,
    questionNumber: challenge.questionNumber,
    questionTotal: challenge.questionTotal,
    currentChallengePenaltyMilliseconds:
      challenge.currentChallengePenaltyMilliseconds,
    awaitingNext: challenge.awaitingNext,
    challengeStartedAtUtc: challenge.challengeStartedAtUtc,
    secondsRemaining: challenge.secondsRemaining,
  };
}

function baseChallenge<
  TType extends GameType,
  TProgress extends ChallengeProgress,
>(
  response: ChallengeResponse,
  type: TType,
  challenge: TProgress,
): ChallengeBase<TType, TProgress> {
  return {
    type,
    completed: false,
    sessionId: response.sessionId,
    playerName: response.playerName,
    startedAtUtc: response.startedAtUtc,
    elapsedMilliseconds: response.elapsedMilliseconds,
    game: { ...response.game, type },
    challenge,
  };
}

function missingPayload(type: GameType, payload: string): never {
  throw new Error(`Servern saknar ${payload} för speltypen ${type}.`);
}

/**
 * Converts the broad transport response into the strict frontend domain model.
 * This is the only place where nullable API payloads need to be checked.
 */
export function normalizeChallengeResponse(response: ChallengeResponse): Challenge {
  const progress = progressFrom(response);

  switch (response.game.type) {
    case "Quiz":
      return baseChallenge(response, "Quiz", {
        ...progress,
        imagePath: response.challenge.imagePath,
        options: response.challenge.options,
      });

    case "Matching":
      return {
        ...baseChallenge(response, "Matching", progress),
        matching: response.matching
          ?? missingPayload("Matching", "matchningsdata"),
      };

    case "TrueFalse":
      return baseChallenge(response, "TrueFalse", {
        ...progress,
        options: response.challenge.options,
      });

    case "PixelHunt":
      return baseChallenge(response, "PixelHunt", {
        ...progress,
        imagePath: response.challenge.imagePath
          ?? missingPayload("PixelHunt", "en bild"),
        pixelRevealCount: response.challenge.pixelRevealCount,
        options: response.challenge.options,
      });

    case "Sorting":
      return {
        ...baseChallenge(response, "Sorting", progress),
        sorting: response.sorting
          ?? missingPayload("Sorting", "sorteringsdata"),
      };

    case "WordAssembly":
      return {
        ...baseChallenge(response, "WordAssembly", progress),
        wordAssembly: response.wordAssembly
          ?? missingPayload("WordAssembly", "orddelar"),
      };

    case "Hangman":
      return {
        ...baseChallenge(response, "Hangman", {
          ...progress,
          imagePath: response.challenge.imagePath,
        }),
        hangman: response.hangman
          ?? missingPayload("Hangman", "signalordsdata"),
      };

    default:
      throw new Error(`Okänd speltyp: ${String(response.game.type)}`);
  }
}

export function updateChallengeProgress(
  challenge: Challenge,
  update: Partial<ChallengeProgress>,
): Challenge {
  switch (challenge.type) {
    case "Quiz":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
    case "Matching":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
    case "TrueFalse":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
    case "PixelHunt":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
    case "Sorting":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
    case "WordAssembly":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
    case "Hangman":
      return { ...challenge, challenge: { ...challenge.challenge, ...update } };
  }
}
