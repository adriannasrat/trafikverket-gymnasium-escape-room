import { describe, expect, it, vi } from "vitest";
import type { AddedMatchingOption, AdminChallenge, AdminGame, AdminOption, GameType } from "../../types";
import { removeChallengeImage, replaceChallengeImage } from "./imageCommands";
import {
  appendMatchingDestination,
  createMatchingCommands,
  removeMatchingDestination,
} from "./matchingCommands";
import { removeSortingCard } from "./sortingCommands";
import type { AdminEditorCommandContext } from "./types";
import { removeWordPart } from "./wordAssemblyCommands";

function option(id: string, sortOrder: number): AdminOption {
  return {
    id,
    text: id,
    sortOrder,
    isCorrect: false,
    sortingCategory: null,
    matchingIconKey: null,
  };
}

function challenge(id: string, options: AdminOption[]): AdminChallenge {
  return {
    id,
    prompt: id,
    imagePath: null,
    sortOrder: 1,
    isEnabled: true,
    timeLimitSeconds: null,
    options,
  };
}

function game(type: GameType, challenges: AdminChallenge[]): AdminGame {
  return {
    id: "game-1",
    slug: "game",
    title: "Game",
    summary: "",
    sortOrder: 1,
    type,
    isActive: true,
    defaultTimeLimitSeconds: 60,
    successMessage: "",
    supportsChallengeImages: true,
    allowsChallengeImageUploads: true,
    requiresChallengeImages: false,
    supportsChallengeActivation: true,
    challenges,
  };
}

describe("admin editor command transformations", () => {
  it("adds a matching destination to its corresponding scenarios", () => {
    const current = game("Matching", [challenge("one", []), challenge("two", [])]);
    const additions: AddedMatchingOption[] = [
      { ...option("zone-one", 1), challengeId: "one" },
      { ...option("zone-two", 1), challengeId: "two" },
    ];

    const result = appendMatchingDestination(current, additions);

    expect(result.map((item) => item.options[0]?.id)).toEqual(["zone-one", "zone-two"]);
  });

  it("removes and renumbers a matching destination in every scenario", () => {
    const current = game("Matching", [
      challenge("one", [option("a", 1), option("b", 2), option("c", 3)]),
      challenge("two", [option("d", 1), option("e", 2), option("f", 3)]),
    ]);

    const result = removeMatchingDestination(current, 2);

    expect(result.map((item) => item.options.map((candidate) => candidate.sortOrder)))
      .toEqual([[1, 2], [1, 2]]);
    expect(result.map((item) => item.options.map((candidate) => candidate.id)))
      .toEqual([["a", "c"], ["d", "f"]]);
  });

  it("keeps sorting-card order contiguous after deletion", () => {
    const current = game("Sorting", [
      challenge("round", [option("a", 1), option("b", 2), option("c", 3)]),
    ]);

    const result = removeSortingCard(current, "round", "b");

    expect(result[0].options.map(({ id, sortOrder }) => ({ id, sortOrder })))
      .toEqual([{ id: "a", sortOrder: 1 }, { id: "c", sortOrder: 2 }]);
  });

  it("sorts and renumbers word parts after deletion", () => {
    const current = game("WordAssembly", [
      challenge("word", [option("third", 3), option("first", 1), option("second", 2)]),
    ]);

    const result = removeWordPart(current, "word", "second");

    expect(result[0].options.map(({ id, sortOrder }) => ({ id, sortOrder })))
      .toEqual([{ id: "first", sortOrder: 1 }, { id: "third", sortOrder: 2 }]);
  });

  it("replaces only the selected challenge image", () => {
    const current = game("Quiz", [challenge("one", []), challenge("two", [])]);

    const result = replaceChallengeImage(current, "two", "/uploads/new.webp");

    expect(result.map((item) => item.imagePath)).toEqual([null, "/uploads/new.webp"]);
  });

  it("removes only the selected image and applies the persisted activation state", () => {
    const one = { ...challenge("one", []), imagePath: "/uploads/one.webp" };
    const two = { ...challenge("two", []), imagePath: "/uploads/two.webp" };
    const current = game("PixelHunt", [one, two]);

    const result = removeChallengeImage(current, "one", false);

    expect(result).toEqual([
      { ...one, imagePath: null, isEnabled: false },
      two,
    ]);
  });

  it("runs matching commands through the injected mutation and API boundaries", async () => {
    const current = game("Matching", [challenge("one", [])]);
    const additions: AddedMatchingOption[] = [
      { ...option("zone-one", 1), challengeId: "one" },
    ];
    const updateGameById = vi.fn();
    const runMutation: AdminEditorCommandContext["runMutation"] = vi.fn(
      async (mutation) => {
        await mutation.execute();
      },
    );
    const context: AdminEditorCommandContext = {
      game: current,
      confirm: () => true,
      getCurrentGame: () => current,
      updateGameById,
      runMutation,
    };
    const addMatchingDestination = vi.fn(async () => ({ options: additions }));
    const commands = createMatchingCommands(context, {
      addMatchingDestination,
      deleteMatchingDestination: vi.fn(async () => undefined),
    });

    await commands.addMatchingDestination();

    expect(addMatchingDestination).toHaveBeenCalledWith(current.id);
    expect(runMutation).toHaveBeenCalledOnce();
    expect(updateGameById).toHaveBeenCalledWith(current.id, {
      challenges: [{ ...current.challenges[0], options: [additions[0]] }],
    });
  });
});
