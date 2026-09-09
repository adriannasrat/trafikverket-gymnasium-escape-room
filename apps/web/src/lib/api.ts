import type {
  AdminChallenge,
  AdminGame,
  AnswerResult,
  Challenge,
  GameSummary,
  LeaderboardEntry,
  Session,
  TimeoutResult,
} from "../types";

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let csrfToken: string | null = null;

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
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      detail?: string;
      title?: string;
    } | null;
    throw new ApiError(
      payload?.message ??
        payload?.detail ??
        payload?.title ??
        "Något gick fel. Försök igen.",
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
  startSession: (playerName: string) =>
    request<Session>("/api/sessions/", {
      method: "POST",
      body: JSON.stringify({ playerName }),
    }),
  session: (id: string) => request<Session>(`/api/sessions/${id}`),
  currentChallenge: (id: string) =>
    request<Challenge | { completed: true }>(
      `/api/sessions/${id}/current-challenge`,
    ),
  answer: (sessionId: string, challengeId: string, optionId: string) =>
    request<AnswerResult>(`/api/sessions/${sessionId}/answers`, {
      method: "POST",
      body: JSON.stringify({ challengeId, optionId }),
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
  login: (username: string, password: string) =>
    protectedRequest<{ username: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => protectedRequest<void>("/api/auth/logout", { method: "POST" }),
  adminGames: () => request<AdminGame[]>("/api/admin/games"),
  updateGame: (game: AdminGame) =>
    protectedRequest<AdminGame>(`/api/admin/games/${game.id}`, {
      method: "PUT",
      body: JSON.stringify(game),
    }),
  createChallenge: (gameId: string) =>
    protectedRequest<AdminChallenge>(`/api/admin/games/${gameId}/challenges`, {
      method: "POST",
    }),
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
