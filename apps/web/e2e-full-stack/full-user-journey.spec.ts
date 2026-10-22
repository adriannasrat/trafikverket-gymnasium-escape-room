import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type Response,
} from "@playwright/test";
import { formatElapsed } from "../src/lib/time";
import {
  gameTypes,
  type AdminGame,
  type AdminResult,
  type AnswerResult,
  type ChallengeResponse,
  type CurrentChallengeResponse,
  type GameType,
  type HangmanResult,
  type LeaderboardEntry,
  type MatchingResult,
  type Session,
  type SortingResult,
  type WordAssemblyResult,
} from "../src/types";

const adminUsername = process.env.E2E_ADMIN_USERNAME ?? "e2e-admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";

async function readJson<T>(
  response: APIResponse | Response,
  operation: string,
): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `${operation} failed with ${response.status()}: ${await response.text()}`,
    );
  }
  return response.json() as Promise<T>;
}

async function authenticateAdmin(request: APIRequestContext) {
  const anonymousCsrf = await readJson<{ token: string }>(
    await request.get("/api/auth/csrf"),
    "Fetch anonymous CSRF token",
  );
  await readJson<{ username: string }>(
    await request.post("/api/auth/login", {
      data: { username: adminUsername, password: adminPassword },
      headers: { "X-CSRF-TOKEN": anonymousCsrf.token },
    }),
    "Admin login",
  );

  // Antiforgery tokens are identity-bound. Fetch a new token after login.
  return readJson<{ token: string }>(
    await request.get("/api/auth/csrf"),
    "Fetch authenticated CSRF token",
  ).then(({ token }) => token);
}

function findGame(games: AdminGame[], type: GameType) {
  const game = games.find((candidate) => candidate.type === type);
  if (!game) throw new Error(`Missing admin configuration for ${type}.`);
  return game;
}

function findChallenge(game: AdminGame, challengeId: string) {
  const challenge = game.challenges.find((candidate) => candidate.id === challengeId);
  if (!challenge) {
    throw new Error(`Missing challenge ${challengeId} in ${game.type}.`);
  }
  return challenge;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function submitAndRead<T>(
  page: Page,
  sessionId: string,
  endpoint: string,
  buttonName: RegExp,
) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" &&
      url.pathname === `/api/sessions/${sessionId}/${endpoint}`;
  });
  await page.getByRole("button", { name: buttonName }).click();
  const response = await responsePromise;
  return readJson<T>(response, `Submit ${endpoint}`);
}

async function solveChoiceGame(
  page: Page,
  sessionId: string,
  current: ChallengeResponse,
  game: AdminGame,
) {
  const challenge = findChallenge(game, current.challenge.id);
  const correctOption = challenge.options.find((option) => option.isCorrect);
  if (!correctOption) throw new Error(`No correct option for ${game.type}.`);

  await page.getByText(correctOption.text, { exact: true }).click();
  const result = await submitAndRead<AnswerResult>(
    page,
    sessionId,
    "answers",
    /bekräfta svar/i,
  );
  expect(result.correct).toBe(true);
}

async function solveMatchingGame(
  page: Page,
  sessionId: string,
  current: ChallengeResponse,
  game: AdminGame,
) {
  if (!current.matching) throw new Error("Matching payload is missing.");
  const destinationColumn = page
    .getByText("2 · Koppla till rätt riskzon", { exact: true })
    .locator("..");

  for (const scenario of current.matching.scenarios) {
    const challenge = findChallenge(game, scenario.id);
    const correctOption = challenge.options.find((option) => option.isCorrect);
    if (!correctOption) {
      throw new Error(`No correct matching destination for ${scenario.id}.`);
    }

    await page.getByRole("button", {
      name: new RegExp(escapeRegExp(scenario.prompt), "i"),
    }).click();
    await destinationColumn
      .getByRole("button", {
        name: new RegExp(escapeRegExp(correctOption.text), "i"),
      })
      .click();
  }

  const result = await submitAndRead<MatchingResult>(
    page,
    sessionId,
    "matches",
    /kontrollera kopplingar/i,
  );
  expect(result.correct).toBe(true);
  expect(result.incorrectChallengeIds).toEqual([]);
}

