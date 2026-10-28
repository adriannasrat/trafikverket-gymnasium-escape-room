import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { GameFailure } from "./GameFailure";

describe("GameFailure", () => {
  it("erbjuder omstart med samma spelare, topplista och startskärm", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GameFailure
          playerName="Ada"
          score={2_450}
          retrying={false}
          retryError=""
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Försök igen" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Visa topplistan" }))
      .toHaveAttribute("href", "/leaderboard");
    expect(screen.getByRole("link", { name: "Till startskärmen" }))
      .toHaveAttribute("href", "/");
    expect(screen.getByText(/2 450 poäng/)).toBeVisible();
  });
});
