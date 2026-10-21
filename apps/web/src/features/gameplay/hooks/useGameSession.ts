import { useCallback, useEffect, useState } from "react";
import { updateChallengeProgress } from "../../../lib/challenge";
import { api } from "../../../lib/api";
import type { Challenge, ChallengeProgress } from "../../../types";

export function useGameSession(sessionId: string) {
  const [data, setData] = useState<Challenge | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const loadChallenge = useCallback(async () => {
    const result = await api.currentChallenge(sessionId);
    if (result.completed) {
      setCompleted(true);
      return null;
    }

    setData(result);
    setCompleted(false);
    setError("");
    setRevision((current) => current + 1);
    window.scrollTo(0, 0);
    return result;
  }, [sessionId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- synchronize the page with the persisted session.
    loadChallenge().catch(() => setError("Uppdraget kunde inte laddas."));
  }, [loadChallenge]);

  const updateProgress = useCallback((update: Partial<ChallengeProgress>) => {
    setData((current) => current
      ? updateChallengeProgress(current, update)
      : current);
  }, []);

  return {
    data,
    completed,
    error,
    revision,
    loadChallenge,
    markCompleted: useCallback(() => setCompleted(true), []),
    updateProgress,
    replaceData: useCallback((next: Challenge) => setData(next), []),
  };
}
