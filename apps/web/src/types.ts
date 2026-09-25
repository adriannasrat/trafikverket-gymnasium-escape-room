export type GameSummary = { id: string; slug: string; title: string; summary: string; sortOrder: number; type: string }

export type Session = {
  id: string; playerName: string; startedAtUtc: string; completedAtUtc: string | null
  status: 'InProgress' | 'Completed' | 'Abandoned'; elapsedMilliseconds: number
}

export type Challenge = {
  completed: false; sessionId: string; playerName: string; startedAtUtc: string; elapsedMilliseconds: number; game: GameSummary
  challenge: {
    id: string; prompt: string; imagePath: string | null; number: number; total: number; timeLimitSeconds: number
    questionNumber: number; questionTotal: number
    pixelRevealCount: number
    currentChallengePenaltyMilliseconds: number
    awaitingNext: boolean
    challengeStartedAtUtc: string; secondsRemaining: number
    options: Array<{ id: string; text: string }>
  }
  matching: null | {
    scenarios: Array<{
      id: string; prompt: string; imagePath: string | null
      options: Array<{ id: string; text: string }>
    }>
    destinations: string[]
  }
  sorting: null | {
    cards: Array<{ id: string; text: string }>
    categories: string[]
  }
}

export type AnswerResult = {
  correct: boolean; expired?: boolean; completed?: boolean; message?: string; successMessage?: string
  challengeStartedAtUtc?: string; timeLimitSeconds?: number; elapsedMilliseconds?: number
}

export type MatchingResult = AnswerResult & {
  incorrectChallengeIds: string[]
}

export type PixelRevealResult = {
  expired: boolean; pixelRevealCount: number; penaltySeconds: number
  elapsedMilliseconds: number; message?: string
  challengeStartedAtUtc?: string; timeLimitSeconds?: number
}

export type SortingResult = AnswerResult & {
  incorrectOptionIds: string[]
  currentChallengePenaltyMilliseconds: number
  secondsRemaining?: number
}

export type TimeoutResult = {
  expired: boolean; message?: string; challengeStartedAtUtc: string
  timeLimitSeconds: number; secondsRemaining?: number; currentChallengePenaltyMilliseconds?: number
}

export type LeaderboardEntry = {
  rank: number; id: string; playerName: string; elapsedMilliseconds: number; completedAtUtc: string
}

export type AdminResult = LeaderboardEntry & {
  startedAtUtc: string
}

export type AdminOption = {
  id: string; text: string; sortOrder: number; isCorrect: boolean; sortingCategory: string | null
}
export type AddedMatchingOption = AdminOption & { challengeId: string }
export type AdminChallenge = {
  id: string; prompt: string; imagePath: string | null; sortOrder: number
  timeLimitSeconds: number | null; options: AdminOption[]
}
export type AdminGame = GameSummary & {
  isActive: boolean; defaultTimeLimitSeconds: number; successMessage: string; challenges: AdminChallenge[]
}
