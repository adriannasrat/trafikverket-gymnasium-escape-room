import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { LoadingScreen } from "../components/LoadingScreen";
import { MissionRoute } from "../components/MissionRoute";
import { GameCompletion } from "../features/gameplay/components/GameCompletion";
import { GameError } from "../features/gameplay/components/GameError";
import { GameFailure } from "../features/gameplay/components/GameFailure";
import { GameHeading } from "../features/gameplay/components/GameHeading";
import { GameRenderer } from "../features/gameplay/games/GameRenderer";
import { ProgressAnimation } from "../features/gameplay/components/ProgressAnimation";
import { useChallengeTimeout } from "../features/gameplay/hooks/useChallengeTimeout";
import { useChallengeTimer } from "../features/gameplay/hooks/useChallengeTimer";
import { useChallengeRetry } from "../features/gameplay/hooks/useChallengeRetry";
import { useGameNavigation } from "../features/gameplay/hooks/useGameNavigation";
import { useGameNotice } from "../features/gameplay/hooks/useGameNotice";
import { useGameSession } from "../features/gameplay/hooks/useGameSession";
import { useSessionProgress } from "../features/gameplay/hooks/useSessionProgress";
import { useSessionRetry } from "../features/gameplay/hooks/useSessionRetry";
import type { ChallengeRestart, GameFeedbackMessage } from "../features/gameplay/types";
import { formatElapsed } from "../lib/time";
import type { SessionProgress } from "../types";

