import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import type { Challenge, SessionProgress } from "../../../types";
import type { GameFeedbackMessage } from "../types";

type ChallengeTimeoutOptions = {
  sessionId: string;
  data: Challenge | null;
  completed: boolean;
  awaitingNext: boolean;
  remaining: number;
  reloadChallenge: () => Promise<Challenge | null>;
  onProgressChange: (progress?: SessionProgress) => void;
};

export function useChallengeTimeout({
  sessionId,
  data,
  completed,
  awaitingNext,
  remaining,
  reloadChallenge,
  onProgressChange,
}: ChallengeTimeoutOptions) {
  const [timingOut, setTimingOut] = useState(false);
  const [feedback, setFeedback] = useState<GameFeedbackMessage | null>(null);
  const handledRoundRef = useRef("");

  useEffect(() => {
    if (!data || completed || awaitingNext || timingOut || remaining > 0) return;

    const roundKey = `${data.challenge.id}:${data.challenge.challengeStartedAtUtc}`;
    const deadline = new Date(data.challenge.challengeStartedAtUtc).getTime()
      + data.challenge.timeLimitSeconds * 1000
      - data.challenge.currentChallengePenaltyMilliseconds;
    if (Date.now() < deadline || handledRoundRef.current === roundKey) return;

    handledRoundRef.current = roundKey;
    // oxlint-disable-next-line react/set-state-in-effect -- reaching zero initiates one persisted timeout operation.
    setTimingOut(true);
    api.timeout(sessionId, data.challenge.id)
      .then(async (result) => {
        onProgressChange(result.progress);
        if (result.progress?.gameOver) return;
        await reloadChallenge();
        if (result.expired) {
          setFeedback({
            correct: false,
            text: result.message ?? "Game over – tiden tog slut.",
          });
        }
      })
      .catch((caught) => {
        setFeedback({
          correct: false,
          text: caught instanceof Error
            ? caught.message
            : "Tiden kunde inte registreras.",
        });
      })
      .finally(() => setTimingOut(false));
  }, [
    awaitingNext,
    completed,
    data,
    reloadChallenge,
    onProgressChange,
    remaining,
    sessionId,
    timingOut,
  ]);

  return {
    timingOut,
    feedback,
    clearFeedback: useCallback(() => setFeedback(null), []),
  };
}
