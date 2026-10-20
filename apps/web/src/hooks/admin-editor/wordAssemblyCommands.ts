import { api } from "../../lib/api";
import type { AdminChallenge, AdminGame, AdminOption } from "../../types";
import type { AdminEditorCommandContext } from "./types";

type WordAssemblyApi = Pick<typeof api, "addWordPart" | "deleteWordPart">;

export function appendWordPart(
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

export function removeWordPart(
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
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((option, index) => ({ ...option, sortOrder: index + 1 })),
        }
      : challenge,
  );
}

export function createWordAssemblyCommands(
  context: AdminEditorCommandContext,
  client: WordAssemblyApi = api,
) {
  async function addWordPart(challengeId: string) {
    const game = context.game;
    if (!game || game.type !== "WordAssembly") return;

    await context.runMutation({
      gameId: game.id,
      key: `word-part-add-${challengeId}`,
      fallbackErrorMessage: "Orddelen kunde inte läggas till.",
      execute: async () => {
        const option = await client.addWordPart(challengeId);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: appendWordPart(currentGame, challengeId, option),
        });
        return "En ny orddel har lagts till. Ändringar du gör sparas automatiskt.";
      },
    });
  }

  async function deleteWordPart(challengeId: string, optionId: string) {
    const game = context.game;
    if (!game || game.type !== "WordAssembly") return;
    const option = game.challenges
      .find((challenge) => challenge.id === challengeId)
      ?.options.find((candidate) => candidate.id === optionId);
    if (!option || !context.confirm(`Ta bort orddelen ”${option.text}”?`)) return;

    await context.runMutation({
      gameId: game.id,
      key: `word-part-delete-${optionId}`,
      fallbackErrorMessage: "Orddelen kunde inte tas bort.",
      execute: async () => {
        await client.deleteWordPart(challengeId, optionId);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: removeWordPart(currentGame, challengeId, optionId),
        });
        return "Orddelen har tagits bort.";
      },
    });
  }

  return { addWordPart, deleteWordPart };
}