async function solveSortingGame(
  page: Page,
  sessionId: string,
  current: ChallengeResponse,
  game: AdminGame,
) {
  if (!current.sorting) throw new Error("Sorting payload is missing.");
  const challenge = findChallenge(game, current.challenge.id);

  for (const card of current.sorting.cards) {
    const configuredCard = challenge.options.find((option) => option.id === card.id);
    if (!configuredCard) throw new Error(`Missing sorting card ${card.id}.`);
    if (configuredCard.sortingCategory === null) continue;

    await page.getByRole("button", { name: card.text, exact: true }).click();
    await page
      .getByRole("region", {
        name: `Sorteringsområde ${configuredCard.sortingCategory}`,
      })
      .getByRole("button", { name: /placera här/i })
      .click();
  }

  const result = await submitAndRead<SortingResult>(
    page,
    sessionId,
    "sorting",
    /kontrollera sortering/i,
  );
  expect(result.correct).toBe(true);
  expect(result.incorrectOptionIds).toEqual([]);
}

async function solveWordAssemblyGame(
  page: Page,
  sessionId: string,
  current: ChallengeResponse,
  game: AdminGame,
) {
  if (!current.wordAssembly) throw new Error("Word-assembly payload is missing.");
  const challenge = findChallenge(game, current.challenge.id);
  const desiredOrder = [...challenge.options]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((option) => option.text);
  // The server deliberately shuffles the parts for every challenge response.
  // Read the browser's rendered order instead of relying on a second API call.
  const currentOrder = await page
    .getByRole("button", { name: /^Dra orddelen / })
    .evaluateAll((buttons) => buttons.map((button) => {
      const label = button.getAttribute("aria-label") ?? "";
      return label.match(/^Dra orddelen (.*), position \d+ av \d+$/)?.[1] ?? "";
    }));

  for (let targetIndex = 0; targetIndex < desiredOrder.length; targetIndex += 1) {
    const text = desiredOrder[targetIndex];
    let currentIndex = currentOrder.indexOf(text);
    if (currentIndex < 0) throw new Error(`Missing word part ${text}.`);

    while (currentIndex > targetIndex) {
      await page
        .getByRole("button", { name: `Flytta ${text} åt vänster`, exact: true })
        .click();
      [currentOrder[currentIndex - 1], currentOrder[currentIndex]] =
        [currentOrder[currentIndex], currentOrder[currentIndex - 1]];
      currentIndex -= 1;
    }
  }

  const result = await submitAndRead<WordAssemblyResult>(
    page,
    sessionId,
    "word-assembly",
    /kontrollera ordning/i,
  );
  expect(result.correct).toBe(true);
  expect(result.incorrectOptionIds).toEqual([]);
}

async function solveHangmanGame(
  page: Page,
  sessionId: string,
  current: ChallengeResponse,
  game: AdminGame,
) {
  const challenge = findChallenge(game, current.challenge.id);
  const answer = challenge.options[0]?.text;
  if (!answer) throw new Error("Hangman answer is missing.");

  const letters = [...new Set(
    [...answer.toLocaleUpperCase("sv-SE")]
      .filter((letter) => /^[A-ZÅÄÖ]$/.test(letter)),
  )];
  let latestResult: HangmanResult | null = null;

  for (const letter of letters) {
    const button = page.getByRole("button", {
      name: `Gissa på ${letter}`,
      exact: true,
    });
    await expect(button).toBeEnabled();
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" &&
        url.pathname === `/api/sessions/${sessionId}/hangman-guesses`;
    });
    await button.click();
    latestResult = await readJson<HangmanResult>(
      await responsePromise,
      `Guess hangman letter ${letter}`,
    );
  }

  expect(latestResult?.solved).toBe(true);
}

