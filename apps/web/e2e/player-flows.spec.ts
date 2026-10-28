import { expect, test, type Page } from "@playwright/test";
import type { ChallengeResponse, GameType } from "../src/types";

const sessionId = "00000000-0000-0000-0000-000000000001";

function challengeResponse(type: GameType): ChallengeResponse {
  return {
    completed: false,
    sessionId,
    playerName: "Ada",
    startedAtUtc: new Date().toISOString(),
    elapsedMilliseconds: 1_000,
    score: 0,
    livesRemaining: 5,
    game: {
      id: `game-${type}`,
      slug: type.toLowerCase(),
      title: type,
      summary: "Lös uppgiften.",
      sortOrder: 1,
      type,
    },
    challenge: {
      id: `challenge-${type}`,
      prompt: `Uppgift för ${type}`,
      imagePath: null,
      number: 1,
      total: 7,
      timeLimitSeconds: 300,
      questionNumber: 1,
      questionTotal: 2,
      pixelRevealCount: 0,
      currentChallengePenaltyMilliseconds: 0,
      awaitingNext: false,
      retryRequired: false,
      challengeStartedAtUtc: new Date().toISOString(),
      secondsRemaining: 300,
      options: [],
    },
    matching: null,
    sorting: null,
    wordAssembly: null,
    hangman: null,
  };
}

async function mockCurrentChallenge(page: Page, response: ChallengeResponse) {
  await page.route(`**/api/sessions/${sessionId}/current-challenge`, (route) =>
    route.fulfill({ json: response }));
}

async function mockSubmission(
  page: Page,
  endpoint: string,
  response: object,
) {
  await page.route(`**/api/sessions/${sessionId}/${endpoint}`, (route) =>
    route.fulfill({ json: response }));
}

test("en besökare kan starta en ny spelomgång", async ({ page }) => {
  const quiz = challengeResponse("Quiz");
  quiz.challenge.prompt = "Vilket färdmedel går på räls?";
  quiz.challenge.options = [
    { id: "train", text: "Tåg" },
    { id: "car", text: "Bil" },
  ];

  await page.route("**/api/games", (route) => route.fulfill({
    json: [quiz.game],
  }));
  await page.route("**/api/leaderboard", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/privacy", (route) => route.fulfill({
    json: { mode: "Event", retentionDays: 30 },
  }));
  await page.route("**/api/sessions/", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ playerName: "Ada" });
    await route.fulfill({
      json: {
        id: sessionId,
        playerName: "Ada",
        experienceMode: "Event",
        startedAtUtc: new Date().toISOString(),
        completedAtUtc: null,
        status: "InProgress",
        elapsedMilliseconds: 0,
        score: 0,
        livesRemaining: 5,
      },
    });
  });
  await mockCurrentChallenge(page, quiz);

  await page.goto("/");
  await page.getByLabel("DITT SMEKNAMN").fill("Ada");
  await page.getByRole("button", { name: /starta uppdraget/i }).click();

  await expect(page).toHaveURL(`/play/${sessionId}`);
  await expect(page.getByRole("heading", { name: "Vilket färdmedel går på räls?" }))
    .toBeVisible();
});

test("en spelare utan liv kan börja om med samma namn", async ({ page }) => {
  const retrySessionId = "00000000-0000-0000-0000-000000000002";
  const restartedChallenge = challengeResponse("Quiz");
  restartedChallenge.sessionId = retrySessionId;
  restartedChallenge.challenge.prompt = "Första aktiva uppdraget";
  restartedChallenge.challenge.options = [
    { id: "train", text: "Tåg" },
    { id: "car", text: "Bil" },
  ];

  await page.route(`**/api/sessions/${sessionId}/current-challenge`, (route) =>
    route.fulfill({
      json: {
        completed: true,
        failed: true,
        playerName: "Ada",
        elapsedMilliseconds: 12_000,
        score: 1_800,
        livesRemaining: 0,
      },
    }));
  await page.route("**/api/sessions/", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ playerName: "Ada" });
    await route.fulfill({
      json: {
        id: retrySessionId,
        playerName: "Ada",
        experienceMode: "Event",
        startedAtUtc: new Date().toISOString(),
        completedAtUtc: null,
        status: "InProgress",
        elapsedMilliseconds: 0,
        score: 0,
        livesRemaining: 5,
      },
    });
  });
  await page.route(`**/api/sessions/${retrySessionId}/current-challenge`,
    (route) => route.fulfill({ json: restartedChallenge }));

  await page.goto(`/play/${sessionId}`);
  await expect(page.getByRole("heading", { name: "Uppdraget misslyckades." }))
    .toBeVisible();
  await page.getByRole("button", { name: "Försök igen" }).click();

  await expect(page).toHaveURL(`/play/${retrySessionId}`);
  await expect(page.getByRole("heading", { name: "Första aktiva uppdraget" }))
    .toBeVisible();
});

