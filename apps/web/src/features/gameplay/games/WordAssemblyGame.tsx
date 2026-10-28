import { useState } from "react";
import { WordAssemblyBoard } from "../../../components/WordAssemblyBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

export function WordAssemblyGame({
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
  onProgressChange,
  onChallengeComplete,
  onPauseChallenge,
  onRetryChallenge,
  retryingChallenge,
  onReloadChallenge,
  onNextChallenge,
}: GameRuntimeProps<"WordAssembly">) {
  const initialOrder = data.wordAssembly.parts.map((part) => part.id);
  const [order, setOrder] = useState(initialOrder);
  const [correctIds, setCorrectIds] = useState<Set<string>>(
    () => awaitingNext ? new Set(initialOrder) : new Set(),
  );
  const [incorrectIds, setIncorrectIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(() => awaitingNext
    ? { correct: true, text: "Ordet är rätt byggt. Gå vidare när du är redo." }
    : null);

  function reorder(nextOrder: string[]) {
    if (awaitingNext) return;
    setOrder(nextOrder);
    setCorrectIds(new Set());
    setIncorrectIds(new Set());
    setFeedback(null);
    onClearExternalFeedback();
  }

  async function submit() {
    if (awaitingNext || timingOut || order.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    onClearExternalFeedback();
    try {
      const result = await api.submitWordAssembly(sessionId, data.challenge.id, order);
      onProgressChange(result.progress);
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.elapsedMilliseconds !== undefined) onElapsedChange(result.elapsedMilliseconds);
      if (result.expired) {
        await onReloadChallenge({
          correct: false,
          text: result.message ?? "Game over – tiden tog slut.",
        });
      } else if (result.correct) {
        setCorrectIds(new Set(order));
        setIncorrectIds(new Set());
        onChallengeComplete();
      } else {
        const incorrect = new Set(result.incorrectOptionIds);
        setIncorrectIds(incorrect);
        setCorrectIds(new Set(order.filter((id) => !incorrect.has(id))));
        if (!result.progress?.gameOver) onPauseChallenge(result);
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error
          ? caught.message
          : "Orddelarna kunde inte kontrolleras.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function retryAttempt() {
    setSubmitting(true);
    try {
      await onRetryChallenge();
      setFeedback(null);
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error ? caught.message : "Orddelarna kunde inte startas om.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const retryRequired = data.challenge.retryRequired;

  return (
    <>
      <GameChallengeTimer
        remaining={remaining}
        total={data.challenge.timeLimitSeconds}
        complete={awaitingNext}
        completeLabel="ORDET ÄR KLART"
      />
      <WordAssemblyBoard
        parts={data.wordAssembly.parts}
        order={order}
        correctIds={correctIds}
        incorrectIds={incorrectIds}
        disabled={awaitingNext || retryRequired || submitting || timingOut || remaining <= 0}
        onReorder={reorder}
      />
      <GameActionArea
        feedback={feedback ?? externalFeedback}
        action={{
          label: awaitingNext
            ? nextActionLabel
            : retryRequired ? "Försök igen"
            : timingOut ? "Tiden registreras…" : "Kontrollera ordning",
          busyLabel: awaitingNext
            ? `${nextActionLabel}…`
            : retryRequired ? "Startar om…" : "Kontrollerar…",
          busy: submitting || navigating || retryingChallenge,
          disabled: awaitingNext
            ? navigating
            : retryRequired
              ? submitting || retryingChallenge
              : order.length === 0 || submitting || timingOut,
          onClick: () => void (awaitingNext
            ? onNextChallenge()
            : retryRequired ? retryAttempt() : submit()),
        }}
      />
    </>
  );
}
