import type { AdminChallenge, AdminGame, AdminOption } from "../../types";

export function changeChallenge(
  game: AdminGame,
  challengeId: string,
  change: (challenge: AdminChallenge) => AdminChallenge,
): AdminChallenge[] {
  return game.challenges.map((challenge) =>
    challenge.id === challengeId ? change(challenge) : challenge,
  );
}

export function changeOption(
  game: AdminGame,
  challengeId: string,
  optionId: string,
  change: (option: AdminOption) => AdminOption,
): AdminChallenge[] {
  return changeChallenge(game, challengeId, (challenge) => ({
    ...challenge,
    options: challenge.options.map((option) =>
      option.id === optionId ? change(option) : option,
    ),
  }));
}

export function selectCorrectOption(
  game: AdminGame,
  challengeId: string,
  optionId: string,
): AdminChallenge[] {
  return changeChallenge(game, challengeId, (challenge) => ({
    ...challenge,
    options: challenge.options.map((option) => ({
      ...option,
      isCorrect: option.id === optionId,
    })),
  }));
}
