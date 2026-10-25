// Long-run soak with budgets from game.config.json. Skipped in the fast
// suite; run with `npm run soak` (also part of `npm run check:full`).
// Catches slow leaks, unbounded arrays, NaN drift and per-step cost creep.

import { describe, expect, it } from "vitest";
import config from "../../game.config.json" with { type: "json" };
import { hashState } from "../../src/core/hash";
import { encodeSave } from "../../src/core/save";
import { WORLD } from "../../src/content/units";
import { Sim } from "../../src/sim/sim";
import { SAVE_CODEC, newGame } from "../../src/sim/state";
import { kitingScript, nonFinite } from "./helpers";

const SOAK = process.env.SOAK === "1";
const TICKS = 20 * 60 * 30; // 30 minutes of game time at 20 Hz

describe.skipIf(!SOAK)("soak", () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: 30 game-minutes stay bounded, finite and fast`, () => {
      const s = newGame(seed);
      s.hero.hp = 1e9; // survive the whole soak; we are testing the world
      const sim = new Sim(s);
      const script = kitingScript(TICKS);
      let worstChunkMicros = 0;
      for (let chunk = 0; chunk < 60; chunk++) {
        const t0 = performance.now();
        for (let i = 0; i < TICKS / 60; i++) {
          for (const cmd of script[s.tick] ?? []) sim.command(cmd);
          sim.step();
        }
        const perStep = ((performance.now() - t0) * 1000) / (TICKS / 60);
        worstChunkMicros = Math.max(worstChunkMicros, perStep);
        expect(s.enemies.length).toBeLessThanOrEqual(WORLD.maxEnemies);
        expect(s.log.length).toBeLessThanOrEqual(WORLD.maxLog);
      }
      expect(nonFinite(s)).toEqual([]);
      expect(encodeSave(SAVE_CODEC, s).length).toBeLessThan(config.budgets.saveBytes);
      expect(worstChunkMicros).toBeLessThan(config.budgets.stepMicros);
      console.log(`seed ${seed}: kills ${s.kills}, worst ${worstChunkMicros.toFixed(1)} us/step, hash ${hashState(s)}`);
    });
  }
});
