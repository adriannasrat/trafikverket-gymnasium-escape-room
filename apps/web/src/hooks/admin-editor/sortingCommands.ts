import { api } from "../../lib/api";
import type { AdminChallenge, AdminGame, AdminOption } from "../../types";
import type { AdminEditorCommandContext } from "./types";

type SortingApi = Pick<typeof api, "addSortingCard" | "deleteSortingCard">;

export function appendSortingCard(
  game: AdminGame,
  challengeId: string,
  option: AdminOption,
): AdminChallenge[] {
  return game.challenges.map((challenge) =>
    challenge.id === challengeId
      ? { ...challenge, options: [...challenge.options, option] }
      : challenge,
  );
}

export function removeSortingCard(
  game: AdminGame,
  challengeId: string,
  optionId: string,
): AdminChallenge[] {
  return game.challenges.map((challenge) =>
    challenge.id === challengeId
      ? {
          ...challenge,
          options: challenge.options
            .filter((option) => option.id !== optionId)
            .map((option, index) => ({ ...option, sortOrder: index + 1 })),
        }
      : challenge,
  );
}

export function createSortingCommands(
  context: AdminEditorCommandContext,
  client: SortingApi = api,
) {
  async function addSortingCard(challengeId: string) {
    const game = context.game;
    if (!game || game.type !== "Sorting") return;

    await context.runMutation({
      gameId: game.id,
      key: `sorting-card-add-${challengeId}`,
      fallbackErrorMessage: "Kortet kunde inte läggas till.",
      execute: async () => {
        const option = await client.addSortingCard(challengeId);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: appendSortingCard(currentGame, challengeId, option),
        });
        return "Ett nytt kort har lagts till. Ändringar du gör sparas automatiskt.";
      },
    });
  }

  async function deleteSortingCard(challengeId: string, optionId: string) {
    const game = context.game;
    if (!game || game.type !== "Sorting") return;
    const option = game.challenges
      .find((challenge) => challenge.id === challengeId)
      ?.options.find((candidate) => candidate.id === optionId);
    if (!option || !context.confirm(`Ta bort kortet ”${option.text}”?`)) return;

    await context.runMutation({
      gameId: game.id,
      key: `sorting-card-delete-${optionId}`,
      fallbackErrorMessage: "Kortet kunde inte tas bort.",
      execute: async () => {
        await client.deleteSortingCard(challengeId, optionId);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: removeSortingCard(currentGame, challengeId, optionId),
        });
        return "Kortet har tagits bort från sorteringen.";
      },
    });
  }

  return { addSortingCard, deleteSortingCard };
}
