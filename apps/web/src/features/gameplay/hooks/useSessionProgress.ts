import { useCallback, useRef, useState } from "react";
import type { Challenge, SessionProgress } from "../../../types";

export type ProgressAnimation =
  | { id: number; type: "score"; amount: number }
  | { id: number; type: "life"; livesRemaining: number; gameOver: boolean };

export function useSessionProgress(data: Challenge | null) {
  const [localProgress, setLocalProgress] = useState<{
    sessionId: string;
    score: number;
    livesRemaining: number;
  } | null>(null);
  const [animation, setAnimation] = useState<ProgressAnimation | null>(null);
  const animationId = useRef(0);
  const score = localProgress !== null && localProgress.sessionId === data?.sessionId
    ? localProgress.score
    : data?.score ?? 0;
  const livesRemaining = localProgress !== null && localProgress.sessionId === data?.sessionId
    ? localProgress.livesRemaining
    : data?.livesRemaining ?? 5;

  const apply = useCallback((progress?: SessionProgress) => {
    if (!progress) return;
    setLocalProgress({
      sessionId: data?.sessionId ?? "",
      score: progress.score,
      livesRemaining: progress.livesRemaining,
    });
    animationId.current += 1;
    if (progress.scoreAwarded > 0) {
      setAnimation({
        id: animationId.current,
        type: "score",
        amount: progress.scoreAwarded,
      });
    } else if (progress.lifeLost) {
      setAnimation({
        id: animationId.current,
        type: "life",
        livesRemaining: progress.livesRemaining,
        gameOver: progress.gameOver,
      });
    }
  }, [data?.sessionId]);

  return {
    score,
    livesRemaining,
    animation,
    apply,
    clearAnimation: useCallback(() => setAnimation(null), []),
  };
}
