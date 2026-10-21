import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { LoadingScreen } from "../components/LoadingScreen";
import { MissionRoute } from "../components/MissionRoute";
import { GameCompletion } from "../features/gameplay/components/GameCompletion";
import { GameError } from "../features/gameplay/components/GameError";
import { GameHeading } from "../features/gameplay/components/GameHeading";
import { GameRenderer } from "../features/gameplay/games/GameRenderer";
import { useChallengeTimeout } from "../features/gameplay/hooks/useChallengeTimeout";
import { useChallengeTimer } from "../features/gameplay/hooks/useChallengeTimer";
import { useGameNavigation } from "../features/gameplay/hooks/useGameNavigation";
import { useGameNotice } from "../features/gameplay/hooks/useGameNotice";
import { useGameSession } from "../features/gameplay/hooks/useGameSession";
import type { ChallengeRestart, GameFeedbackMessage } from "../features/gameplay/types";
import { formatElapsed } from "../lib/time";

export function GamePage() {
  const { sessionId = "" } = useParams();
  const session = useGameSession(sessionId);
  const timer = useChallengeTimer({
    data: session.data,
    completed: session.completed,
    revision: session.revision,
  });
  const timeout = useChallengeTimeout({
    sessionId,
    data: session.data,
    completed: session.completed,
    awaitingNext: timer.awaitingNext,
    remaining: timer.remaining,
    reloadChallenge: session.loadChallenge,
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

  const reloadChallenge = useCallback(async (feedback?: GameFeedbackMessage) => {
    await session.loadChallenge();
    if (feedback) notice.showFeedback(feedback);
  }, [notice, session]);

  if (session.error) return <GameError message={session.error} />;
  if (session.completed) {
    return (
      <GameCompletion
        playerName={session.data?.playerName}
        elapsed={timer.elapsed}
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
            onChallengeComplete={timer.completeChallenge}
            onSessionComplete={session.markCompleted}
            onRestartChallenge={restartChallenge}
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
