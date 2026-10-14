import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { ApiError, api } from "../lib/api";
import type { AdminGame } from "../types";

const AUTOSAVE_DELAY_MS = 700;
const AUTOSAVE_RETRY_DELAY_MS = 2500;

export type AdminAutosaveState = {
  phase: "idle" | "pending" | "saving" | "saved" | "error";
  message: string;
};

type UseAdminAutosaveOptions = {
  gamesRef: MutableRefObject<AdminGame[] | null>;
  setGames: Dispatch<SetStateAction<AdminGame[] | null>>;
  onUnauthorized: () => void;
};

export function useAdminAutosave({
  gamesRef,
  setGames,
  onUnauthorized,
}: UseAdminAutosaveOptions) {
  const [autosaveState, setAutosaveState] = useState<AdminAutosaveState>({
    phase: "idle",
    message: "Automatisk sparning är aktiv.",
  });
  const revisionsRef = useRef(new Map<string, number>());
  const savedRevisionsRef = useRef(new Map<string, number>());
  const saveTimersRef = useRef(new Map<string, number>());
  const savesInFlightRef = useRef(new Map<string, Promise<boolean>>());
  const mutatingGameIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  function hasUnsavedChanges() {
    return [...revisionsRef.current].some(
      ([gameId, revision]) =>
        (savedRevisionsRef.current.get(gameId) ?? 0) < revision,
    );
  }

  function clearSaveTimer(gameId: string) {
    const timer = saveTimersRef.current.get(gameId);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimersRef.current.delete(gameId);
  }

  function scheduleSave(gameId: string, delay = AUTOSAVE_DELAY_MS) {
    clearSaveTimer(gameId);
    const timer = window.setTimeout(() => {
      saveTimersRef.current.delete(gameId);
      void persistGame(gameId);
    }, delay);
    saveTimersRef.current.set(gameId, timer);
  }

  function persistGame(gameId: string): Promise<boolean> {
    const existingSave = savesInFlightRef.current.get(gameId);
    if (existingSave) return existingSave;
    if (mutatingGameIdRef.current === gameId) return Promise.resolve(false);

    const revision = revisionsRef.current.get(gameId) ?? 0;
    if ((savedRevisionsRef.current.get(gameId) ?? 0) >= revision) {
      return Promise.resolve(true);
    }

    const snapshot = gamesRef.current?.find(
      (candidate) => candidate.id === gameId,
    );
    if (!snapshot) return Promise.resolve(false);

    clearSaveTimer(gameId);
    setAutosaveState({
      phase: "saving",
      message: "Sparar ändringarna automatiskt…",
    });

    const saveOperation = (async () => {
      let succeeded = false;
      let shouldRetry = false;
      try {
        const saved = await api.updateGame(snapshot);
        savedRevisionsRef.current.set(gameId, revision);
        succeeded = true;

        if ((revisionsRef.current.get(gameId) ?? 0) === revision) {
          const nextGames = gamesRef.current?.map((candidate) =>
            candidate.id === saved.id ? saved : candidate,
          ) ?? null;
          gamesRef.current = nextGames;
          if (mountedRef.current) setGames(nextGames);
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          onUnauthorized();
          return false;
        }

        const hasNewerDraft =
          (revisionsRef.current.get(gameId) ?? 0) > revision;
        shouldRetry = hasNewerDraft ||
          !(caught instanceof ApiError) ||
          caught.status >= 500;
        if (mountedRef.current) {
          setAutosaveState({
            phase: "error",
            message: shouldRetry
              ? "Kunde inte spara. Försöker igen automatiskt…"
              : caught instanceof Error
                ? caught.message
                : "Ändringarna kunde inte sparas automatiskt.",
          });
        }
      } finally {
        savesInFlightRef.current.delete(gameId);
        const latestRevision = revisionsRef.current.get(gameId) ?? 0;
        const savedRevision = savedRevisionsRef.current.get(gameId) ?? 0;

        if (mountedRef.current && latestRevision > savedRevision) {
          if (succeeded) scheduleSave(gameId, 0);
          else if (shouldRetry) scheduleSave(gameId, AUTOSAVE_RETRY_DELAY_MS);
        } else if (
          mountedRef.current &&
          savesInFlightRef.current.size === 0 &&
          !hasUnsavedChanges()
        ) {
          setAutosaveState({
            phase: "saved",
            message: "Alla ändringar är sparade.",
          });
        }
      }
      return succeeded;
    })();

    savesInFlightRef.current.set(gameId, saveOperation);
    return saveOperation;
  }

  const initialize = useCallback((games: AdminGame[]) => {
    revisionsRef.current = new Map(games.map((game) => [game.id, 0]));
    savedRevisionsRef.current = new Map(games.map((game) => [game.id, 0]));
  }, []);

  function markChanged(gameId: string) {
    revisionsRef.current.set(
      gameId,
      (revisionsRef.current.get(gameId) ?? 0) + 1,
    );
    scheduleSave(gameId);
    setAutosaveState({
      phase: "pending",
      message: "Ändringarna sparas automatiskt…",
    });
  }

  async function flushPendingSaves() {
    for (const gameId of saveTimersRef.current.keys()) clearSaveTimer(gameId);

    while (hasUnsavedChanges()) {
      const dirtyGameIds = [...revisionsRef.current]
        .filter(
          ([gameId, revision]) =>
            (savedRevisionsRef.current.get(gameId) ?? 0) < revision,
        )
        .map(([gameId]) => gameId);
      const results = await Promise.all(dirtyGameIds.map(persistGame));
      if (results.some((saved) => !saved)) return false;
    }
    return true;
  }

  function beginMutation(gameId: string) {
    mutatingGameIdRef.current = gameId;
    clearSaveTimer(gameId);
  }

  function endMutation(gameId: string) {
    mutatingGameIdRef.current = null;
    const revision = revisionsRef.current.get(gameId) ?? 0;
    if ((savedRevisionsRef.current.get(gameId) ?? 0) < revision) {
      scheduleSave(gameId, 0);
    }
  }

  async function waitForActiveSave(gameId: string) {
    await savesInFlightRef.current.get(gameId);
  }

  useEffect(() => {
    mountedRef.current = true;
    const saveTimers = saveTimersRef.current;
    const warnAboutPendingChanges = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnAboutPendingChanges);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", warnAboutPendingChanges);
      for (const timer of saveTimers.values()) window.clearTimeout(timer);
      saveTimers.clear();
    };
  }, []);

  return {
    autosaveState,
    initialize,
    markChanged,
    flushPendingSaves,
    beginMutation,
    endMutation,
    waitForActiveSave,
  };
}
