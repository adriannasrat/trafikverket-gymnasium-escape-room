import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

export function useSessionRetry(playerName?: string) {
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const retry = useCallback(async () => {
    if (!playerName || retrying) return;

    setRetrying(true);
    setRetryError("");
    try {
      const session = await api.startSession(playerName);
      navigate(`/play/${session.id}`, { replace: true });
    } catch (caught) {
      setRetryError(caught instanceof Error
        ? caught.message
        : "En ny spelomgång kunde inte startas.");
      setRetrying(false);
    }
  }, [navigate, playerName, retrying]);

  return { retry, retrying, retryError };
}
