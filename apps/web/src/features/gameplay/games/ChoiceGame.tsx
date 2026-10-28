import { useState } from "react";
import { AnswerChoiceBoard } from "../../../components/AnswerChoiceBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

type ChoiceGameProps = GameRuntimeProps<"Quiz" | "TrueFalse"> & {
  variant: "multiple-choice" | "true-false";
};

export function ChoiceGame({
  data,
  sessionId,
  remaining,
  awaitingNext,
  timingOut,
  externalFeedback,
  nextActionLabel,
  navigating,
  variant,
  onClearExternalFeedback,
  onElapsedChange,
  onProgressChange,
  onChallengeComplete,
  onSessionComplete,
  onPauseChallenge,
  onRetryChallenge,
  retryingChallenge,
  onNextChallenge,
}: ChoiceGameProps) {
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(() => awaitingNext
    ? { correct: true, text: "Frågan är klar. Gå vidare när du är redo." }
    : null);

  async function submit() {
    if (!selected || awaitingNext || timingOut) return;
    setSubmitting(true);
    setFeedback(null);
    onClearExternalFeedback();
    try {
      const result = await api.answer(sessionId, data.challenge.id, selected);
      onProgressChange(result.progress);
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.elapsedMilliseconds !== undefined) {
        onElapsedChange(result.elapsedMilliseconds);
      }
      if (result.completed) {
        onSessionComplete();
      } else if (result.correct) {
        onChallengeComplete();
      } else if (!result.progress?.gameOver) {
        onPauseChallenge(result);
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error ? caught.message : "Svaret kunde inte skickas.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function retryAttempt() {
    setSubmitting(true);
    try {
      await onRetryChallenge();
      setSelected("");
      setFeedback(null);
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error ? caught.message : "Frågan kunde inte startas om.",
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
      />
      <AnswerChoiceBoard
        options={data.challenge.options}
        selectedId={selected}
        variant={variant}
        disabled={awaitingNext || retryRequired || submitting || timingOut}
        completed={awaitingNext}
        onSelect={(optionId) => {
          setSelected(optionId);
          setFeedback(null);
          onClearExternalFeedback();
        }}
      />
      <GameActionArea
        feedback={feedback ?? externalFeedback}
        action={{
          label: awaitingNext
            ? nextActionLabel
            : retryRequired ? "Försök igen"
            : timingOut ? "Tiden registreras…" : "Bekräfta svar",
          busyLabel: awaitingNext
            ? `${nextActionLabel}…`
            : retryRequired ? "Startar om…" : "Kontrollerar…",
          busy: submitting || navigating || retryingChallenge,
          disabled: awaitingNext
            ? navigating
            : retryRequired
              ? submitting || retryingChallenge
              : !selected || submitting || timingOut,
          onClick: () => void (awaitingNext
            ? onNextChallenge()
            : retryRequired ? retryAttempt() : submit()),
        }}
      />
    </>
  );
}
