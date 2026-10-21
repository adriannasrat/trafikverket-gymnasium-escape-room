import { useState } from "react";
import { SortingBoard } from "../../../components/SortingBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

export function SortingGame({
  data,
  sessionId,
  remaining,
  awaitingNext,
  timingOut,
  externalFeedback,
  nextActionLabel,
  navigating,
  onClearExternalFeedback,
  onElapsedChange,
  onChallengeComplete,
  onRestartChallenge,
  onUpdateProgress,
  onNextChallenge,
}: GameRuntimeProps<"Sorting">) {
  const emptyPlacements = () => Object.fromEntries(
    data.sorting.cards.map((card) => [card.id, null]),
  );
  const [placements, setPlacements] = useState<Record<string, string | null>>(emptyPlacements);
  const [correctIds, setCorrectIds] = useState<Set<string>>(() => new Set());
  const [incorrectIds, setIncorrectIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(() => awaitingNext
    ? { correct: true, text: "Alla kort är rätt sorterade. Gå vidare när du är redo." }
    : null);

  function moveCard(cardId: string, category: string | null) {
    if (correctIds.has(cardId) || awaitingNext) return;
    setPlacements((current) => ({ ...current, [cardId]: category }));
    setIncorrectIds((current) => {
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
    setFeedback(null);
    onClearExternalFeedback();
  }

  async function submit() {
    if (awaitingNext || timingOut) return;
    const submittedPlacements = data.sorting.cards.map((card) => ({
      optionId: card.id,
      category: placements[card.id] ?? null,
    }));
    setSubmitting(true);
    setFeedback(null);
    onClearExternalFeedback();
    try {
      const result = await api.submitSorting(sessionId, data.challenge.id, submittedPlacements);
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.elapsedMilliseconds !== undefined) onElapsedChange(result.elapsedMilliseconds);

      if (result.expired) {
        setPlacements(emptyPlacements());
        setCorrectIds(new Set());
        setIncorrectIds(new Set());
        onRestartChallenge({
          ...result,
          currentChallengePenaltyMilliseconds: 0,
        });
      } else if (result.correct) {
        setCorrectIds(new Set(data.sorting.cards.map((card) => card.id)));
        setIncorrectIds(new Set());
        onChallengeComplete();
      } else {
        const incorrect = new Set(result.incorrectOptionIds);
        setIncorrectIds(incorrect);
        setCorrectIds(new Set(
          data.sorting.cards
            .filter((card) => !incorrect.has(card.id))
            .map((card) => card.id),
        ));
        onUpdateProgress({
          currentChallengePenaltyMilliseconds: result.currentChallengePenaltyMilliseconds,
        });
        if (result.secondsRemaining !== undefined) {
          onRestartChallenge({
            secondsRemaining: result.secondsRemaining,
            currentChallengePenaltyMilliseconds: result.currentChallengePenaltyMilliseconds,
          });
        }
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error
          ? caught.message
          : "Sorteringen kunde inte kontrolleras.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <GameChallengeTimer
        remaining={remaining}
        total={data.challenge.timeLimitSeconds}
        complete={awaitingNext}
        completeLabel="SORTERINGEN ÄR KLAR"
      />
      <SortingBoard
        cards={data.sorting.cards}
        categories={data.sorting.categories}
        placements={placements}
        correctIds={correctIds}
        incorrectIds={incorrectIds}
        disabled={awaitingNext || submitting || timingOut || remaining <= 0}
        onMove={moveCard}
      />
      <GameActionArea
        feedback={feedback ?? externalFeedback}
        action={{
          label: awaitingNext
            ? nextActionLabel
            : timingOut ? "Tiden registreras…" : "Kontrollera sortering",
          busyLabel: awaitingNext ? `${nextActionLabel}…` : "Kontrollerar…",
          busy: submitting || navigating,
          disabled: awaitingNext ? navigating : submitting || timingOut,
          onClick: () => void (awaitingNext ? onNextChallenge() : submit()),
        }}
      />
    </>
  );
}
