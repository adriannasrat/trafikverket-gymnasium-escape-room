import { describe, expect, it } from "vitest";
import { gameTypes } from "../types";
import { gameCatalog, gameTypeOrder, manageableGameTypes } from "./gameCatalog";

describe("game catalog", () => {
  it("contains presentation copy for every supported game type", () => {
    expect(gameTypeOrder).toEqual(gameTypes);
    expect(Object.keys(gameCatalog).sort()).toEqual([...gameTypes].sort());
    expect([...manageableGameTypes].sort()).toEqual([...gameTypes].sort());
  });

  it("uses unique route labels", () => {
    const labels = gameTypeOrder.map((type) => gameCatalog[type].routeLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