export function GamePage() {
  const { sessionId = "" } = useParams();
  const session = useGameSession(sessionId);
  const markSessionFailed = session.markFailed;
  const playerName = session.terminal?.playerName ?? session.data?.playerName;
  const retry = useSessionRetry(playerName);
  const {
    score,
    livesRemaining,
    animation,
    apply: applyProgress,
    clearAnimation,
  } = useSessionProgress(session.data);
  const [pendingFailure, setPendingFailure] = useState(false);
  const handleProgressChange = useCallback((update?: SessionProgress) => {
    applyProgress(update);
    if (update?.gameOver) setPendingFailure(true);
  }, [applyProgress]);
  const timer = useChallengeTimer({
    data: session.data,
    completed: session.completed,
    revision: session.revision,
  });
  const timeout = useChallengeTimeout({
    sessionId,
    data: session.data,
    completed: session.completed,
    awaitingNext: timer.awaitingNext || Boolean(session.data?.challenge.retryRequired),
    remaining: timer.remaining,
    reloadChallenge: session.loadChallenge,
    onProgressChange: handleProgressChange,
  });
  const notice = useGameNotice();

  const clearBeforeNavigation = useCallback(() => {
    timeout.clearFeedback();
    notice.clearFeedback();
  }, [notice, timeout]);
  const navigation = useGameNavigation({
    sessionId,
    data: session.data,
    awaitingNext: timer.awaitingNext,
    reloadChallenge: session.loadChallenge,
    onBeforeNavigate: clearBeforeNavigation,
  });

  const clearExternalFeedback = useCallback(() => {
    timeout.clearFeedback();
    navigation.clearFeedback();
    notice.clearFeedback();
  }, [navigation, notice, timeout]);

  const restartChallenge = useCallback((restart: ChallengeRestart) => {
    const current = session.data;
    if (!current) return;

    const fallbackLimit = current.challenge.timeLimitSeconds;
    const secondsRemaining = restart.secondsRemaining
      ?? restart.timeLimitSeconds
      ?? fallbackLimit;

    session.updateProgress({
      challengeStartedAtUtc: restart.challengeStartedAtUtc
        ?? current.challenge.challengeStartedAtUtc,
      timeLimitSeconds: restart.timeLimitSeconds
        ?? current.challenge.timeLimitSeconds,
      currentChallengePenaltyMilliseconds:
        restart.currentChallengePenaltyMilliseconds
        ?? current.challenge.currentChallengePenaltyMilliseconds,
      secondsRemaining,
    });
    timer.restartChallenge(secondsRemaining);
  }, [session, timer]);

  const pauseChallenge = useCallback((restart: ChallengeRestart) => {
    const current = session.data;
    if (!current) return;

    const secondsRemaining = restart.secondsRemaining ?? timer.remaining;
    session.updateProgress({
      retryRequired: true,
      challengeStartedAtUtc: restart.challengeStartedAtUtc
        ?? current.challenge.challengeStartedAtUtc,
      timeLimitSeconds: restart.timeLimitSeconds
        ?? current.challenge.timeLimitSeconds,
      currentChallengePenaltyMilliseconds:
        restart.currentChallengePenaltyMilliseconds
        ?? current.challenge.currentChallengePenaltyMilliseconds,
      secondsRemaining,
    });
    timer.pauseChallenge(secondsRemaining);
  }, [session, timer]);

  const challengeRetry = useChallengeRetry({
    sessionId,
    data: session.data,
    onUpdateProgress: session.updateProgress,
    onRestart: restartChallenge,
    onClearFeedback: clearExternalFeedback,
  });

  const reloadChallenge = useCallback(async (feedback?: GameFeedbackMessage) => {
    await session.loadChallenge();
    if (feedback) notice.showFeedback(feedback);
  }, [notice, session]);

  const finishProgressAnimation = useCallback(() => {
    clearAnimation();
    if (pendingFailure) {
      setPendingFailure(false);
      markSessionFailed();
    }
  }, [clearAnimation, markSessionFailed, pendingFailure]);

  if (session.error) return <GameError message={session.error} />;
  if (session.failed) {
    return (
      <GameFailure
        playerName={playerName}
        score={session.terminal?.score ?? score}
        retrying={retry.retrying}
        retryError={retry.retryError}
        onRetry={() => void retry.retry()}
      />
    );
  }
  if (session.completed) {
    return (
      <GameCompletion
        playerName={session.terminal?.playerName ?? session.data?.playerName}
        elapsed={session.terminal?.elapsedMilliseconds ?? timer.elapsed}
        score={session.terminal?.score ?? score}
      />
    );
  }
  if (!session.data) return <LoadingScreen />;

  const externalFeedback = notice.feedback
    ?? navigation.feedback
    ?? timeout.feedback;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <BrandHeader
        playerName={session.data.playerName}
        elapsed={formatElapsed(timer.elapsed)}
        score={score}
        livesRemaining={livesRemaining}
      />
      <ProgressAnimation
        animation={animation}
        onFinished={finishProgressAnimation}
      />
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-[280px_minmax(0,1fr)] max-[980px]:grid-cols-[230px_minmax(0,1fr)] max-[720px]:block max-[720px]:min-h-[calc(100vh-66px)]">
        <MissionRoute
          current={session.data.challenge.number}
          total={session.data.challenge.total}
        />
        <main className="mx-auto w-full max-w-[1120px] p-[clamp(34px,4.5vw,68px)] max-[720px]:px-5 max-[720px]:pt-[34px] max-[720px]:pb-[42px]">
          <GameHeading data={session.data} />
          <GameRenderer
            key={session.revision}
            data={session.data}
            sessionId={sessionId}
            remaining={timer.remaining}
            awaitingNext={timer.awaitingNext}
            timingOut={timeout.timingOut}
            externalFeedback={externalFeedback}
            nextActionLabel={navigation.nextActionLabel}
            navigating={navigation.navigating}
            onClearExternalFeedback={clearExternalFeedback}
            onElapsedChange={timer.setElapsed}
            onProgressChange={handleProgressChange}
            onChallengeComplete={timer.completeChallenge}
            onSessionComplete={session.markCompleted}
            onRestartChallenge={restartChallenge}
            onPauseChallenge={pauseChallenge}
            onRetryChallenge={challengeRetry.retry}
            retryingChallenge={challengeRetry.retrying}
            onUpdateProgress={session.updateProgress}
            onReplaceData={session.replaceData}
            onReloadChallenge={reloadChallenge}
            onNextChallenge={navigation.goToNextChallenge}
          />
        </main>
      </div>
    </div>
  );
}
