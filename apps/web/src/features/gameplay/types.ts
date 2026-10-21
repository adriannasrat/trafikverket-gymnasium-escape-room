import type {
  Challenge,
  ChallengeOf,
  ChallengeProgress,
  GameType,
} from "../../types";

export type GameFeedbackMessage = {
  correct: boolean;
  text: string;
};

export type ChallengeRestart = {
  challengeStartedAtUtc?: string;
  timeLimitSeconds?: number;
  currentChallengePenaltyMilliseconds?: number;
  secondsRemaining?: number;
};

type SharedGameRuntimeProps = {
  sessionId: string;
  remaining: number;
  awaitingNext: boolean;
  timingOut: boolean;
  externalFeedback: GameFeedbackMessage | null;
  nextActionLabel: string;
  navigating: boolean;
  onClearExternalFeedback: () => void;
  onElapsedChange: (elapsedMilliseconds: number) => void;
  onChallengeComplete: () => void;
  onSessionComplete: () => void;
  onRestartChallenge: (restart: ChallengeRestart) => void;
  onUpdateProgress: (update: Partial<ChallengeProgress>) => void;
  onReplaceData: (data: Challenge) => void;
  onReloadChallenge: (feedback?: GameFeedbackMessage) => Promise<void>;
  onNextChallenge: () => Promise<void>;
};

export type GameRuntimeProps<TType extends GameType = GameType> =
  SharedGameRuntimeProps & {
    data: ChallengeOf<TType>;
  };
