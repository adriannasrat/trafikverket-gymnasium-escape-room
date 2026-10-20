import { api } from "../../lib/api";
import type { AdminChallenge, AdminGame } from "../../types";
import type { AdminEditorCommandContext } from "./types";

type ImageApi = Pick<typeof api, "uploadChallengeImage">;

export function replaceChallengeImage(
  game: AdminGame,
  challengeId: string,
  imagePath: string,
): AdminChallenge[] {
  return game.challenges.map((challenge) =>
    challenge.id === challengeId ? { ...challenge, imagePath } : challenge,
  );
}

export function createImageCommands(
  context: AdminEditorCommandContext,
  client: ImageApi = api,
) {
  async function uploadImage(challengeId: string, image?: File) {
    const game = context.game;
    if (!game || !image) return;

    await context.runMutation({
      gameId: game.id,
      key: `image-${challengeId}`,
      pendingMessage: "Laddar upp bilden…",
      fallbackErrorMessage: "Bilden kunde inte laddas upp.",
      execute: async () => {
        const result = await client.uploadChallengeImage(challengeId, image);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: replaceChallengeImage(currentGame, challengeId, result.imagePath),
        });
        return "Bilden är uppladdad och syns nu i uppdraget.";
      },
    });
  }

  return { uploadImage };
}
