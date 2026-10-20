import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../../lib/api";
import { getAdminGameCopy } from "../../lib/gameCatalog";
import type { AdminGame } from "../../types";
import { useAdminAutosave } from "../useAdminAutosave";
import type { AdminEditorCommandContext, AdminEditorMutation } from "./types";

export function useAdminGameEditorBase(onUnauthorized: () => void) {
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [mutating, setMutating] = useState<string | null>(null);
  const [openChallengeIds, setOpenChallengeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const gamesRef = useRef<AdminGame[] | null>(null);
  const game = games?.find((candidate) => candidate.id === selectedId) ?? games?.[0];
  const {
    autosaveState,
    initialize: initializeAutosave,
    markChanged,
    flushPendingSaves,
    beginMutation: beginAutosaveMutation,
    endMutation: endAutosaveMutation,
    waitForActiveSave,
  } = useAdminAutosave({ gamesRef, setGames, onUnauthorized });

  useEffect(() => {
    let cancelled = false;
    api.adminGames()
      .then((result) => {
        if (cancelled) return;
        gamesRef.current = result;
        initializeAutosave(result);
        setGames(result);
        setSelectedId(result[0]?.id ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
          return;
        }
        setStatus(error instanceof Error ? error.message : "Spelen kunde inte laddas.");
        setGames([]);
      });

    return () => {
      cancelled = true;
    };
  }, [initializeAutosave, onUnauthorized]);

  function updateGameById(gameId: string, change: Partial<AdminGame>) {
    const currentGame = gamesRef.current?.find((candidate) => candidate.id === gameId);
    if (!currentGame) return;

    const nextGames = gamesRef.current?.map((candidate) =>
      candidate.id === gameId ? { ...candidate, ...change } : candidate,
    ) ?? null;
    gamesRef.current = nextGames;
    setGames(nextGames);
    markChanged(gameId);
    setStatus("");
  }

  function updateGame(change: Partial<AdminGame>) {
    if (game) updateGameById(game.id, change);
  }

  function getCurrentGame(gameId: string, fallback: AdminGame) {
    return gamesRef.current?.find((candidate) => candidate.id === gameId) ?? fallback;
  }

  async function runMutation({
    gameId,
    key,
    pendingMessage = "",
    fallbackErrorMessage,
    execute,
  }: AdminEditorMutation) {
    beginAutosaveMutation(gameId);
    setMutating(key);
    setStatus(pendingMessage);
    try {
      await waitForActiveSave(gameId);
      setStatus(await execute());
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : fallbackErrorMessage);
    } finally {
      endAutosaveMutation(gameId);
      setMutating(null);
    }
  }

  function toggleChallenge(challengeId: string) {
    setOpenChallengeIds((current) => {
      const next = new Set(current);
      if (next.has(challengeId)) next.delete(challengeId);
      else next.add(challengeId);
      return next;
    });
  }

  async function addChallenge() {
    if (!game) return;
    const copy = getAdminGameCopy(game.type);
    await runMutation({
      gameId: game.id,
      key: "add",
      fallbackErrorMessage: "Frågan kunde inte läggas till.",
      execute: async () => {
        const challenge = await api.createChallenge(game.id);
        const currentGame = getCurrentGame(game.id, game);
        updateGameById(game.id, {
          challenges: [...currentGame.challenges, challenge],
        });
        setOpenChallengeIds((current) => new Set(current).add(challenge.id));
        return `${copy.indefiniteItem} har lagts till. Ändringar du gör sparas automatiskt.`;
      },
    });
  }

  async function deleteChallenge(challengeId: string) {
    if (!game || game.challenges.length <= 1) return;
    const challenge = game.challenges.find((item) => item.id === challengeId);
    if (!challenge) return;

    const copy = getAdminGameCopy(game.type);
    if (!window.confirm(`Ta bort ${copy.definiteItem} ”${challenge.prompt}”?`)) return;

    await runMutation({
      gameId: game.id,
      key: challengeId,
      fallbackErrorMessage: "Frågan kunde inte tas bort.",
      execute: async () => {
        await api.deleteChallenge(challengeId);
        const currentGame = getCurrentGame(game.id, game);
        updateGameById(game.id, {
          challenges: currentGame.challenges
            .filter((item) => item.id !== challengeId)
            .map((item, index) => ({ ...item, sortOrder: index + 1 })),
        });
        setOpenChallengeIds((current) => {
          const next = new Set(current);
          next.delete(challengeId);
          return next;
        });
        return `${copy.definiteItemCapitalized} har tagits bort från spelet.`;
      },
    });
  }

  function selectGame(gameId: string) {
    setSelectedId(gameId);
    setOpenChallengeIds(new Set());
  }

  const commandContext: AdminEditorCommandContext = {
    game,
    confirm: (message) => window.confirm(message),
    getCurrentGame,
    updateGameById,
    runMutation,
  };

  return {
    controller: {
      games,
      game,
      status,
      autosaveState,
      mutating,
      openChallengeIds,
      selectGame,
      toggleChallenge,
      updateGame,
      flushPendingSaves,
      addChallenge,
      deleteChallenge,
    },
    commandContext,
  };
}
