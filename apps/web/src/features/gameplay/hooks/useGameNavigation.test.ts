import { describe, expect, it } from "vitest";
import { getNextActionLabel, type GameNavigationPosition } from "./useGameNavigation";

const position: GameNavigationPosition = {
  gameType: "Quiz",
  gameNumber: 1,
  gameTotal: 7,
  questionNumber: 1,
  questionTotal: 4,
};

describe("getNextActionLabel", () => {
  it("uses the correct item label inside each multi-question game", () => {
    expect(getNextActionLabel({ ...position, gameType: "Quiz" })).toBe("Nästa fråga");
    expect(getNextActionLabel({ ...position, gameType: "PixelHunt" })).toBe("Nästa bild");
    expect(getNextActionLabel({ ...position, gameType: "WordAssembly" })).toBe("Nästa ord");
    expect(getNextActionLabel({ ...position, gameType: "Hangman" })).toBe("Nästa signalord");
  });

  it("moves from the final item to the next game", () => {
    expect(getNextActionLabel({
      ...position,
      questionNumber: 4,
      questionTotal: 4,
    })).toBe("Nästa spel");
  });

  it("finishes after the final game", () => {
    expect(getNextActionLabel({
      ...position,
      gameType: "Matching",
      gameNumber: 7,
      gameTotal: 7,
    })).toBe("Slutför uppdraget");
  });
});
