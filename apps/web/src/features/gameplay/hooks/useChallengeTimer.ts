import { useCallback, useEffect, useState } from "react";
import type { Challenge } from "../../../types";

type ChallengeTimerOptions = {
  data: Challenge | null;
  completed: boolean;
  revision: number;
};

export function useChallengeTimer({ data, completed, revision }: ChallengeTimerOptions) {
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [locallyCompletedChallengeId, setLocallyCompletedChallengeId] = useState<string | null>(null);
  const challengeId = data?.challenge.id;
  const awaitingNext = Boolean(
    data?.challenge.awaitingNext
    || (challengeId && locallyCompletedChallengeId === challengeId),
  );
  const retryRequired = Boolean(data?.challenge.retryRequired);

  // Revision changes only when useGameSession installs a fresh server snapshot.
  // Direct in-round data updates must not reset the locally ticking clock.
  // oxlint-disable react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data) return;
    // oxlint-disable-next-line react/set-state-in-effect -- a server refresh starts or restores the authoritative clock.
    setElapsed(data.elapsedMilliseconds);
    setRemaining(data.challenge.secondsRemaining);
  }, [revision]);
  // oxlint-enable react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data || completed) return;
    let previousTick = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - previousTick;
      previousTick = now;
      if (!awaitingNext && !retryRequired) setElapsed((current) => current + delta);
      if (awaitingNext || retryRequired) return;

      const challengeElapsed =
        (Date.now() - new Date(data.challenge.challengeStartedAtUtc).getTime()) / 1000
        + data.challenge.currentChallengePenaltyMilliseconds / 1000;
      setRemaining(Math.max(0, data.challenge.timeLimitSeconds - challengeElapsed));
    };

    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [
    awaitingNext,
    retryRequired,
    completed,
    data?.challenge.challengeStartedAtUtc,
    data?.challenge.currentChallengePenaltyMilliseconds,
    data?.challenge.timeLimitSeconds,
    data,
  ]);

  const completeChallenge = useCallback(() => {
    if (challengeId) setLocallyCompletedChallengeId(challengeId);
    setRemaining(0);
  }, [challengeId]);

  const restartChallenge = useCallback((secondsRemaining: number) => {
    setLocallyCompletedChallengeId(null);
    setRemaining(secondsRemaining);
  }, []);

  const pauseChallenge = useCallback((secondsRemaining: number) => {
    setRemaining(secondsRemaining);
  }, []);

  return {
    elapsed,
    remaining,
    awaitingNext,
    setElapsed,
    setRemaining,
    completeChallenge,
    restartChallenge,
    pauseChallenge,
  };
}
