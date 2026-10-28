import { api } from "../../lib/api";
import type { AdminChallenge, AdminGame } from "../../types";
import type { AdminEditorCommandContext } from "./types";

type ImageApi = Pick<typeof api, "uploadChallengeImage" | "removeChallengeImage">;

export function replaceChallengeImage(
  game: AdminGame,
  challengeId: string,
  imagePath: string,
): AdminChallenge[] {
  return game.challenges.map((challenge) =>
    challenge.id === challengeId ? { ...challenge, imagePath } : challenge,
  );
}

export function removeChallengeImage(
  game: AdminGame,
  challengeId: string,
  isEnabled: boolean,
): AdminChallenge[] {
  return game.challenges.map((challenge) =>
    challenge.id === challengeId
      ? { ...challenge, imagePath: null, isEnabled }
      : challenge,
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

  async function removeImage(challengeId: string) {
    const game = context.game;
    const challenge = game?.challenges.find((item) => item.id === challengeId);
    if (!game || !challenge?.imagePath) return;

    const requiredImageNotice = game.requiresChallengeImages
      ? " Frågan inaktiveras samtidigt så att en bildlös fråga aldrig kan visas för spelaren."
      : "";
    if (!context.confirm(`Ta bort bilden från frågan?${requiredImageNotice}`)) return;

    await context.runMutation({
      gameId: game.id,
      key: `image-${challengeId}`,
      pendingMessage: "Tar bort bilden…",
      fallbackErrorMessage: "Bilden kunde inte tas bort.",
      execute: async () => {
        const result = await client.removeChallengeImage(challengeId);
        const currentGame = context.getCurrentGame(game.id, game);
        context.updateGameById(game.id, {
          challenges: removeChallengeImage(
            currentGame,
            challengeId,
            result.isEnabled,
          ),
        });
        return result.isEnabled
          ? "Bilden har tagits bort från frågan."
          : "Bilden har tagits bort och frågan har inaktiverats.";
      },
    });
  }

  return { uploadImage, removeImage };
}
