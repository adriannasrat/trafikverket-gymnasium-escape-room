import type { Dispatch, SetStateAction } from "react";
import type { Challenge } from "../../types";

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

export type GameRuntimeProps = {
  data: Challenge;
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
  onUpdateData: Dispatch<SetStateAction<Challenge | null>>;
  onReloadChallenge: (feedback?: GameFeedbackMessage) => Promise<void>;
  onNextChallenge: () => Promise<void>;
};

export type MatchingChallenge = Challenge & {
  matching: NonNullable<Challenge["matching"]>;
};

export type SortingChallenge = Challenge & {
  sorting: NonNullable<Challenge["sorting"]>;
};

export type WordAssemblyChallenge = Challenge & {
  wordAssembly: NonNullable<Challenge["wordAssembly"]>;
};

export type HangmanChallenge = Challenge & {
  hangman: NonNullable<Challenge["hangman"]>;
};