async function solveCurrentChallenge(
  page: Page,
  sessionId: string,
  current: ChallengeResponse,
  games: AdminGame[],
) {
  const game = findGame(games, current.game.type);
  const heading = current.game.type === "Matching"
    ? current.game.summary
    : current.challenge.prompt;
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();

  switch (current.game.type) {
    case "Quiz":
    case "TrueFalse":
    case "PixelHunt":
      await solveChoiceGame(page, sessionId, current, game);
      break;
    case "Matching":
      await solveMatchingGame(page, sessionId, current, game);
      break;
    case "Sorting":
      await solveSortingGame(page, sessionId, current, game);
      break;
    case "WordAssembly":
      await solveWordAssemblyGame(page, sessionId, current, game);
      break;
    case "Hangman":
      await solveHangmanGame(page, sessionId, current, game);
      break;
  }
}

async function completeAllGames(
  page: Page,
  request: APIRequestContext,
  sessionId: string,
  games: AdminGame[],
) {
  const completedGameTypes = new Set<GameType>();

  for (let step = 0; step < 30; step += 1) {
    const current = await readJson<CurrentChallengeResponse>(
      await request.get(`/api/sessions/${sessionId}/current-challenge`),
      "Fetch current challenge",
    );
    if (current.completed) {
      expect([...completedGameTypes].sort()).toEqual([...gameTypes].sort());
      return;
    }

    completedGameTypes.add(current.game.type);
    await solveCurrentChallenge(page, sessionId, current, games);

    const nextButton = page.getByRole("button", {
      name: /^(Nästa fråga|Nästa bild|Nästa ord|Nästa signalord|Nästa spel|Slutför uppdraget)$/,
    });
    await expect(nextButton).toBeEnabled();
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "GET" &&
        url.pathname === `/api/sessions/${sessionId}/current-challenge`;
    });
    await nextButton.click();
    await responsePromise;
  }

  throw new Error("The journey did not finish within 30 challenges.");
}

