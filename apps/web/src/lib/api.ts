import type {
  AdminChallenge,
  AdminResult,
  AddedMatchingOption,
  AdminGame,
  AuditEntry,
  AnswerResult,
  Challenge,
  ChallengeRetryResult,
  CurrentChallengeResponse,
  GameSummary,
  HangmanResult,
  LeaderboardEntry,
  MatchingResult,
  PixelRevealResult,
  PrivacySettings,
  Session,
  SortingResult,
  TimeoutResult,
  WordAssemblyResult,
} from "../types";
import { normalizeChallengeResponse } from "./challenge";

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let csrfToken: string | null = null;

type ProblemDetails = {
  message?: string;
  detail?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

export function getApiErrorMessage(
  payload: ProblemDetails | null,
  fallback = "Något gick fel. Försök igen.",
) {
  const validationMessage = payload?.errors
    ? Object.values(payload.errors).flat().find(Boolean)
    : undefined;

  return payload?.message
    ?? payload?.detail
    ?? validationMessage
    ?? payload?.title
    ?? fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasFormData = init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(!hasFormData && { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ProblemDetails | null;
    throw new ApiError(
      getApiErrorMessage(payload),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function protectedRequest<T>(path: string, init: RequestInit) {
  if (!csrfToken) {
    const result = await request<{ token: string }>("/api/auth/csrf");
    csrfToken = result.token;
  }
  return request<T>(path, {
    ...init,
    headers: { ...init.headers, "X-CSRF-TOKEN": csrfToken },
  });
}

export const api = {
  games: () => request<GameSummary[]>("/api/games"),
  privacy: () => request<PrivacySettings>("/api/privacy"),
  startSession: (playerName: string) =>
    request<Session>("/api/sessions/", {
      method: "POST",
      body: JSON.stringify({ playerName }),
    }),
  session: (id: string) => request<Session>(`/api/sessions/${id}`),
  currentChallenge: async (id: string): Promise<Challenge | Extract<CurrentChallengeResponse, { completed: true }>> => {
    const response = await request<CurrentChallengeResponse>(
      `/api/sessions/${id}/current-challenge`,
    );
    return response.completed ? response : normalizeChallengeResponse(response);
  },
  answer: (sessionId: string, challengeId: string, optionId: string) =>
    request<AnswerResult>(`/api/sessions/${sessionId}/answers`, {
      method: "POST",
      body: JSON.stringify({ challengeId, optionId }),
    }),
  retryChallenge: (sessionId: string, challengeId: string) =>
    request<ChallengeRetryResult>(`/api/sessions/${sessionId}/retry`, {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    }),
  submitMatches: (
    sessionId: string,
    challengeId: string,
    selections: Array<{ challengeId: string; optionId: string }>,
  ) =>
    request<MatchingResult>(`/api/sessions/${sessionId}/matches`, {
      method: "POST",
      body: JSON.stringify({ challengeId, selections }),
    }),
  submitSorting: (
    sessionId: string,
    challengeId: string,
    placements: Array<{ optionId: string; category: string | null }>,
  ) =>
    request<SortingResult>(`/api/sessions/${sessionId}/sorting`, {
      method: "POST",
      body: JSON.stringify({ challengeId, placements }),
    }),
  submitWordAssembly: (
    sessionId: string,
    challengeId: string,
    orderedOptionIds: string[],
  ) =>
    request<WordAssemblyResult>(`/api/sessions/${sessionId}/word-assembly`, {
      method: "POST",
      body: JSON.stringify({ challengeId, orderedOptionIds }),
    }),
  submitHangmanGuess: (sessionId: string, challengeId: string, letter: string) =>
    request<HangmanResult>(`/api/sessions/${sessionId}/hangman-guesses`, {
      method: "POST",
      body: JSON.stringify({ challengeId, letter }),
    }),
  revealPixel: (sessionId: string, challengeId: string) =>
    request<PixelRevealResult>(`/api/sessions/${sessionId}/pixel-reveal`, {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    }),
  timeout: (sessionId: string, challengeId: string) =>
    request<TimeoutResult>(`/api/sessions/${sessionId}/timeout`, {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    }),
  nextChallenge: (sessionId: string) =>
    request<void>(`/api/sessions/${sessionId}/next`, { method: "POST" }),
  leaderboard: () => request<LeaderboardEntry[]>("/api/leaderboard"),
  me: () =>
    request<{ authenticated: boolean; username: string | null }>(
      "/api/auth/me",
    ),
  login: async (username: string, password: string) => {
    const result = await protectedRequest<{ username: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    // The login response changes the authenticated identity. The anonymous
    // antiforgery token used for login must not be reused by admin mutations.
    csrfToken = null;
    return result;
  },
  logout: async () => {
    await protectedRequest<void>("/api/auth/logout", { method: "POST" });
    csrfToken = null;
  },
  adminGames: () => request<AdminGame[]>("/api/admin/games"),
  adminResults: (mode: PrivacySettings["mode"]) =>
    request<AdminResult[]>(`/api/admin/results?mode=${encodeURIComponent(mode)}`),
  adminAudit: () => request<AuditEntry[]>("/api/admin/audit"),
  deleteAdminResult: (sessionId: string) =>
    protectedRequest<void>(`/api/admin/results/${sessionId}`, {
      method: "DELETE",
    }),
  deleteAllAdminResults: (mode: PrivacySettings["mode"]) =>
    protectedRequest<void>(
      `/api/admin/results?mode=${encodeURIComponent(mode)}`,
      { method: "DELETE" },
    ),
  updateGame: (game: AdminGame) =>
    protectedRequest<AdminGame>(`/api/admin/games/${game.id}`, {
      method: "PUT",
      body: JSON.stringify(game),
    }),
  createChallenge: (gameId: string) =>
    protectedRequest<AdminChallenge>(`/api/admin/games/${gameId}/challenges`, {
      method: "POST",
    }),
  addMatchingDestination: (gameId: string) =>
    protectedRequest<{ options: AddedMatchingOption[] }>(
      `/api/admin/games/${gameId}/matching-destinations`,
      { method: "POST" },
    ),
  deleteMatchingDestination: (gameId: string, sortOrder: number) =>
    protectedRequest<void>(
      `/api/admin/games/${gameId}/matching-destinations/${sortOrder}`,
      { method: "DELETE" },
    ),
  addSortingCard: (challengeId: string) =>
    protectedRequest<AdminChallenge["options"][number]>(
      `/api/admin/challenges/${challengeId}/sorting-cards`,
      { method: "POST" },
    ),
  deleteSortingCard: (challengeId: string, optionId: string) =>
    protectedRequest<void>(
      `/api/admin/challenges/${challengeId}/sorting-cards/${optionId}`,
      { method: "DELETE" },
    ),
  addWordPart: (challengeId: string) =>
    protectedRequest<AdminChallenge["options"][number]>(
      `/api/admin/challenges/${challengeId}/word-parts`,
      { method: "POST" },
    ),
  deleteWordPart: (challengeId: string, optionId: string) =>
    protectedRequest<void>(
      `/api/admin/challenges/${challengeId}/word-parts/${optionId}`,
      { method: "DELETE" },
    ),
  deleteChallenge: (challengeId: string) =>
    protectedRequest<void>(`/api/admin/challenges/${challengeId}`, {
      method: "DELETE",
    }),
  uploadChallengeImage: (challengeId: string, image: File) => {
    const form = new FormData();
    form.append("image", image);
    return protectedRequest<{ imagePath: string }>(
      `/api/admin/challenges/${challengeId}/image`,
      { method: "POST", body: form },
    );
  },
};
