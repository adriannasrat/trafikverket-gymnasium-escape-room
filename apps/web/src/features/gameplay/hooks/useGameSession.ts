import { useCallback, useEffect, useState } from "react";
import { updateChallengeProgress } from "../../../lib/challenge";
import { api } from "../../../lib/api";
import type { Challenge, ChallengeProgress } from "../../../types";

type TerminalSession = {
  playerName: string;
  elapsedMilliseconds: number;
  score: number;
  livesRemaining: number;
};

export function useGameSession(sessionId: string) {
  const [data, setData] = useState<Challenge | null>(null);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [terminal, setTerminal] = useState<TerminalSession | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const loadChallenge = useCallback(async () => {
    const result = await api.currentChallenge(sessionId);
    if (result.completed) {
      setTerminal(result);
      setCompleted(!result.failed);
      setFailed(result.failed);
      return null;
    }

    setData(result);
    setCompleted(false);
    setFailed(false);
    setTerminal(null);
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
    failed,
    terminal,
    error,
    revision,
    loadChallenge,
    markCompleted: useCallback(() => setCompleted(true), []),
    markFailed: useCallback(() => setFailed(true), []),
    updateProgress,
    replaceData: useCallback((next: Challenge) => setData(next), []),
  };
}