test("hela användarresan fungerar mot en riktig isolerad miljö", async ({
  page,
  request,
}) => {
  if (!adminPassword) {
    throw new Error(
      "E2E_ADMIN_PASSWORD is required. Run this test through scripts/test-full-stack-e2e.sh.",
    );
  }
  const playerName = `E2E-${Date.now()}`;
  let csrfToken = "";
  let originalGame: AdminGame | null = null;
  let sessionId = "";

  try {
    await page.goto("/admin/login");
    await page.getByLabel("ANVÄNDARNAMN").fill(adminUsername);
    await page.getByLabel("LÖSENORD").fill(adminPassword);
    await page.getByRole("button", { name: /öppna kontrollrummet/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Hantera uppdrag" }),
    ).toBeVisible();

    csrfToken = await authenticateAdmin(request);
    const gamesBeforeEdit = await readJson<AdminGame[]>(
      await request.get("/api/admin/games"),
      "Fetch admin games",
    );
    originalGame = structuredClone(findGame(gamesBeforeEdit, "Quiz"));
    const originalChallenge = originalGame.challenges.find(
      (challenge) => challenge.isEnabled,
    );
    if (!originalChallenge) throw new Error("No enabled quiz challenge exists.");
    const updatedPrompt = `${originalChallenge.prompt} [E2E ${Date.now()}]`;

    const challengeCard = page.locator("article").filter({
      hasText: originalChallenge.prompt,
    }).first();
    await challengeCard.getByRole("button").first().click();
    await challengeCard.getByLabel("FRÅGA / INSTRUKTION").fill(updatedPrompt);
    await expect(
      page.getByText("Alla ändringar är sparade.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(updatedPrompt, { exact: true })).toBeVisible();
    await page.getByText(updatedPrompt, { exact: true }).click();
    await expect(page.getByLabel("FRÅGA / INSTRUKTION")).toHaveValue(updatedPrompt);

    const gamesForJourney = await readJson<AdminGame[]>(
      await request.get("/api/admin/games"),
      "Fetch persisted admin games",
    );
    expect(
      findGame(gamesForJourney, "Quiz").challenges
        .find((challenge) => challenge.id === originalChallenge.id)?.prompt,
    ).toBe(updatedPrompt);

    await page.goto("/");
    await page.getByLabel("DITT SMEKNAMN").fill(playerName);
    await page.getByRole("button", { name: /starta uppdraget/i }).click();
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+$/i);
    sessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    expect(sessionId).not.toBe("");

    await completeAllGames(page, request, sessionId, gamesForJourney);
    await expect(
      page.getByRole("heading", { name: "Systemet är säkrat." }),
    ).toBeVisible();

    const completedSession = await readJson<Session>(
      await request.get(`/api/sessions/${sessionId}`),
      "Fetch completed session",
    );
    expect(completedSession.status).toBe("Completed");
    expect(completedSession.completedAtUtc).not.toBeNull();
    expect(completedSession.elapsedMilliseconds).toBeGreaterThanOrEqual(0);
    const expectedTime = formatElapsed(completedSession.elapsedMilliseconds);
    await expect(page.getByText("SLUTTID", { exact: true }).locator(".."))
      .toContainText(expectedTime);

    const adminResults = await readJson<AdminResult[]>(
      await request.get("/api/admin/results?mode=Event"),
      "Fetch admin results",
    );
    const adminResult = adminResults.find((result) => result.id === sessionId);
    expect(adminResult).toBeDefined();
    expect(adminResult?.playerName).toBe(playerName);
    expect(adminResult?.elapsedMilliseconds).toBe(completedSession.elapsedMilliseconds);

    const leaderboard = await readJson<LeaderboardEntry[]>(
      await request.get("/api/leaderboard"),
      "Fetch leaderboard",
    );
    const leaderboardResult = leaderboard.find((entry) => entry.id === sessionId);
    expect(leaderboardResult).toBeDefined();
    expect(leaderboardResult?.elapsedMilliseconds)
      .toBe(completedSession.elapsedMilliseconds);

    await page.getByRole("link", { name: /visa topplistan/i }).click();
    const leaderboardRow = page.locator("ol > li").filter({ hasText: playerName });
    await expect(leaderboardRow).toContainText(playerName);
    await expect(leaderboardRow).toContainText(expectedTime);
  } finally {
    // The runner also destroys the entire temporary database in a shell trap.
    // These explicit cleanups verify that production admin cleanup works too.
    if ((originalGame || sessionId) && !csrfToken) {
      csrfToken = await authenticateAdmin(request);
    }

    if (originalGame) {
      await readJson<AdminGame>(
        await request.put(`/api/admin/games/${originalGame.id}`, {
          data: originalGame,
          headers: { "X-CSRF-TOKEN": csrfToken },
        }),
        "Restore edited game",
      );
      const restoredGames = await readJson<AdminGame[]>(
        await request.get("/api/admin/games"),
        "Verify restored game",
      );
      expect(findGame(restoredGames, "Quiz")).toEqual(originalGame);
    }

    if (sessionId) {
      const response = await request.delete(`/api/admin/results/${sessionId}`, {
        headers: { "X-CSRF-TOKEN": csrfToken },
      });
      // An interrupted journey is not a result yet; the isolated stack cleanup
      // below removes that in-progress row together with the temporary database.
      expect([204, 404]).toContain(response.status());
      if (response.status() === 204) {
        const remaining = await readJson<AdminResult[]>(
          await request.get("/api/admin/results?mode=Event"),
          "Verify result cleanup",
        );
        expect(remaining.some((result) => result.id === sessionId)).toBe(false);
      }
    }
  }
});
