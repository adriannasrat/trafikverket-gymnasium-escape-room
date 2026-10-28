import { useState } from "react";
import { MatchingBoard } from "../../../components/MatchingBoard";
import { api } from "../../../lib/api";
import type { GameRuntimeProps } from "../types";
import { GameActionArea } from "../components/GameFeedback";
import { GameChallengeTimer } from "../components/GameChallengeTimer";

export function MatchingGame({
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
  onProgressChange,
  onChallengeComplete,
  onRestartChallenge,
  onPauseChallenge,
  onRetryChallenge,
  retryingChallenge,
  onNextChallenge,
}: GameRuntimeProps<"Matching">) {
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [lockedScenarioIds, setLockedScenarioIds] = useState<Set<string>>(() => new Set());
  const [invalidScenarioIds, setInvalidScenarioIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(() => awaitingNext
    ? { correct: true, text: "Alla kopplingar är klara. Gå vidare när du är redo." }
    : null);

  function selectScenario(scenarioId: string) {
    if (lockedScenarioIds.has(scenarioId) || awaitingNext) return;
    if (invalidScenarioIds.has(scenarioId)) {
      setConnections((current) => {
        const next = { ...current };
        delete next[scenarioId];
        return next;
      });
      setInvalidScenarioIds((current) => {
        const next = new Set(current);
        next.delete(scenarioId);
        return next;
      });
    }
    setActiveScenarioId((current) => current === scenarioId ? null : scenarioId);
    setFeedback(null);
    onClearExternalFeedback();
  }

  function selectDestination(destination: string) {
    if (!activeScenarioId || awaitingNext) return;
    setConnections((current) => {
      const next = { ...current };
      const previousScenario = Object.entries(next)
        .find(([, target]) => target === destination)?.[0];
      if (previousScenario && !lockedScenarioIds.has(previousScenario)) {
        delete next[previousScenario];
      }
      next[activeScenarioId] = destination;
      return next;
    });
    setInvalidScenarioIds((current) => {
      const next = new Set(current);
      next.delete(activeScenarioId);
      return next;
    });
    setActiveScenarioId(null);
    setFeedback(null);
    onClearExternalFeedback();
  }

  async function submit() {
    if (awaitingNext || timingOut) return;
    const selections = data.matching.scenarios.flatMap((scenario) => {
      const destination = connections[scenario.id];
      const option = scenario.options.find((candidate) => candidate.text === destination);
      return option ? [{ challengeId: scenario.id, optionId: option.id }] : [];
    });
    if (selections.length !== data.matching.scenarios.length) return;

    setSubmitting(true);
    setFeedback(null);
    onClearExternalFeedback();
    try {
      const result = await api.submitMatches(sessionId, data.challenge.id, selections);
      onProgressChange(result.progress);
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.elapsedMilliseconds !== undefined) onElapsedChange(result.elapsedMilliseconds);

      if (result.expired) {
        setConnections({});
        setLockedScenarioIds(new Set());
        setInvalidScenarioIds(new Set());
        setActiveScenarioId(null);
        onRestartChallenge(result);
      } else if (result.correct) {
        setLockedScenarioIds(new Set(data.matching.scenarios.map((scenario) => scenario.id)));
        setInvalidScenarioIds(new Set());
        onChallengeComplete();
      } else {
        const invalid = new Set(result.incorrectChallengeIds);
        setInvalidScenarioIds(invalid);
        setLockedScenarioIds(new Set(
          data.matching.scenarios
            .filter((scenario) => !invalid.has(scenario.id))
            .map((scenario) => scenario.id),
        ));
        if (!result.progress?.gameOver) onPauseChallenge(result);
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error
          ? caught.message
          : "Kopplingarna kunde inte kontrolleras.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function retryAttempt() {
    setSubmitting(true);
    try {
      await onRetryChallenge();
      setActiveScenarioId(null);
      setFeedback(null);
    } catch (caught) {
      setFeedback({
        correct: false,
        text: caught instanceof Error ? caught.message : "Kopplingarna kunde inte startas om.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const allScenariosConnected = data.matching.scenarios
    .every((scenario) => Boolean(connections[scenario.id]));
  const retryRequired = data.challenge.retryRequired;

  return (
    <>
      <GameChallengeTimer
        remaining={remaining}
        total={data.challenge.timeLimitSeconds}
        complete={awaitingNext}
        completeLabel="KOPPLINGARNA ÄR KLARA"
      />
      <MatchingBoard
        scenarios={data.matching.scenarios}
        destinations={data.matching.destinations}
        connections={connections}
        activeScenarioId={activeScenarioId}
        lockedIds={lockedScenarioIds}
        invalidIds={invalidScenarioIds}
        disabled={awaitingNext || retryRequired || submitting || timingOut}
        onSelectScenario={selectScenario}
        onSelectDestination={selectDestination}
      />
      <GameActionArea
        feedback={feedback ?? externalFeedback}
        action={{
          label: awaitingNext
            ? nextActionLabel
            : retryRequired ? "Försök igen"
            : timingOut ? "Tiden registreras…" : "Kontrollera kopplingar",
          busyLabel: awaitingNext
            ? `${nextActionLabel}…`
            : retryRequired ? "Startar om…" : "Kontrollerar…",
          busy: submitting || navigating || retryingChallenge,
          disabled: awaitingNext
            ? navigating
            : retryRequired
              ? submitting || retryingChallenge
              : !allScenariosConnected || submitting || timingOut,
          onClick: () => void (awaitingNext
            ? onNextChallenge()
            : retryRequired ? retryAttempt() : submit()),
        }}
      />
    </>
  );
}
