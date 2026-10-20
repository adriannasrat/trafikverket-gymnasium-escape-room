import { describe, expect, it } from "vitest";
import { gameTypes } from "../../types";
import { adminGameEditorRegistry } from "./registry";

describe("admin game editor registry", () => {
  it("registers an editor for every supported game type", () => {
    expect(Object.keys(adminGameEditorRegistry).sort()).toEqual([...gameTypes].sort());
  });
});
