import { afterEach, describe, expect, it, vi } from "vitest";
import { api, getApiErrorMessage } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getApiErrorMessage", () => {
  it("prioriterar ett konkret meddelande från servern", () => {
    expect(getApiErrorMessage({
      message: "Spelaren kunde inte hittas.",
      title: "Bad Request",
    })).toBe("Spelaren kunde inte hittas.");
  });

  it("visar valideringsdetaljen före en generell problemtitel", () => {
    expect(getApiErrorMessage({
      title: "One or more validation errors occurred.",
      errors: {
        challenges: ["Minst en fråga måste finnas."],
      },
    })).toBe("Minst en fråga måste finnas.");
  });

  it("använder ett tryggt standardmeddelande för ett tomt svar", () => {
    expect(getApiErrorMessage(null)).toBe("Något gick fel. Försök igen.");
  });
});

describe("antiforgery token lifecycle", () => {
  it("fetches a new token after login before uploading an image", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "anonymous-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ username: "event-admin" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "authenticated-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ imagePath: "/uploads/image.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await api.login("event-admin", "password");
    await api.uploadChallengeImage(
      "challenge-id",
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "skylt.png", {
        type: "image/png",
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      "X-CSRF-TOKEN": "anonymous-token",
    });
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({
      "X-CSRF-TOKEN": "authenticated-token",
    });
  });
});
