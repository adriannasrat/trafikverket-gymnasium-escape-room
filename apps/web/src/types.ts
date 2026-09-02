export type GameSummary = { id: string; slug: string; title: string; summary: string; sortOrder: number; type: string }

export type Session = {
  id: string; teamName: string; startedAtUtc: string; completedAtUtc: string | null
  status: 'InProgress' | 'Completed' | 'Abandoned'; elapsedMilliseconds: number
}

export type Challenge = {
  completed: false; sessionId: string; teamName: string; startedAtUtc: string; game: GameSummary
  challenge: {
    id: string; prompt: string; imagePath: string | null; timeLimitSeconds: number
    challengeStartedAtUtc: string; secondsRemaining: number
    options: Array<{ id: string; text: string }>
  }
}

export type AnswerResult = {
  correct: boolean; expired?: boolean; completed?: boolean; message?: string; successMessage?: string
  challengeStartedAtUtc?: string; timeLimitSeconds?: number; elapsedMilliseconds?: number
}

export type LeaderboardEntry = {
  rank: number; id: string; teamName: string; elapsedMilliseconds: number; completedAtUtc: string
}

export type AdminOption = { id: string; text: string; sortOrder: number; isCorrect: boolean }
export type AdminChallenge = {
  id: string; prompt: string; imagePath: string | null; sortOrder: number
  timeLimitSeconds: number | null; options: AdminOption[]
}
export type AdminGame = GameSummary & {
  isActive: boolean; defaultTimeLimitSeconds: number; successMessage: string; challenges: AdminChallenge[]
}
