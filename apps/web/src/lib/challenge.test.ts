import { describe, expect, it } from "vitest";
import type { Challenge, ChallengeResponse, GameType } from "../types";
import { normalizeChallengeResponse } from "./challenge";

function responseFor(type: GameType): ChallengeResponse {
  return {
    completed: false,
    sessionId: "session-1",
    playerName: "Ada",
    startedAtUtc: "2026-10-21T10:00:00Z",
    elapsedMilliseconds: 1_000,
    score: 0,
    livesRemaining: 5,
    game: {
      id: "game-1",
      slug: "game",
      title: "Spel",
      summary: "Sammanfattning",
      sortOrder: 1,
      type,
    },
    challenge: {
      id: "challenge-1",
      prompt: "Uppgift",
      imagePath: null,
      number: 1,
      total: 7,
      timeLimitSeconds: 60,
      questionNumber: 1,
      questionTotal: 3,
      pixelRevealCount: 0,
      currentChallengePenaltyMilliseconds: 0,
      awaitingNext: false,
      challengeStartedAtUtc: "2026-10-21T10:00:00Z",
      secondsRemaining: 59,
      options: [],
    },
    matching: null,
    sorting: null,
    wordAssembly: null,
    hangman: null,
  };
}

function verifyCompileTimeNarrowing(challenge: Challenge) {
  if (challenge.type === "Sorting") {
    const cards = challenge.sorting.cards;
    void cards;
    // @ts-expect-error A sorting challenge must never expose matching data.
    const matching = challenge.matching;
    void matching;
  }

  if (challenge.type === "PixelHunt") {
    const imagePath: string = challenge.challenge.imagePath;
    void imagePath;
    // @ts-expect-error Pixel-specific data cannot be read from the matching payload.
    const matching = challenge.matching;
    void matching;
  }
}
void verifyCompileTimeNarrowing;

describe("normalizeChallengeResponse", () => {
  it("creates a matching variant with only its matching payload", () => {
    const response = responseFor("Matching");
    response.matching = {
      scenarios: [{
        id: "scenario-1",
        prompt: "Scenario",
        imagePath: null,
        options: [{ id: "option-1", text: "Skolområde", iconKey: "school" }],
      }],
      destinations: [{ text: "Skolområde", iconKey: "school" }],
    };

    const challenge = normalizeChallengeResponse(response);

    expect(challenge.type).toBe("Matching");
    if (challenge.type !== "Matching") throw new Error("Fel speltyp i testet.");
    expect(challenge.matching.scenarios).toHaveLength(1);
    expect("sorting" in challenge).toBe(false);
  });

  it("rejects a response that lacks the payload required by its game type", () => {
    expect(() => normalizeChallengeResponse(responseFor("Sorting")))
      .toThrow("Servern saknar sorteringsdata för speltypen Sorting.");
  });

  it("requires a usable image for Pixeljakten", () => {
    expect(() => normalizeChallengeResponse(responseFor("PixelHunt")))
      .toThrow("Servern saknar en bild för speltypen PixelHunt.");
  });

  it("removes unrelated transport fields from a quiz challenge", () => {
    const response = responseFor("Quiz");
    response.challenge.options = [{ id: "answer-1", text: "Svar" }];
    response.sorting = { cards: [], categories: [] };

    const challenge = normalizeChallengeResponse(response);

    expect(challenge.type).toBe("Quiz");
    if (challenge.type !== "Quiz") throw new Error("Fel speltyp i testet.");
    expect("sorting" in challenge).toBe(false);
    expect(challenge.challenge.options).toEqual([{ id: "answer-1", text: "Svar" }]);
  });
});
