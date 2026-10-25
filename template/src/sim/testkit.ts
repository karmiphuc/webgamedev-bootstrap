// GAME-OWNED adapter used by the LOCKED tests (tests/locked/*, tests/e2e/locked.spec.ts).
//
// The locked tests never import game rules directly; they only use the
// exports below. Rewrite the game however you like, but keep these exports
// and their meaning:
//
//   createGame(seed)      a brand-new game state for a world seed
//   advance(state, n)     run n ticks with NO player input (what the browser's
//                         window.__game.step(n) does on a paused, untouched game)
//   play(state, n)        run n ticks driven by a deterministic scripted player.
//                         Inputs must depend only on the state (e.g. state.tick),
//                         so playing 300 + 300 ticks equals playing 600.
//   invariants(state)     game-specific bounds; return human-readable problems
//   SOAK                  how long and on which seeds the soak runs
//   SAVE_CODEC, SCHEMA    the save format (see src/sim/state.ts)

import { WORLD } from "../content/units";
import { Sim, type Command } from "./sim";
import { SAVE_CODEC, SCHEMA, newGame, validateState, type GameState } from "./state";

export { SAVE_CODEC, SCHEMA };
export type { GameState };

export function createGame(seed: number): GameState {
  return newGame(seed);
}

export function advance(state: GameState, ticks: number): void {
  const sim = new Sim(state);
  for (let i = 0; i < ticks; i++) sim.step();
}

// Walks between the four quadrants every 3 s.
const SPOTS = [
  [5, 3],
  [15, 3],
  [15, 9],
  [5, 9],
] as const;
function scriptedInput(tick: number): Command | null {
  if (tick % 60 !== 0) return null;
  const [x, y] = SPOTS[(tick / 60) % SPOTS.length];
  return { type: "move", x, y };
}

export function play(state: GameState, ticks: number): void {
  const sim = new Sim(state);
  for (let i = 0; i < ticks; i++) {
    const cmd = scriptedInput(state.tick);
    if (cmd) {
      const problem = sim.command(cmd);
      if (problem) throw new Error(`scripted input rejected at tick ${state.tick}: ${problem}`);
    }
    sim.step();
  }
}

export function invariants(state: GameState): string[] {
  const out = validateState(state);
  if (state.enemies.length > WORLD.maxEnemies) out.push(`enemies ${state.enemies.length} > cap ${WORLD.maxEnemies}`);
  if (state.log.length > WORLD.maxLog) out.push(`log ${state.log.length} > cap ${WORLD.maxLog}`);
  return out;
}

/** Soak: 30 game-minutes at 20 Hz on three seeds. The hero is made durable
 *  by `prepareSoak` so the soak tests the world, not the player's skill. */
export const SOAK = { seeds: [1, 2, 3], ticks: 20 * 60 * 30 };
export function prepareSoak(state: GameState): void {
  state.hero.hp = 1e9;
}
