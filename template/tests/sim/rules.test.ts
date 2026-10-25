// Focused rule tests: set up a tiny situation directly, step, assert.
// Test behaviour the player would notice, not implementation details.

import { describe, expect, it } from "vitest";
import { UNITS, WORLD } from "../../src/content/units";
import { Sim } from "../../src/sim/sim";
import { makeActor } from "../../src/sim/state";
import { fresh, run } from "./helpers";

describe("combat rules", () => {
  it("a kill pays the reward exactly once", () => {
    const s = fresh(3);
    const sim = new Sim(s);
    const slime = makeActor(s.nextId++, "slime", s.hero.x + 1, s.hero.y);
    slime.hp = 1;
    s.enemies.push(slime);
    const events = sim.step();
    expect(events.filter((e) => e.type === "death")).toHaveLength(1);
    expect(s.gold).toBe(UNITS.slime.reward);
    expect(s.kills).toBe(1);
    sim.step();
    expect(s.gold).toBe(UNITS.slime.reward);
  });

  it("the hero is defeated at 0 hp and the world stops", () => {
    const s = fresh(4);
    s.hero.hp = 1;
    // A slime survives the hero's first strike (the hero attacks first in a tick).
    const slime = makeActor(s.nextId++, "slime", s.hero.x + 0.5, s.hero.y);
    s.enemies.push(slime);
    const sim = new Sim(s);
    sim.step();
    expect(s.phase).toBe("defeat");
    expect(s.hero.hp).toBe(0);
    const tick = s.tick;
    sim.step();
    expect(s.tick).toBe(tick);
  });

  it("never exceeds the enemy cap, even with an idle hero for a long time", () => {
    const s = fresh(5);
    s.hero.hp = 1e6;
    run(s, 4000);
    expect(s.enemies.length).toBeLessThanOrEqual(WORLD.maxEnemies);
  });
});

describe("commands and movement", () => {
  it("rejects invalid commands without changing state", () => {
    const s = fresh(6);
    const sim = new Sim(s);
    expect(sim.command({ type: "move", x: NaN, y: 1 })).toMatch(/not a number/);
    expect(sim.command({ type: "move", x: -5, y: 1 })).toMatch(/outside/);
    sim.step();
    expect(s.hero.tx).toBeNull();
  });

  it("walks to the target, stops there and keeps facing on vertical moves", () => {
    const s = fresh(8);
    s.hero.hp = 1e6;
    const sim = new Sim(s);
    sim.command({ type: "move", x: 4, y: s.hero.y });
    sim.step(); // commands apply on the next tick
    for (let i = 0; i < 200 && s.hero.tx !== null; i++) sim.step();
    expect(s.hero.x).toBeCloseTo(4, 5);
    expect(s.hero.facing).toBe(-1);
    sim.command({ type: "move", x: 4, y: 1 });
    sim.step();
    for (let i = 0; i < 200 && s.hero.tx !== null; i++) sim.step();
    expect(s.hero.y).toBeCloseTo(1, 5);
    expect(s.hero.facing).toBe(-1);
  });
});
