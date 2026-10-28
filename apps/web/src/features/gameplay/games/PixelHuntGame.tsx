import { useState } from "react";
import { AnswerChoiceBoard } from "../../../components/AnswerChoiceBoard";
import { PixelRevealBoard } from "../../../components/PixelRevealBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

export function PixelHuntGame({
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
  onSessionComplete,
  onRestartChallenge,
  onPauseChallenge,
  onRetryChallenge,
  retryingChallenge,
  onNextChallenge,
}: GameRuntimeProps<"PixelHunt">) {
  const [selected, setSelected] = useState("");
  const [revealCount, setRevealCount] = useState(data.challenge.pixelRevealCount);
  const [revealing, setRevealing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(() => awaitingNext
    ? { correct: true, text: "Frågan är klar. Gå vidare när du är redo." }
    : null);

  async function revealPixel() {
    if (awaitingNext || revealing || submitting || timingOut || remaining <= 0) return;
    setRevealing(true);
    setFeedback(null);
    onClearExternalFeedback();
    try {
      const result = await api.revealPixel(sessionId, data.challenge.id);
      onProgressChange(result.progress);
      onElapsedChange(result.elapsedMilliseconds);
      setRevealCount(result.pixelRevealCount);
      if (result.expired && result.challengeStartedAtUtc) {
        setSelected("");
        onRestartChallenge(result);
        setFeedback({
          correct: false,
          text: result.message ?? "Game over – tiden tog slut.",
        });
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error ? caught.message : "Bilden kunde inte skärpas.",
      });
    } finally {
      setRevealing(false);
    }
  }

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
      if (result.elapsedMilliseconds !== undefined) onElapsedChange(result.elapsedMilliseconds);
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
      setRevealCount(0);
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
      <PixelRevealBoard
        imagePath={data.challenge.imagePath}
        revealCount={awaitingNext ? 5 : revealCount}
        disabled={awaitingNext || retryRequired || revealing || submitting || timingOut || remaining <= 0}
        onReveal={() => void revealPixel()}
      />
      <AnswerChoiceBoard
        options={data.challenge.options}
        selectedId={selected}
        variant="multiple-choice"
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
              : !selected || submitting || timingOut || revealing,
          onClick: () => void (awaitingNext
            ? onNextChallenge()
            : retryRequired ? retryAttempt() : submit()),
        }}
      />
    </>
  );
}
