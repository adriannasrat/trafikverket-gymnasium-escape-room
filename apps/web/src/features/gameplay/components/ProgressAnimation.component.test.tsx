import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressAnimation } from "./ProgressAnimation";

describe("ProgressAnimation", () => {
  afterEach(() => vi.useRealTimers());

  it("visar poängen mitt på skärmen och avslutas exakt en gång", () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();
    const { container } = render(
      <ProgressAnimation
        animation={{ id: 1, type: "score", amount: 850 }}
        onFinished={onFinished}
      />,
    );

    expect(screen.getByText("+850")).toBeVisible();
    expect(screen.getByText("Poäng")).toBeVisible();
    fireEvent.animationEnd(container.querySelector(".score-burst-animation")!);
    vi.runAllTimers();
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it("visar hur många gemensamma liv som återstår", () => {
    const onFinished = vi.fn();
    render(
      <ProgressAnimation
        animation={{ id: 2, type: "life", livesRemaining: 4, gameOver: false }}
        onFinished={onFinished}
      />,
    );

    expect(screen.getByText("Ett liv förlorat")).toBeVisible();
    expect(screen.getByText("4 liv kvar")).toBeVisible();
  });

  it("förklarar att alla liv försvinner när sessionen tar slut", () => {
    render(
      <ProgressAnimation
        animation={{ id: 3, type: "life", livesRemaining: 0, gameOver: true }}
        onFinished={vi.fn()}
      />,
    );

    expect(screen.getByText("Alla liv förlorade")).toBeVisible();
    expect(screen.getByText("0 liv kvar")).toBeVisible();
  });
});
