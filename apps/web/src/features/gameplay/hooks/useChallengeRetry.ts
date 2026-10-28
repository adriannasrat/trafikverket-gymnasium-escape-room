import { useCallback, useState } from "react";
import { api } from "../../../lib/api";
import type { Challenge, ChallengeProgress } from "../../../types";
import type { ChallengeRestart } from "../types";

type ChallengeRetryOptions = {
  sessionId: string;
  data: Challenge | null;
  onUpdateProgress: (update: Partial<ChallengeProgress>) => void;
  onRestart: (restart: ChallengeRestart) => void;
  onClearFeedback: () => void;
};

export function useChallengeRetry({
  sessionId,
  data,
  onUpdateProgress,
  onRestart,
  onClearFeedback,
}: ChallengeRetryOptions) {
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(async () => {
    if (!data || retrying) return;

    setRetrying(true);
    try {
      const result = await api.retryChallenge(sessionId, data.challenge.id);
      onUpdateProgress({
        retryRequired: false,
        challengeStartedAtUtc: result.challengeStartedAtUtc,
        timeLimitSeconds: result.timeLimitSeconds,
        currentChallengePenaltyMilliseconds:
          result.currentChallengePenaltyMilliseconds,
        secondsRemaining: result.secondsRemaining,
      });
      onRestart(result);
      onClearFeedback();
    } finally {
      setRetrying(false);
    }
  }, [data, onClearFeedback, onRestart, onUpdateProgress, retrying, sessionId]);

  return { retry, retrying };
}
