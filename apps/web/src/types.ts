export const gameTypes = [
  "Quiz",
  "Matching",
  "TrueFalse",
  "PixelHunt",
  "Sorting",
  "WordAssembly",
  "Hangman",
] as const

export type GameType = (typeof gameTypes)[number]
export type ExperienceMode = "Event" | "Demo"

export type PrivacySettings = {
  mode: ExperienceMode
  retentionDays: number
}

export type GameSummary<TType extends GameType = GameType> = {
  id: string
  slug: string
  title: string
  summary: string
  sortOrder: number
  type: TType
}

export type Session = {
  id: string; playerName: string; experienceMode: ExperienceMode
  startedAtUtc: string; completedAtUtc: string | null
  status: 'InProgress' | 'Completed' | 'Abandoned'; elapsedMilliseconds: number
  score: number; livesRemaining: number
}

export type SessionProgress = {
  score: number
  scoreAwarded: number
  livesRemaining: number
  lifeLost: boolean
  gameOver: boolean
}

export type AnswerOption = {
  id: string
  text: string
}

export type HangmanState = {
  pattern: Array<string | null>
  guessedLetters: string[]
  mistakes: number
  maxMistakes: number
  solved: boolean
}

export type ChallengeProgress = {
  id: string
  prompt: string
  number: number
  total: number
  timeLimitSeconds: number
  questionNumber: number
  questionTotal: number
  currentChallengePenaltyMilliseconds: number
  awaitingNext: boolean
  challengeStartedAtUtc: string
  secondsRemaining: number
}

export type ChoiceChallengeProgress = ChallengeProgress & {
  imagePath: string | null
  options: AnswerOption[]
}

export type PixelHuntChallengeProgress = ChallengeProgress & {
  imagePath: string
  pixelRevealCount: number
  options: AnswerOption[]
}

export type MatchingPayload = {
  scenarios: Array<{
    id: string
    prompt: string
    imagePath: string | null
    options: Array<AnswerOption & { iconKey: string }>
  }>
  destinations: Array<{ text: string; iconKey: string }>
}

export type SortingPayload = {
  cards: AnswerOption[]
  categories: string[]
}

export type WordAssemblyPayload = {
  parts: AnswerOption[]
}

export type ChallengeBase<
  TType extends GameType,
  TProgress extends ChallengeProgress,
> = {
  type: TType
  completed: false
  sessionId: string
  playerName: string
  startedAtUtc: string
  elapsedMilliseconds: number
  score: number
  livesRemaining: number
  game: GameSummary<TType>
  challenge: TProgress
}

export type ChallengeByType = {
  Quiz: ChallengeBase<"Quiz", ChoiceChallengeProgress>
  Matching: ChallengeBase<"Matching", ChallengeProgress> & {
    matching: MatchingPayload
  }
  TrueFalse: ChallengeBase<"TrueFalse", ChallengeProgress & {
    options: AnswerOption[]
  }>
  PixelHunt: ChallengeBase<"PixelHunt", PixelHuntChallengeProgress>
  Sorting: ChallengeBase<"Sorting", ChallengeProgress> & {
    sorting: SortingPayload
  }
  WordAssembly: ChallengeBase<"WordAssembly", ChallengeProgress> & {
    wordAssembly: WordAssemblyPayload
  }
  Hangman: ChallengeBase<"Hangman", ChallengeProgress & {
    imagePath: string | null
  }> & {
    hangman: HangmanState
  }
}

export type ChallengeOf<TType extends GameType> = ChallengeByType[TType]
export type Challenge = ChallengeByType[GameType]

export type ChallengeResponse = {
  completed: false
  sessionId: string
  playerName: string
  startedAtUtc: string
  elapsedMilliseconds: number
  score: number
  livesRemaining: number
  game: GameSummary
  challenge: ChallengeProgress & {
    imagePath: string | null
    pixelRevealCount: number
    options: AnswerOption[]
  }
  matching: MatchingPayload | null
  sorting: SortingPayload | null
  wordAssembly: WordAssemblyPayload | null
  hangman: HangmanState | null
}

export type CurrentChallengeResponse = ChallengeResponse | {
  completed: true
  failed: boolean
  playerName: string
  elapsedMilliseconds: number
  score: number
  livesRemaining: number
}

export type AnswerResult = {
  correct: boolean; expired?: boolean; completed?: boolean; message?: string; successMessage?: string
  challengeStartedAtUtc?: string; timeLimitSeconds?: number; elapsedMilliseconds?: number
  progress?: SessionProgress
}

export type MatchingResult = AnswerResult & {
  incorrectChallengeIds: string[]
}

export type PixelRevealResult = {
  expired: boolean; pixelRevealCount: number; penaltySeconds: number
  elapsedMilliseconds: number; message?: string
  challengeStartedAtUtc?: string; timeLimitSeconds?: number
  progress?: SessionProgress
}

export type SortingResult = AnswerResult & {
  incorrectOptionIds: string[]
  currentChallengePenaltyMilliseconds: number
  secondsRemaining?: number
}

export type WordAssemblyResult = AnswerResult & {
  incorrectOptionIds: string[]
}

export type HangmanResult = AnswerResult & {
  solved: boolean
  roundReset: boolean
  hangman: HangmanState
}

export type TimeoutResult = {
  expired: boolean; message?: string; challengeStartedAtUtc: string
  timeLimitSeconds: number; secondsRemaining?: number; currentChallengePenaltyMilliseconds?: number
  progress?: SessionProgress
}

export type LeaderboardEntry = {
  rank: number; id: string; playerName: string; elapsedMilliseconds: number; completedAtUtc: string
  experienceMode: ExperienceMode; score: number
}

export type AdminResult = LeaderboardEntry & {
  startedAtUtc: string; livesRemaining: number
}

export type AuditEntry = {
  id: string
  occurredAtUtc: string
  actor: string
  action: string
  entityType: string
  entityId: string
  summary: string
}

export type AdminOption = {
  id: string; text: string; sortOrder: number; isCorrect: boolean; sortingCategory: string | null
  matchingIconKey: string | null
}
export type AddedMatchingOption = AdminOption & { challengeId: string }
export type AdminChallenge = {
  id: string; prompt: string; imagePath: string | null; sortOrder: number
  isEnabled: boolean; timeLimitSeconds: number | null; options: AdminOption[]
}
export type AdminGame = GameSummary & {
  isActive: boolean; defaultTimeLimitSeconds: number; successMessage: string
  supportsChallengeImages: boolean; allowsChallengeImageUploads: boolean
  requiresChallengeImages: boolean
  supportsChallengeActivation: boolean
  challenges: AdminChallenge[]
}