test("ett fel svar pausar tiden tills spelaren försöker igen", async ({ page }) => {
  const quiz = challengeResponse("Quiz");
  quiz.challenge.options = [
    { id: "wrong", text: "Fel svar" },
    { id: "correct", text: "Rätt svar" },
  ];
  await mockCurrentChallenge(page, quiz);
  await mockSubmission(page, "answers", {
    correct: false,
    expired: false,
    message: "Det var inte rätt svar. Tryck på Försök igen när du är redo.",
    retryRequired: true,
    challengeStartedAtUtc: quiz.challenge.challengeStartedAtUtc,
    timeLimitSeconds: 300,
    secondsRemaining: 241,
    progress: {
      score: 0,
      scoreAwarded: 0,
      livesRemaining: 4,
      lifeLost: true,
      gameOver: false,
      timedOut: false,
    },
  });
  await page.route(`**/api/sessions/${sessionId}/retry`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ challengeId: "challenge-Quiz" });
    await route.fulfill({
      json: {
        retryRequired: false,
        challengeStartedAtUtc: new Date().toISOString(),
        timeLimitSeconds: 300,
        currentChallengePenaltyMilliseconds: 0,
        secondsRemaining: 241,
      },
    });
  });

  await page.goto(`/play/${sessionId}`);
  await page.getByText("Fel svar", { exact: true }).click();
  await page.getByRole("button", { name: "Bekräfta svar" }).click();

  await expect(page.getByRole("button", { name: "Försök igen" })).toBeVisible();
  await expect(page.getByText("241 SEK")).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page.getByText("241 SEK")).toBeVisible();
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(page.getByRole("button", { name: "Bekräfta svar" })).toBeDisabled();
});

for (const game of [
  { type: "Quiz", option: "Tåg", optionId: "train" },
  { type: "TrueFalse", option: "Sant", optionId: "true" },
  { type: "PixelHunt", option: "Vägmärke", optionId: "sign" },
] satisfies Array<{ type: "Quiz" | "TrueFalse" | "PixelHunt"; option: string; optionId: string }>) {
  test(`${game.type} skickar spelarens valda svar`, async ({ page }) => {
    const response = challengeResponse(game.type);
    response.challenge.options = [
      { id: game.optionId, text: game.option },
      { id: "other", text: game.type === "TrueFalse" ? "Falskt" : "Annat svar" },
    ];
    if (game.type === "PixelHunt") {
      response.challenge.imagePath = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' fill='red'/></svg>";
    }
    await mockCurrentChallenge(page, response);
    await mockSubmission(page, "answers", {
      correct: true,
      completed: false,
      successMessage: "Rätt svar!",
      elapsedMilliseconds: 2_000,
    });

    await page.goto(`/play/${sessionId}`);
    const answerRequest = page.waitForRequest(`**/api/sessions/${sessionId}/answers`);
    await page.getByText(game.option, { exact: true }).click();
    const submitAnswer = page.getByRole("button", { name: /bekräfta svar/i });
    await expect(submitAnswer).toBeEnabled();
    await submitAnswer.click();

    expect((await answerRequest).postDataJSON()).toEqual({
      challengeId: `challenge-${game.type}`,
      optionId: game.optionId,
    });
    await expect(page.getByRole("status")).toHaveText("Rätt svar!");
  });
}

