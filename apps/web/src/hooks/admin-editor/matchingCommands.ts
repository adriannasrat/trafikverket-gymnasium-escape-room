import { api } from "../../lib/api";
import type { AddedMatchingOption, AdminChallenge, AdminGame } from "../../types";
import type { AdminEditorCommandContext } from "./types";

type MatchingApi = Pick<typeof api, "addMatchingDestination" | "deleteMatchingDestination">;

export function appendMatchingDestination(
  game: AdminGame,
  options: AddedMatchingOption[],
): AdminChallenge[] {
  const optionsByChallenge = new Map(
    options.map((option) => [option.challengeId, option]),
  );
  return game.challenges.map((challenge) => {
    const option = optionsByChallenge.get(challenge.id);
    return option
      ? { ...challenge, options: [...challenge.options, option] }
      : challenge;
  });
}

export function removeMatchingDestination(
  game: AdminGame,
  sortOrder: number,
): AdminChallenge[] {
  return game.challenges.map((challenge) => ({
    ...challenge,
    options: challenge.options
      .filter((option) => option.sortOrder !== sortOrder)
      .map((option) => ({
        ...option,
        sortOrder: option.sortOrder > sortOrder
          ? option.sortOrder - 1
          : option.sortOrder,
      })),
  }));
}

export function createMatchingCommands(
  context: AdminEditorCommandContext,
  client: MatchingApi = api,
) {
  async function addMatchingDestination() {
    const game = context.game;
    if (!game || game.type !== "Matching") return;

    await context.runMutation({
      gameId: game.id,
      key: "add-destination",
      fallbackErrorMessage: "Riskzonen kunde inte läggas till.",
      execute: async () => {
        const result = await client.addMatchingDestination(game.id);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: appendMatchingDestination(currentGame, result.options),
        });
        return "En ny riskzon har lagts till. Ändringar du gör sparas automatiskt.";
      },
    });
  }

  async function deleteMatchingDestination(sortOrder: number) {
    const game = context.game;
    if (!game || game.type !== "Matching") return;
    const destination = game.challenges[0]?.options.find(
      (option) => option.sortOrder === sortOrder,
    );
    if (!destination || !context.confirm(`Ta bort riskzonen ”${destination.text}”?`)) return;

    await context.runMutation({
      gameId: game.id,
      key: `destination-${sortOrder}`,
      fallbackErrorMessage: "Riskzonen kunde inte tas bort.",
      execute: async () => {
        await client.deleteMatchingDestination(game.id, sortOrder);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: removeMatchingDestination(currentGame, sortOrder),
        });
        return "Riskzonen har tagits bort.";
      },
    });
  }

  return { addMatchingDestination, deleteMatchingDestination };
}
