// LOCKED (see docs/CHARTER.md). Same seed + same inputs = same world, and a
// save taken mid-run resumes exactly. Talks to the game only via testkit.
import { describe, expect, it } from "vitest";
import { hashState, stableStringify } from "../../src/core/hash";
import { decodeSave, encodeSave } from "../../src/core/save";
import { SAVE_CODEC, advance, createGame, invariants, play } from "../../src/sim/testkit";

const TICKS = 1200;

describe("locked: determinism", () => {
  it("same seed + same inputs = identical state (played and idle)", () => {
    const a = createGame(1234);
    const b = createGame(1234);
    play(a, TICKS);
    play(b, TICKS);
    expect(hashState(a)).toBe(hashState(b));
    const c = createGame(77);
    const d = createGame(77);
    advance(c, TICKS);
    advance(d, TICKS);
    expect(hashState(c)).toBe(hashState(d));
  });

  it("different seeds produce different worlds", () => {
    const a = createGame(1);
    const b = createGame(2);
    play(a, 300);
    play(b, 300);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("save at tick N, load, continue == uninterrupted run", () => {
    const straight = createGame(99);
    play(straight, TICKS);
    const split = createGame(99);
    play(split, TICKS / 2);
    const reloaded = decodeSave(SAVE_CODEC, encodeSave(SAVE_CODEC, split));
    play(reloaded, TICKS / 2);
    expect(hashState(reloaded)).toBe(hashState(straight));
  });

  it("state stays valid, finite, bounded and JSON-faithful throughout a run", () => {
    const s = createGame(7);
    for (let chunk = 0; chunk < 12; chunk++) {
      play(s, TICKS / 12);
      expect(() => stableStringify(s)).not.toThrow(); // throws on NaN/Infinity
      expect(invariants(s)).toEqual([]);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});
