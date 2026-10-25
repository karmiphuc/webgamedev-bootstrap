// LOCKED (see docs/CHARTER.md). Long sessions stay bounded, finite, valid
// and fast. Budgets live in game.config.json; the soak length in testkit.SOAK.
// Runs in `npm run soak` and `npm run check:full` (skipped in the fast check).
import { describe, expect, it } from "vitest";
import config from "../../game.config.json" with { type: "json" };
import { hashState, stableStringify } from "../../src/core/hash";
import { encodeSave } from "../../src/core/save";
import { SAVE_CODEC, SOAK, createGame, invariants, play, prepareSoak } from "../../src/sim/testkit";

const CHUNKS = 60;

describe.skipIf(process.env.SOAK !== "1")("locked: soak", () => {
  for (const seed of SOAK.seeds) {
    it(`seed ${seed}: ${SOAK.ticks} ticks stay bounded, finite and within budgets`, () => {
      const s = createGame(seed);
      prepareSoak(s);
      let worst = 0;
      for (let c = 0; c < CHUNKS; c++) {
        const t0 = performance.now();
        play(s, Math.ceil(SOAK.ticks / CHUNKS));
        worst = Math.max(worst, ((performance.now() - t0) * 1000) / Math.ceil(SOAK.ticks / CHUNKS));
        expect(invariants(s)).toEqual([]);
      }
      expect(() => stableStringify(s)).not.toThrow();
      expect(encodeSave(SAVE_CODEC, s).length).toBeLessThan(config.budgets.saveBytes);
      expect(worst, "worst average microseconds per tick (budgets.stepMicros)").toBeLessThan(config.budgets.stepMicros);
      console.log(`seed ${seed}: worst ${worst.toFixed(1)} us/tick, hash ${hashState(s)}`);
    });
  }
});
