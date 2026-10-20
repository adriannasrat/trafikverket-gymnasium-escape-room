import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";
import { getAdminGameCopy } from "../lib/gameCatalog";
import type { AdminGame } from "../types";
import { useAdminAutosave } from "./useAdminAutosave";

export function useAdminGameEditor(onUnauthorized: () => void) {
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [mutating, setMutating] = useState<string | null>(null);
  const [openChallengeIds, setOpenChallengeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const game =
    games?.find((candidate) => candidate.id === selectedId) ?? games?.[0];
  const isMatching = game?.type === "Matching";
  const isSorting = game?.type === "Sorting";
  const isWordAssembly = game?.type === "WordAssembly";
  const gameCopy = getAdminGameCopy(game?.type ?? "Quiz");
  const gamesRef = useRef<AdminGame[] | null>(null);
  const {
    autosaveState,
    initialize: initializeAutosave,
    markChanged,
    flushPendingSaves,
    beginMutation: beginAutosaveMutation,
    endMutation: endAutosaveMutation,
    waitForActiveSave,
  } = useAdminAutosave({ gamesRef, setGames, onUnauthorized });

  function beginMutation(gameId: string, mutation: string) {
    beginAutosaveMutation(gameId);
    setMutating(mutation);
  }

  function endMutation(gameId: string) {
    endAutosaveMutation(gameId);
    setMutating(null);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .adminGames()
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
    const currentGame = gamesRef.current?.find(
      (candidate) => candidate.id === gameId,
    );
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
    beginMutation(game.id, "add");
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      const challenge = await api.createChallenge(game.id);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: [...currentGame.challenges, challenge],
      });
      setOpenChallengeIds((current) => new Set(current).add(challenge.id));
      setStatus(`${gameCopy.indefiniteItem} har lagts till. Ändringar du gör sparas automatiskt.`);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Frågan kunde inte läggas till.",
      );
    } finally {
      endMutation(game.id);
    }
  }

  async function deleteChallenge(challengeId: string) {
    if (!game || game.challenges.length <= 1) return;
    const challenge = game.challenges.find((item) => item.id === challengeId);
    if (!challenge) return;
    if (!window.confirm(`Ta bort ${gameCopy.definiteItem} ”${challenge.prompt}”?`)) return;

    beginMutation(game.id, challengeId);
    setStatus("");
    try {
      await waitForActiveSave(game.id);
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
      setStatus(`${gameCopy.definiteItemCapitalized} har tagits bort från spelet.`);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Frågan kunde inte tas bort.",
      );
    } finally {
      endMutation(game.id);
    }
  }

  async function addMatchingDestination() {
    if (!game || !isMatching) return;
    beginMutation(game.id, "add-destination");
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      const result = await api.addMatchingDestination(game.id);
      const optionsByChallenge = new Map(
        result.options.map((option) => [option.challengeId, option]),
      );
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((challenge) => {
          const option = optionsByChallenge.get(challenge.id);
          return option
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge;
        }),
      });
      setStatus("En ny riskzon har lagts till. Ändringar du gör sparas automatiskt.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Riskzonen kunde inte läggas till.");
    } finally {
      endMutation(game.id);
    }
  }

  async function deleteMatchingDestination(sortOrder: number) {
    if (!game || !isMatching) return;
    const destination = game.challenges[0]?.options.find(
      (option) => option.sortOrder === sortOrder,
    );
    if (!destination || !window.confirm(`Ta bort riskzonen ”${destination.text}”?`)) return;

    beginMutation(game.id, `destination-${sortOrder}`);
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      await api.deleteMatchingDestination(game.id, sortOrder);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((challenge) => ({
          ...challenge,
          options: challenge.options
            .filter((option) => option.sortOrder !== sortOrder)
            .map((option) => ({
              ...option,
              sortOrder: option.sortOrder > sortOrder
                ? option.sortOrder - 1
                : option.sortOrder,
            })),
        })),
      });
      setStatus("Riskzonen har tagits bort.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Riskzonen kunde inte tas bort.");
    } finally {
      endMutation(game.id);
    }
  }

  async function addSortingCard(challengeId: string) {
    if (!game || !isSorting) return;
    beginMutation(game.id, `sorting-card-add-${challengeId}`);
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      const option = await api.addSortingCard(challengeId);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge,
        ),
      });
      setStatus("Ett nytt kort har lagts till. Ändringar du gör sparas automatiskt.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Kortet kunde inte läggas till.");
    } finally {
      endMutation(game.id);
    }
  }

  async function deleteSortingCard(challengeId: string, optionId: string) {
    if (!game || !isSorting) return;
    const challenge = game.challenges.find((candidate) => candidate.id === challengeId);
    const option = challenge?.options.find((candidate) => candidate.id === optionId);
    if (!challenge || !option || !window.confirm(`Ta bort kortet ”${option.text}”?`)) return;

    beginMutation(game.id, `sorting-card-delete-${optionId}`);
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      await api.deleteSortingCard(challengeId, optionId);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((candidate) =>
          candidate.id === challengeId
            ? {
                ...candidate,
                options: candidate.options
                  .filter((item) => item.id !== optionId)
                  .map((item, index) => ({ ...item, sortOrder: index + 1 })),
              }
            : candidate,
        ),
      });
      setStatus("Kortet har tagits bort från sorteringen.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Kortet kunde inte tas bort.");
    } finally {
      endMutation(game.id);
    }
  }

  async function addWordPart(challengeId: string) {
    if (!game || !isWordAssembly) return;
    beginMutation(game.id, `word-part-add-${challengeId}`);
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      const option = await api.addWordPart(challengeId);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge,
        ),
      });
      setStatus("En ny orddel har lagts till. Ändringar du gör sparas automatiskt.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Orddelen kunde inte läggas till.");
    } finally {
      endMutation(game.id);
    }
  }

  async function deleteWordPart(challengeId: string, optionId: string) {
    if (!game || !isWordAssembly) return;
    const challenge = game.challenges.find((candidate) => candidate.id === challengeId);
    const option = challenge?.options.find((candidate) => candidate.id === optionId);
    if (!challenge || !option || !window.confirm(`Ta bort orddelen ”${option.text}”?`)) return;

    beginMutation(game.id, `word-part-delete-${optionId}`);
    setStatus("");
    try {
      await waitForActiveSave(game.id);
      await api.deleteWordPart(challengeId, optionId);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((candidate) =>
          candidate.id === challengeId
            ? {
                ...candidate,
                options: candidate.options
                  .filter((item) => item.id !== optionId)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item, index) => ({ ...item, sortOrder: index + 1 })),
              }
            : candidate,
        ),
      });
      setStatus("Orddelen har tagits bort.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Orddelen kunde inte tas bort.");
    } finally {
      endMutation(game.id);
    }
  }

  async function uploadImage(challengeId: string, image?: File) {
    if (!game || !image) return;
    beginMutation(game.id, `image-${challengeId}`);
    setStatus("Laddar upp bilden…");
    try {
      await waitForActiveSave(game.id);
      const result = await api.uploadChallengeImage(challengeId, image);
      const currentGame = getCurrentGame(game.id, game);
      updateGameById(game.id, {
        challenges: currentGame.challenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, imagePath: result.imagePath }
            : challenge,
        ),
      });
      setStatus("Bilden är uppladdad och syns nu i uppdraget.");
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Bilden kunde inte laddas upp.",
      );
    } finally {
      endMutation(game.id);
    }
  }

  function selectGame(gameId: string) {
    setSelectedId(gameId);
    setOpenChallengeIds(new Set());
  }

  return {
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
    addMatchingDestination,
    deleteMatchingDestination,
    addSortingCard,
    deleteSortingCard,
    addWordPart,
    deleteWordPart,
    uploadImage,
  };
}

export type AdminGameEditorController = ReturnType<typeof useAdminGameEditor>;

