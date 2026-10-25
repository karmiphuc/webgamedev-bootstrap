// Game-owned: content data checks. Add a validator rule for every data
// mistake that slips through once.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateContent } from "../../src/content/validate";

const atlas = JSON.parse(readFileSync(new URL("../../public/assets/sprites/atlas.json", import.meta.url), "utf8"));

describe("content", () => {
  it("has no data errors and every sprite exists in the atlas", () => {
    expect(validateContent(atlas)).toEqual([]);
  });
});
