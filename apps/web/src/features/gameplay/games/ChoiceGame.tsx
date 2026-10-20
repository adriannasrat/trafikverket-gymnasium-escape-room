import { useState } from "react";
import { AnswerChoiceBoard } from "../../../components/AnswerChoiceBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

type ChoiceGameProps = GameRuntimeProps & {
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
  onChallengeComplete,
  onSessionComplete,
  onRestartChallenge,
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
      } else if (result.challengeStartedAtUtc) {
        setSelected("");
        onRestartChallenge(result);
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

  return (
    <>
      {data.challenge.imagePath && (
        <img
          className="mt-[22px] block max-h-[360px] w-full bg-white object-contain p-3"
          src={data.challenge.imagePath}
          alt="Ledtråd till uppdraget"
        />
      )}
      <GameChallengeTimer
        remaining={remaining}
        total={data.challenge.timeLimitSeconds}
        complete={awaitingNext}
      />
      <AnswerChoiceBoard
        options={data.challenge.options}
        selectedId={selected}
        variant={variant}
        disabled={awaitingNext || submitting || timingOut}
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
            : timingOut ? "Tiden registreras…" : "Bekräfta svar",
          busyLabel: awaitingNext ? `${nextActionLabel}…` : "Kontrollerar…",
          busy: submitting || navigating,
          disabled: awaitingNext
            ? navigating
            : !selected || submitting || timingOut,
          onClick: () => void (awaitingNext ? onNextChallenge() : submit()),
        }}
      />
    </>
  );
}
