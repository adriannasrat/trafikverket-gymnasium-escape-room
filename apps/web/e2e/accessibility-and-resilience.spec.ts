import { expect, test, type Page } from "@playwright/test";
import type { AdminGame, ChallengeResponse, GameType } from "../src/types";

const sessionId = "00000000-0000-0000-0000-000000000091";

function quizChallenge(): ChallengeResponse {
  return {
    completed: false,
    sessionId,
    playerName: "Tangentbordstest",
    startedAtUtc: new Date().toISOString(),
    elapsedMilliseconds: 1_000,
    score: 0,
    livesRemaining: 5,
    game: {
      id: "game-quiz",
      slug: "uppdraget",
      title: "Uppdraget",
      summary: "Testa transportsystemet.",
      sortOrder: 1,
      type: "Quiz",
    },
    challenge: {
      id: "challenge-quiz",
      prompt: "Vilket färdmedel går på räls?",
      imagePath: null,
      number: 1,
      total: 7,
      timeLimitSeconds: 300,
      questionNumber: 1,
      questionTotal: 1,
      pixelRevealCount: 0,
      currentChallengePenaltyMilliseconds: 0,
      awaitingNext: false,
      retryRequired: false,
      challengeStartedAtUtc: new Date().toISOString(),
      secondsRemaining: 300,
      options: [
        { id: "train", text: "Tåg" },
        { id: "car", text: "Bil" },
      ],
    },
    matching: null,
    sorting: null,
    wordAssembly: null,
    hangman: null,
  };
}

function layoutChallenge(type: GameType): ChallengeResponse {
  const response = quizChallenge();
  response.game = {
    ...response.game,
    id: `game-${type}`,
    slug: type.toLowerCase(),
    title: type,
    type,
  };
  response.challenge = {
    ...response.challenge,
    id: `challenge-${type}`,
    prompt: `Uppgift för ${type}`,
    options: [],
  };

  if (type === "Quiz" || type === "TrueFalse") {
    response.challenge.options = type === "TrueFalse"
      ? [{ id: "true", text: "Sant" }, { id: "false", text: "Falskt" }]
      : [{ id: "train", text: "Tåg" }, { id: "car", text: "Bil" }];
  }
  if (type === "PixelHunt") {
    response.challenge.imagePath = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='600' height='400' fill='red'/></svg>";
    response.challenge.options = [
      { id: "sign", text: "Vägmärke" },
      { id: "other", text: "Annat svar" },
    ];
  }
  if (type === "Matching") {
    response.matching = {
      scenarios: [{
        id: "scenario-1",
        prompt: "Ett tåg närmar sig en järnvägskorsning.",
        imagePath: null,
        options: [{
          id: "crossing-option",
          text: "Järnvägskorsning",
          iconKey: "train-front",
        }],
      }],
      destinations: [{ text: "Järnvägskorsning", iconKey: "train-front" }],
    };
  }
  if (type === "Sorting") {
    response.sorting = {
      cards: [{ id: "card-1", text: "Tågtrafikledning" }],
      categories: ["Trafikledning", "Samhällsplanering", "Teknik"],
    };
  }
  if (type === "WordAssembly") {
    response.wordAssembly = {
      parts: [
        { id: "system", text: "System" },
        { id: "traffic", text: "Trafik" },
        { id: "information", text: "Information" },
      ],
    };
  }
  if (type === "Hangman") {
    response.hangman = {
      pattern: [null, null, null, null, null, null],
      guessedLetters: [],
      mistakes: 0,
      maxMistakes: 6,
      solved: false,
    };
  }

  return response;
}

function adminQuiz(): AdminGame {
  return {
    id: "game-quiz",
    slug: "uppdraget",
    title: "Uppdraget",
    summary: "Testa transportsystemet.",
    sortOrder: 1,
    type: "Quiz",
    isActive: true,
    defaultTimeLimitSeconds: 300,
    successMessage: "Rätt svar.",
    supportsChallengeImages: true,
    allowsChallengeImageUploads: true,
    requiresChallengeImages: false,
    supportsChallengeActivation: true,
    challenges: [{
      id: "challenge-quiz",
      prompt: "Vilket färdmedel går på räls?",
      imagePath: null,
      isEnabled: true,
      sortOrder: 1,
      timeLimitSeconds: null,
      options: [
        {
          id: "train",
          text: "Tåg",
          sortOrder: 1,
          isCorrect: true,
          sortingCategory: null,
          matchingIconKey: null,
        },
        {
          id: "car",
          text: "Bil",
          sortOrder: 2,
          isCorrect: false,
          sortingCategory: null,
          matchingIconKey: null,
        },
      ],
    }],
  };
}

