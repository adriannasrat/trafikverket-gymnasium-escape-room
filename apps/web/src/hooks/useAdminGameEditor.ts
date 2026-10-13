import { useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import { getAdminGameCopy, manageableGameTypes } from "../lib/gameCatalog";
import type { AdminGame } from "../types";

export function useAdminGameEditor(onUnauthorized: () => void) {
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const [openChallengeIds, setOpenChallengeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const game =
    games?.find((candidate) => candidate.id === selectedId) ?? games?.[0];
  const isMatching = game?.type === "Matching";
  const isTrueFalse = game?.type === "TrueFalse";
  const isPixelHunt = game?.type === "PixelHunt";
  const isSorting = game?.type === "Sorting";
  const isWordAssembly = game?.type === "WordAssembly";
  const isHangman = game?.type === "Hangman";
  const canManageQuestions = game ? manageableGameTypes.has(game.type) : false;
  const gameCopy = getAdminGameCopy(game?.type ?? "Quiz");

  useEffect(() => {
    api
      .adminGames()
      .then((result) => {
        setGames(result);
        setSelectedId(result[0]?.id ?? "");
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
          return;
        }
        setStatus(error instanceof Error ? error.message : "Spelen kunde inte laddas.");
        setGames([]);
      });
  }, [onUnauthorized]);

  function updateGame(change: Partial<AdminGame>) {
    if (!game) return;
    setGames(
      (current) =>
        current?.map((candidate) =>
          candidate.id === game.id ? { ...candidate, ...change } : candidate,
        ) ?? null,
    );
    setStatus("");
  }

  function toggleChallenge(challengeId: string) {
    setOpenChallengeIds((current) => {
      const next = new Set(current);
      if (next.has(challengeId)) next.delete(challengeId);
      else next.add(challengeId);
      return next;
    });
  }

  async function save() {
    if (!game) return;
    setSaving(true);
    setStatus("");
    try {
      const saved = await api.updateGame(game);
      setGames(
        (current) =>
          current?.map((candidate) =>
            candidate.id === saved.id ? saved : candidate,
          ) ?? null,
      );
      setStatus("Ändringarna är sparade och klara för eventet.");
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Ändringarna kunde inte sparas.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addChallenge() {
    if (!game || !canManageQuestions) return;
    setMutating("add");
    setStatus("");
    try {
      const challenge = await api.createChallenge(game.id);
      updateGame({ challenges: [...game.challenges, challenge] });
      setOpenChallengeIds((current) => new Set(current).add(challenge.id));
      setStatus(`${gameCopy.indefiniteItem} har lagts till. Fyll i innehållet och spara ändringarna.`);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Frågan kunde inte läggas till.",
      );
    } finally {
      setMutating(null);
    }
  }

  async function deleteChallenge(challengeId: string) {
    if (!game || !canManageQuestions || game.challenges.length <= 1) return;
    const challenge = game.challenges.find((item) => item.id === challengeId);
    if (!challenge) return;
    if (!window.confirm(`Ta bort ${gameCopy.definiteItem} ”${challenge.prompt}”?`)) return;

    setMutating(challengeId);
    setStatus("");
    try {
      await api.deleteChallenge(challengeId);
      updateGame({
        challenges: game.challenges
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
      setMutating(null);
    }
  }

  async function addMatchingDestination() {
    if (!game || !isMatching) return;
    setMutating("add-destination");
    setStatus("");
    try {
      const result = await api.addMatchingDestination(game.id);
      const optionsByChallenge = new Map(
        result.options.map((option) => [option.challengeId, option]),
      );
      updateGame({
        challenges: game.challenges.map((challenge) => {
          const option = optionsByChallenge.get(challenge.id);
          return option
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge;
        }),
      });
      setStatus("En ny riskzon har lagts till. Ge den ett namn och spara ändringarna.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Riskzonen kunde inte läggas till.");
    } finally {
      setMutating(null);
    }
  }

  async function deleteMatchingDestination(sortOrder: number) {
    if (!game || !isMatching) return;
    const destination = game.challenges[0]?.options.find(
      (option) => option.sortOrder === sortOrder,
    );
    if (!destination || !window.confirm(`Ta bort riskzonen ”${destination.text}”?`)) return;

    setMutating(`destination-${sortOrder}`);
    setStatus("");
    try {
      await api.deleteMatchingDestination(game.id, sortOrder);
      updateGame({
        challenges: game.challenges.map((challenge) => ({
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
      setMutating(null);
    }
  }

  async function addSortingCard(challengeId: string) {
    if (!game || !isSorting) return;
    setMutating(`sorting-card-add-${challengeId}`);
    setStatus("");
    try {
      const option = await api.addSortingCard(challengeId);
      updateGame({
        challenges: game.challenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge,
        ),
      });
      setStatus("Ett nytt kort har lagts till. Ändra korttext eller målområde och spara ändringarna.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Kortet kunde inte läggas till.");
    } finally {
      setMutating(null);
    }
  }

  async function deleteSortingCard(challengeId: string, optionId: string) {
    if (!game || !isSorting) return;
    const challenge = game.challenges.find((candidate) => candidate.id === challengeId);
    const option = challenge?.options.find((candidate) => candidate.id === optionId);
    if (!challenge || !option || !window.confirm(`Ta bort kortet ”${option.text}”?`)) return;

    setMutating(`sorting-card-delete-${optionId}`);
    setStatus("");
    try {
      await api.deleteSortingCard(challengeId, optionId);
      updateGame({
        challenges: game.challenges.map((candidate) =>
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
      setMutating(null);
    }
  }

  async function addWordPart(challengeId: string) {
    if (!game || !isWordAssembly) return;
    setMutating(`word-part-add-${challengeId}`);
    setStatus("");
    try {
      const option = await api.addWordPart(challengeId);
      updateGame({
        challenges: game.challenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge,
        ),
      });
      setStatus("En ny orddel har lagts till. Ändra texten, placera den rätt och spara ändringarna.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Orddelen kunde inte läggas till.");
    } finally {
      setMutating(null);
    }
  }

  async function deleteWordPart(challengeId: string, optionId: string) {
    if (!game || !isWordAssembly) return;
    const challenge = game.challenges.find((candidate) => candidate.id === challengeId);
    const option = challenge?.options.find((candidate) => candidate.id === optionId);
    if (!challenge || !option || !window.confirm(`Ta bort orddelen ”${option.text}”?`)) return;

    setMutating(`word-part-delete-${optionId}`);
    setStatus("");
    try {
      await api.deleteWordPart(challengeId, optionId);
      updateGame({
        challenges: game.challenges.map((candidate) =>
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
      setMutating(null);
    }
  }

  async function uploadImage(challengeId: string, image?: File) {
    if (!game || !image) return;
    setMutating(`image-${challengeId}`);
    setStatus("Laddar upp bilden…");
    try {
      const result = await api.uploadChallengeImage(challengeId, image);
      updateGame({
        challenges: game.challenges.map((challenge) =>
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
      setMutating(null);
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
    saving,
    mutating,
    openChallengeIds,
    isMatching,
    isTrueFalse,
    isPixelHunt,
    isSorting,
    isWordAssembly,
    isHangman,
    canManageQuestions,
    gameCopy,
    selectGame,
    toggleChallenge,
    updateGame,
    save,
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