test("Risk & Säkerhet kopplar en händelse till vald riskzon", async ({ page }) => {
  const response = challengeResponse("Matching");
  response.matching = {
    scenarios: [{
      id: "scenario-1",
      prompt: "Ett tåg närmar sig en korsning.",
      imagePath: null,
      options: [{
        id: "crossing-option",
        text: "Järnvägskorsning",
        iconKey: "train-front",
      }],
    }],
    destinations: [{ text: "Järnvägskorsning", iconKey: "train-front" }],
  };
  await mockCurrentChallenge(page, response);
  await mockSubmission(page, "matches", {
    correct: true,
    incorrectChallengeIds: [],
    successMessage: "Alla kopplingar är rätt!",
    elapsedMilliseconds: 2_000,
  });

  await page.goto(`/play/${sessionId}`);
  await page.getByRole("button", { name: /ett tåg närmar sig/i }).click();
  await page.getByRole("button", { name: /järnvägskorsning/i }).click();
  const request = page.waitForRequest(`**/api/sessions/${sessionId}/matches`);
  await page.getByRole("button", { name: /kontrollera kopplingar/i }).click();

  expect((await request).postDataJSON()).toEqual({
    challengeId: "challenge-Matching",
    selections: [{ challengeId: "scenario-1", optionId: "crossing-option" }],
  });
  await expect(page.getByRole("status")).toHaveText("Alla kopplingar är rätt!");
});

test("Sortera rätt placerar och skickar kortets målområde", async ({ page }) => {
  const response = challengeResponse("Sorting");
  response.sorting = {
    cards: [{ id: "card-1", text: "Tågtrafikledning" }],
    categories: ["Trafikledning"],
  };
  await mockCurrentChallenge(page, response);
  await mockSubmission(page, "sorting", {
    correct: true,
    incorrectOptionIds: [],
    currentChallengePenaltyMilliseconds: 0,
    successMessage: "Rätt sorterat!",
    elapsedMilliseconds: 2_000,
  });

  await page.goto(`/play/${sessionId}`);
  await page.getByRole("button", { name: "Tågtrafikledning" }).click();
  await page.getByRole("region", { name: "Sorteringsområde Trafikledning" })
    .getByRole("button", { name: /placera här/i }).click();
  const request = page.waitForRequest(`**/api/sessions/${sessionId}/sorting`);
  await page.getByRole("button", { name: /kontrollera sortering/i }).click();

  expect((await request).postDataJSON()).toEqual({
    challengeId: "challenge-Sorting",
    placements: [{ optionId: "card-1", category: "Trafikledning" }],
  });
  await expect(page.getByText("Rätt sorterat!", { exact: true })).toBeVisible();
});

test("Bilda ordet ändrar ordning och skickar orddelarna", async ({ page }) => {
  const response = challengeResponse("WordAssembly");
  response.wordAssembly = {
    parts: [
      { id: "system", text: "System" },
      { id: "traffic", text: "Trafik" },
    ],
  };
  await mockCurrentChallenge(page, response);
  await mockSubmission(page, "word-assembly", {
    correct: true,
    incorrectOptionIds: [],
    successMessage: "Ordet är rätt!",
    elapsedMilliseconds: 2_000,
  });

  await page.goto(`/play/${sessionId}`);
  await page.getByRole("button", { name: "Flytta System åt höger" }).click();
  const request = page.waitForRequest(`**/api/sessions/${sessionId}/word-assembly`);
  await page.getByRole("button", { name: /kontrollera ordning/i }).click();

  expect((await request).postDataJSON()).toEqual({
    challengeId: "challenge-WordAssembly",
    orderedOptionIds: ["traffic", "system"],
  });
  await expect(page.getByText("Ordet är rätt!", { exact: true })).toBeVisible();
});

test("Signalordet skickar en tangentbordsgissning och uppdaterar ordet", async ({ page }) => {
  const response = challengeResponse("Hangman");
  response.hangman = {
    pattern: [null, null],
    guessedLetters: [],
    mistakes: 0,
    maxMistakes: 6,
    solved: false,
  };
  await mockCurrentChallenge(page, response);
  await mockSubmission(page, "hangman-guesses", {
    correct: true,
    solved: false,
    roundReset: false,
    message: "Bokstaven finns i ordet.",
    elapsedMilliseconds: 2_000,
    hangman: {
      pattern: ["T", null],
      guessedLetters: ["T"],
      mistakes: 0,
      maxMistakes: 6,
      solved: false,
    },
  });

  await page.goto(`/play/${sessionId}`);
  const request = page.waitForRequest(`**/api/sessions/${sessionId}/hangman-guesses`);
  await page.getByRole("button", { name: "Gissa på T" }).click();

  expect((await request).postDataJSON()).toEqual({
    challengeId: "challenge-Hangman",
    letter: "T",
  });
  await expect(page.getByRole("status")).toHaveText("Bokstaven finns i ordet.");
  await expect(page.getByRole("button", { name: "T, redan gissad" })).toBeDisabled();
});
