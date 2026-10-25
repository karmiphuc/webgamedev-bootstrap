// Shared test drivers. A "script" is a deterministic list of player inputs
// keyed by tick, so a run can be replayed exactly.

import { Sim, type Command } from "../../src/sim/sim";
import { newGame, type GameState } from "../../src/sim/state";

export type Script = Record<number, Command[]>;

/** A simple kiting player: walks between the four quadrants every 3 s. */
export function kitingScript(ticks: number): Script {
  const spots = [
    [5, 3],
    [15, 3],
    [15, 9],
    [5, 9],
  ];
  const script: Script = {};
  for (let t = 0; t < ticks; t += 60) {
    const [x, y] = spots[(t / 60) % spots.length];
    script[t] = [{ type: "move", x, y }];
  }
  return script;
}

export function run(state: GameState, ticks: number, script: Script = {}): Sim {
  const sim = new Sim(state);
  for (let i = 0; i < ticks; i++) {
    for (const cmd of script[state.tick] ?? []) {
      const problem = sim.command(cmd);
      if (problem) throw new Error(`script command rejected at tick ${state.tick}: ${problem}`);
    }
    sim.step();
  }
  return sim;
}

export function fresh(seed: number): GameState {
  return newGame(seed);
}

/** Every number in the state is finite (catches NaN/Infinity early). */
export function nonFinite(value: unknown, path = "state"): string[] {
  if (typeof value === "number") return Number.isFinite(value) ? [] : [`${path}=${value}`];
  if (Array.isArray(value)) return value.flatMap((v, i) => nonFinite(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => nonFinite(v, `${path}.${k}`));
  return [];
}
