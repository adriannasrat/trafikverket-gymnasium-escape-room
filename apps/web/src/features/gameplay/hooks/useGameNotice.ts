import { useCallback, useState } from "react";
import type { GameFeedbackMessage } from "../types";

export function useGameNotice() {
  const [feedback, setFeedback] = useState<GameFeedbackMessage | null>(null);
  return {
    feedback,
    showFeedback: useCallback((message: GameFeedbackMessage) => setFeedback(message), []),
    clearFeedback: useCallback(() => setFeedback(null), []),
  };
}
