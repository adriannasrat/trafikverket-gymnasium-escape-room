import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { StartPage } from "./StartPage";

vi.mock("../lib/api", () => ({
  api: {
    games: vi.fn(),
    leaderboard: vi.fn(),
    startSession: vi.fn(),
  },
}));

function renderStartPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/play/:sessionId" element={<h1>Spelsidan</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StartPage", () => {
  beforeEach(() => {
    vi.mocked(api.games).mockResolvedValue([{
      id: "game-1",
      slug: "uppdraget",
      title: "Uppdraget",
      summary: "Testa Trafikverkets uppdrag.",
      sortOrder: 1,
      type: "Quiz",
    }]);
    vi.mocked(api.leaderboard).mockResolvedValue([]);
  });

  it("startar en session och navigerar till den skapade spelomgången", async () => {
    vi.mocked(api.startSession).mockResolvedValue({
      id: "session-123",
      playerName: "Ada",
      startedAtUtc: "2026-10-21T10:00:00Z",
      completedAtUtc: null,
      status: "InProgress",
      elapsedMilliseconds: 0,
    });
    const user = userEvent.setup();
    renderStartPage();

    const startButton = screen.getByRole("button", { name: /starta uppdraget/i });
    expect(startButton).toBeDisabled();

    await user.type(screen.getByLabelText("DITT NAMN"), "Ada");
    expect(startButton).toBeEnabled();
    await user.click(startButton);

    await waitFor(() => expect(api.startSession).toHaveBeenCalledWith("Ada"));
    expect(await screen.findByRole("heading", { name: "Spelsidan" })).toBeVisible();
  });

  it("visar serverfelet och stannar kvar om sessionen inte kan startas", async () => {
    vi.mocked(api.startSession).mockRejectedValue(new Error("För många nya spelomgångar."));
    const user = userEvent.setup();
    renderStartPage();

    await user.type(screen.getByLabelText("DITT NAMN"), "Ada");
    await user.click(screen.getByRole("button", { name: /starta uppdraget/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("För många nya spelomgångar.");
    expect(screen.queryByRole("heading", { name: "Spelsidan" })).not.toBeInTheDocument();
  });
});