async function mockStartPage(page: Page) {
  const challenge = quizChallenge();
  await page.route("**/api/games", (route) => route.fulfill({ json: [challenge.game] }));
  await page.route("**/api/leaderboard", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/privacy", (route) => route.fulfill({
    json: { mode: "Event", retentionDays: 30 },
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(sizes.document, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.body, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport + 1);
}

test("spelvyn återhämtar sig efter ett tillfälligt nätverksavbrott", async ({ page }) => {
  let attempts = 0;
  await page.route(`**/api/sessions/${sessionId}/current-challenge`, async (route) => {
    attempts += 1;
    // React StrictMode intentionally mounts effects twice in development.
    // Abort both initial requests so recovery must come from the retry reload.
    if (attempts <= 2) {
      await route.abort("internetdisconnected");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: quizChallenge() });
  });

  await page.goto(`/play/${sessionId}`);
  await expect(page.getByRole("heading", { name: "Kontakten bröts" })).toBeVisible();
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(page.getByText("Kopplar upp trafikledningen…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vilket färdmedel går på räls?" }))
    .toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(3);
});

test("en avbruten spelstart kan göras om med samma smeknamn", async ({ page }) => {
  await mockStartPage(page);
  await page.route(`**/api/sessions/${sessionId}/current-challenge`, (route) =>
    route.fulfill({ json: quizChallenge() }));
  let attempts = 0;
  await page.route("**/api/sessions/", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.abort("internetdisconnected");
      return;
    }
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

  await page.goto("/");
  const nickname = page.getByLabel("DITT SMEKNAMN");
  await nickname.fill("Ada");
  const start = page.getByRole("button", { name: /starta uppdraget/i });
  await start.click();
  await expect(page.getByRole("alert")).toHaveText("Nätverksanslutningen bröts.");
  await expect(nickname).toHaveValue("Ada");
  await expect(start).toBeEnabled();

  await start.click();
  await expect(page).toHaveURL(`/play/${sessionId}`);
  await expect(page.getByRole("heading", { name: "Vilket färdmedel går på räls?" }))
    .toBeVisible();
});

test("ett avbrutet svar kan skickas igen utan att spelaren tappar sitt val", async ({ page }) => {
  await page.route(`**/api/sessions/${sessionId}/current-challenge`, (route) =>
    route.fulfill({ json: quizChallenge() }));
  let submissions = 0;
  await page.route(`**/api/sessions/${sessionId}/answers`, async (route) => {
    submissions += 1;
    if (submissions === 1) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({
      json: {
        correct: true,
        completed: false,
        successMessage: "Rätt svar!",
        elapsedMilliseconds: 2_000,
      },
    });
  });

  await page.goto(`/play/${sessionId}`);
  await page.getByText("Tåg", { exact: true }).click();
  const submit = page.getByRole("button", { name: "Bekräfta svar" });
  await submit.click();
  await expect(page.getByRole("status")).toHaveText("Nätverksanslutningen bröts.");
  await expect(page.getByRole("radio", { name: "Tåg" })).toBeChecked();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("status")).toHaveText("Rätt svar!");
  expect(submissions).toBe(2);
});

test("admin och topplistan erbjuder försök igen efter nätverksfel", async ({ page }) => {
  let adminAttempts = 0;
  await page.route("**/api/admin/games", async (route) => {
    adminAttempts += 1;
    if (adminAttempts === 1) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({ json: [adminQuiz()] });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Uppdragen kunde inte laddas" })).toBeVisible();
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(page.getByRole("heading", { name: "Hantera uppdrag" })).toBeVisible();

  let leaderboardAttempts = 0;
  await page.route("**/api/leaderboard", async (route) => {
    leaderboardAttempts += 1;
    if (leaderboardAttempts === 1) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "Topplistan kunde inte laddas" })).toBeVisible();
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(page.getByRole("heading", { name: "Första platsen väntar" })).toBeVisible();
});

test("spelare och admin ryms på mobil och spelarvyn på eventskärm", async ({ page }) => {
  let currentChallenge = quizChallenge();
  await mockStartPage(page);
  await page.route(`**/api/sessions/${sessionId}/current-challenge`, (route) =>
    route.fulfill({ json: currentChallenge }));
  await page.route("**/api/admin/games", (route) =>
    route.fulfill({ json: [adminQuiz()] }));

  const gameTypes: GameType[] = [
    "Quiz",
    "Matching",
    "TrueFalse",
    "PixelHunt",
    "Sorting",
    "WordAssembly",
    "Hangman",
  ];

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Håll Sverige/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    for (const gameType of gameTypes) {
      currentChallenge = layoutChallenge(gameType);
      await page.goto(`/play/${sessionId}`);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Hantera uppdrag" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const gameType of gameTypes) {
    currentChallenge = layoutChallenge(gameType);
    await page.goto(`/play/${sessionId}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByLabel("Uppdragsrutt")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("svarsalternativ visar en synlig fokusmarkering för tangentbord", async ({ page }) => {
  await page.route(`**/api/sessions/${sessionId}/current-challenge`, (route) =>
    route.fulfill({ json: quizChallenge() }));
  await page.goto(`/play/${sessionId}`);

  const firstAnswer = page.getByRole("radio", { name: "Tåg" });
  for (let step = 0; step < 30; step += 1) {
    if (await firstAnswer.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(firstAnswer).toBeFocused();
  const outline = await firstAnswer.evaluate((element) => {
    const label = element.closest("label");
    if (!label) return { style: "none", width: "0px" };
    const computed = getComputedStyle(label);
    return { style: computed.outlineStyle, width: computed.outlineWidth };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).not.toBe("0px");
});
