// The most valuable tests in this repo. If these pass, saves, replays,
// bots and bug reproduction ("world K7F2QX, tick 840") all work.

import { describe, expect, it } from "vitest";
import { hashState } from "../../src/core/hash";
import { SAVE_CODEC, validateState } from "../../src/sim/state";
import { decodeSave, encodeSave } from "../../src/core/save";
import { fresh, kitingScript, nonFinite, run } from "./helpers";

const TICKS = 1200;

describe("determinism", () => {
  it("same seed + same inputs = identical state", () => {
    const script = kitingScript(TICKS);
    const a = fresh(1234);
    const b = fresh(1234);
    run(a, TICKS, script);
    run(b, TICKS, script);
    expect(hashState(a)).toBe(hashState(b));
  });

  it("different seeds diverge", () => {
    const a = fresh(1);
    const b = fresh(2);
    run(a, 300);
    run(b, 300);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("save at tick N, load, continue == uninterrupted run", () => {
    const script = kitingScript(TICKS);
    const straight = fresh(99);
    run(straight, TICKS, script);

    const split = fresh(99);
    run(split, TICKS / 2, script);
    const reloaded = decodeSave(SAVE_CODEC, encodeSave(SAVE_CODEC, split));
    run(reloaded, TICKS / 2, script);

    expect(hashState(reloaded)).toBe(hashState(straight));
  });

  it("state stays valid, finite and JSON-faithful throughout a run", () => {
    const s = fresh(7);
    const script = kitingScript(TICKS);
    for (let chunk = 0; chunk < 12; chunk++) {
      run(s, TICKS / 12, script);
      expect(nonFinite(s)).toEqual([]);
      expect(validateState(s)).toEqual([]);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});
