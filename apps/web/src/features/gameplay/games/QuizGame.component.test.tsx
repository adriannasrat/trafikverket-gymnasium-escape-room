import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../lib/api";
import type { ChallengeOf } from "../../../types";
import type { GameRuntimeProps } from "../types";
import { QuizGame } from "./QuizGame";

vi.mock("../../../lib/api", () => ({
  api: {
    answer: vi.fn(),
  },
}));

const quiz: ChallengeOf<"Quiz"> = {
  type: "Quiz",
  completed: false,
  sessionId: "session-1",
  playerName: "Ada",
  startedAtUtc: "2026-10-21T10:00:00Z",
  elapsedMilliseconds: 1_000,
  score: 0,
  livesRemaining: 5,
  game: {
    id: "game-1",
    slug: "uppdraget",
    title: "Uppdraget",
    summary: "Svara på frågan.",
    sortOrder: 1,
    type: "Quiz",
  },
  challenge: {
    id: "challenge-1",
    prompt: "Vilket svar är rätt?",
    imagePath: null,
    number: 1,
    total: 7,
    timeLimitSeconds: 60,
    questionNumber: 1,
    questionTotal: 2,
    currentChallengePenaltyMilliseconds: 0,
    awaitingNext: false,
    retryRequired: false,
    challengeStartedAtUtc: "2026-10-21T10:00:00Z",
    secondsRemaining: 58,
    options: [
      { id: "wrong", text: "Fel svar" },
      { id: "correct", text: "Rätt svar" },
    ],
  },
};

function runtimeProps(): GameRuntimeProps<"Quiz"> {
  return {
    data: quiz,
    sessionId: "session-1",
    remaining: 58,
    awaitingNext: false,
    timingOut: false,
    externalFeedback: null,
    nextActionLabel: "Nästa fråga",
    navigating: false,
    onClearExternalFeedback: vi.fn(),
    onElapsedChange: vi.fn(),
    onProgressChange: vi.fn(),
    onChallengeComplete: vi.fn(),
    onSessionComplete: vi.fn(),
    onRestartChallenge: vi.fn(),
    onPauseChallenge: vi.fn(),
    onRetryChallenge: vi.fn().mockResolvedValue(undefined),
    retryingChallenge: false,
    onUpdateProgress: vi.fn(),
    onReplaceData: vi.fn(),
    onReloadChallenge: vi.fn(),
    onNextChallenge: vi.fn(),
  };
}

describe("QuizGame", () => {
  beforeEach(() => {
    vi.mocked(api.answer).mockResolvedValue({
      correct: true,
      completed: false,
      successMessage: "Korrekt!",
      elapsedMilliseconds: 1_500,
      progress: {
        score: 900,
        scoreAwarded: 900,
        livesRemaining: 5,
        lifeLost: false,
        gameOver: false,
      },
    });
  });

  it("skickar det valda svaret och markerar frågan som klar", async () => {
    const props = runtimeProps();
    const user = userEvent.setup();
    render(<QuizGame {...props} />);

    const submit = screen.getByRole("button", { name: /bekräfta svar/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Rätt svar" }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(api.answer).toHaveBeenCalledWith(
      "session-1",
      "challenge-1",
      "correct",
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Korrekt!");
    expect(props.onElapsedChange).toHaveBeenCalledWith(1_500);
    expect(props.onProgressChange).toHaveBeenCalledWith(expect.objectContaining({
      scoreAwarded: 900,
      livesRemaining: 5,
    }));
    expect(props.onChallengeComplete).toHaveBeenCalledOnce();
  });

  it("pausar frågan efter fel svar och kräver ett aktivt nytt försök", async () => {
    vi.mocked(api.answer).mockResolvedValue({
      correct: false,
      message: "Försök igen.",
      challengeStartedAtUtc: "2026-10-21T10:01:00Z",
      timeLimitSeconds: 60,
      secondsRemaining: 42,
      retryRequired: true,
      progress: {
        score: 0,
        scoreAwarded: 0,
        livesRemaining: 4,
        lifeLost: true,
        gameOver: false,
      },
    });
    const props = runtimeProps();
    const user = userEvent.setup();
    const view = render(<QuizGame {...props} />);

    await user.click(screen.getByRole("radio", { name: "Fel svar" }));
    await user.click(screen.getByRole("button", { name: /bekräfta svar/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Försök igen.");
    expect(props.onProgressChange).toHaveBeenCalledWith(expect.objectContaining({
      lifeLost: true,
      livesRemaining: 4,
    }));
    expect(props.onPauseChallenge).toHaveBeenCalledWith(expect.objectContaining({
      challengeStartedAtUtc: "2026-10-21T10:01:00Z",
      secondsRemaining: 42,
    }));

    view.rerender(<QuizGame
      {...props}
      data={{
        ...quiz,
        challenge: { ...quiz.challenge, retryRequired: true },
      }}
    />);
    await user.click(screen.getByRole("button", { name: "Försök igen" }));
    expect(props.onRetryChallenge).toHaveBeenCalledOnce();
  });
});
