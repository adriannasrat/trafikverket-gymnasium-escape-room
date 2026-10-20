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
  onChallengeComplete,
  onSessionComplete,
  onRestartChallenge,
  onNextChallenge,
}: GameRuntimeProps) {
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
      onElapsedChange(result.elapsedMilliseconds);
      setRevealCount(result.pixelRevealCount);
      if (result.expired && result.challengeStartedAtUtc) {
        setSelected("");
        onRestartChallenge(result);
        setFeedback({
          correct: false,
          text: result.message ?? "Tiden tog slut. Försök igen.",
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
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.elapsedMilliseconds !== undefined) onElapsedChange(result.elapsedMilliseconds);
      if (result.completed) {
        onSessionComplete();
      } else if (result.correct) {
        onChallengeComplete();
      } else if (result.challengeStartedAtUtc) {
        setSelected("");
        setRevealCount(0);
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
      <GameChallengeTimer
        remaining={remaining}
        total={data.challenge.timeLimitSeconds}
        complete={awaitingNext}
      />
      <PixelRevealBoard
        imagePath={data.challenge.imagePath}
        revealCount={awaitingNext ? 5 : revealCount}
        disabled={awaitingNext || revealing || submitting || timingOut || remaining <= 0}
        onReveal={() => void revealPixel()}
      />
      <AnswerChoiceBoard
        options={data.challenge.options}
        selectedId={selected}
        variant="multiple-choice"
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
            : !selected || submitting || timingOut || revealing,
          onClick: () => void (awaitingNext ? onNextChallenge() : submit()),
        }}
      />
    </>
  );
}
