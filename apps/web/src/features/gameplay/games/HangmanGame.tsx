import { useState } from "react";
import { HangmanBoard } from "../../../components/HangmanBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

export function HangmanGame({
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
  onReplaceData,
  onNextChallenge,
}: GameRuntimeProps<"Hangman">) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(() => awaitingNext
    ? { correct: true, text: "Signalordet är löst. Gå vidare när du är redo." }
    : null);

  async function guessLetter(letter: string) {
    if (awaitingNext || timingOut || submitting || remaining <= 0) return;
    setSubmitting(true);
    setFeedback(null);
    onClearExternalFeedback();
    try {
      const result = await api.submitHangmanGuess(sessionId, data.challenge.id, letter);
      const resetPattern = result.roundReset
        ? result.hangman.pattern.map((character) =>
            character === " " || character === "-" ? character : null)
        : result.hangman.pattern;
      onReplaceData({
        ...data,
        challenge: {
          ...data.challenge,
          challengeStartedAtUtc: result.challengeStartedAtUtc
            ?? data.challenge.challengeStartedAtUtc,
        },
        hangman: result.roundReset
          ? { ...result.hangman, pattern: resetPattern, guessedLetters: [] }
          : result.hangman,
      });
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.elapsedMilliseconds !== undefined) onElapsedChange(result.elapsedMilliseconds);
      if (result.roundReset) {
        onRestartChallenge(result);
      } else if (result.solved) {
        onChallengeComplete();
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error ? caught.message : "Bokstaven kunde inte skickas.",
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
          alt="Ledtråd till signalordet"
        />
      )}
      <GameChallengeTimer
        remaining={remaining}
        total={data.challenge.timeLimitSeconds}
        complete={awaitingNext}
        completeLabel="SIGNALORDET ÄR LÖST"
      />
      <HangmanBoard
        pattern={data.hangman.pattern}
        guessedLetters={data.hangman.guessedLetters}
        mistakes={data.hangman.mistakes}
        maxMistakes={data.hangman.maxMistakes}
        disabled={awaitingNext || timingOut || remaining <= 0}
        submitting={submitting}
        onGuess={(letter) => void guessLetter(letter)}
      />
      <GameActionArea
        feedback={feedback ?? externalFeedback}
        action={awaitingNext ? {
          label: nextActionLabel,
          busyLabel: `${nextActionLabel}…`,
          busy: navigating,
          disabled: navigating,
          onClick: () => void onNextChallenge(),
        } : undefined}
      />
    </>
  );
}
