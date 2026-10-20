import { useCallback, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import type { Challenge, GameType } from "../../../types";
import type { GameFeedbackMessage } from "../types";

export type GameNavigationPosition = {
  gameType: GameType;
  gameNumber: number;
  gameTotal: number;
  questionNumber: number;
  questionTotal: number;
};

export function getNextActionLabel(position: GameNavigationPosition | null) {
  if (!position) return "Nästa fråga";
  const isLastQuestion = position.questionNumber === position.questionTotal;
  const isLastGame = position.gameNumber === position.gameTotal;

  if (position.gameType === "Matching" || isLastQuestion) {
    return isLastGame ? "Slutför uppdraget" : "Nästa spel";
  }

  if (position.gameType === "PixelHunt") return "Nästa bild";
  if (position.gameType === "WordAssembly") return "Nästa ord";
  if (position.gameType === "Hangman") return "Nästa signalord";
  return "Nästa fråga";
}

type GameNavigationOptions = {
  sessionId: string;
  data: Challenge | null;
  awaitingNext: boolean;
  reloadChallenge: () => Promise<Challenge | null>;
  onBeforeNavigate: () => void;
};

export function useGameNavigation({
  sessionId,
  data,
  awaitingNext,
  reloadChallenge,
  onBeforeNavigate,
}: GameNavigationOptions) {
  const [navigating, setNavigating] = useState(false);
  const [feedback, setFeedback] = useState<GameFeedbackMessage | null>(null);

  const goToNextChallenge = useCallback(async () => {
    if (!awaitingNext || navigating) return;
    setNavigating(true);
    setFeedback(null);
    onBeforeNavigate();
    try {
      await api.nextChallenge(sessionId);
      await reloadChallenge();
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error
          ? caught.message
          : "Nästa fråga kunde inte laddas.",
      });
    } finally {
      setNavigating(false);
    }
  }, [awaitingNext, navigating, onBeforeNavigate, reloadChallenge, sessionId]);

  return {
    nextActionLabel: useMemo(() => getNextActionLabel(data ? {
      gameType: data.game.type,
      gameNumber: data.challenge.number,
      gameTotal: data.challenge.total,
      questionNumber: data.challenge.questionNumber,
      questionTotal: data.challenge.questionTotal,
    } : null), [data]),
    navigating,
    feedback,
    goToNextChallenge,
    clearFeedback: useCallback(() => setFeedback(null), []),
  };
}
