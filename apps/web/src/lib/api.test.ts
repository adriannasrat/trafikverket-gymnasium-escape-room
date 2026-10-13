import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./api";

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
