// The simulation. Pure game rules: no DOM, no canvas, no engine imports,
// no Date.now / performance.now / Math.random. It runs identically in the
// browser, in Node tests and in headless bots.
//
// Input arrives as validated Commands; output is the mutated state plus a
// list of transient StepEvents (for sound/effects; never saved).

import { makeRng, type Rng } from "../core/rng";
import { UNITS, WAVES, WORLD } from "../content/units";
import { makeActor, type Actor, type GameState } from "./state";

export const TICK_HZ = 20;

export type Command = { type: "move"; x: number; y: number } | { type: "stop" };

export type StepEvent =
  | { type: "spawn"; id: number; kind: string }
  | { type: "hit"; from: number; to: number; damage: number }
  | { type: "death"; id: number; kind: string }
  | { type: "defeat" };

/** Returns an error string for an invalid command, or null. */
export function checkCommand(cmd: Command): string | null {
  if (cmd.type === "move") {
    if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return "move target is not a number";
    if (cmd.x < 0 || cmd.y < 0 || cmd.x > WORLD.width || cmd.y > WORLD.height) return "move target is outside the map";
    return null;
  }
  if (cmd.type === "stop") return null;
  return "unknown command";
}

export class Sim {
  private readonly rng: Rng;
  private queue: Command[] = [];
  events: StepEvent[] = [];

  constructor(readonly state: GameState) {
    this.rng = makeRng(state.rng);
  }

  /** Queue a command for the next tick. Returns an error string or null. */
  command(cmd: Command): string | null {
    const problem = checkCommand(cmd);
    if (problem) return problem;
    if (this.queue.length >= 64) return "too many queued commands";
    this.queue.push(cmd);
    return null;
  }

  step(): StepEvent[] {
    const s = this.state;
    this.events = [];
    if (s.phase !== "play") {
      this.queue.length = 0;
      return this.events;
    }
    this.applyCommands();
    this.spawn();
    this.move(s.hero, s.hero.tx, s.hero.ty, 0);
    for (const e of s.enemies) this.move(e, s.hero.x, s.hero.y, UNITS[e.kind].range * 0.9);
    this.combat();
    s.tick++;
    return this.events;
  }

  private applyCommands() {
    const hero = this.state.hero;
    for (const cmd of this.queue) {
      if (cmd.type === "move") {
        hero.tx = cmd.x;
        hero.ty = cmd.y;
      } else {
        hero.tx = hero.ty = null;
      }
    }
    this.queue.length = 0;
  }

  private spawn() {
    const s = this.state;
    let wave = null;
    for (const w of WAVES) if (s.tick >= w.fromTick) wave = w;
    if (!wave || s.tick % wave.every !== 0 || s.enemies.length >= WORLD.maxEnemies) return;
    const kind = this.rng.pick(wave.pool);
    const edge = this.rng.int(0, 3);
    const x = edge === 0 ? 0 : edge === 1 ? WORLD.width : this.rng.range(0, WORLD.width);
    const y = edge === 2 ? 0 : edge === 3 ? WORLD.height : this.rng.range(0, WORLD.height);
    const actor = makeActor(s.nextId++, kind, x, y);
    s.enemies.push(actor);
    this.events.push({ type: "spawn", id: actor.id, kind });
  }

  private move(a: Actor, tx: number | null, ty: number | null, stopAt: number) {
    if (tx === null || ty === null) return;
    const dx = tx - a.x;
    const dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = UNITS[a.kind].speed / TICK_HZ;
    if (dist <= stopAt + 1e-6) {
      if (a === this.state.hero) a.tx = a.ty = null;
      return;
    }
    const travel = Math.min(stepLen, dist - stopAt);
    a.x += (dx / dist) * travel;
    a.y += (dy / dist) * travel;
    // Facing follows horizontal movement only; vertical moves keep facing.
    if (Math.abs(dx) > 1e-3) a.facing = dx > 0 ? 1 : -1;
    if (a === this.state.hero && dist - travel <= 1e-6) a.tx = a.ty = null;
  }

  private combat() {
    const s = this.state;
    const hero = s.hero;
    const heroDef = UNITS.hero;
    if (hero.cd > 0) hero.cd--;
    for (const e of s.enemies) if (e.cd > 0) e.cd--;

    // Hero auto-attacks the nearest enemy in range (ties broken by lowest id).
    if (hero.cd === 0) {
      let best: Actor | null = null;
      let bestD = Infinity;
      for (const e of s.enemies) {
        const d = Math.hypot(e.x - hero.x, e.y - hero.y);
        if (d <= heroDef.range && (d < bestD || (d === bestD && best && e.id < best.id))) {
          best = e;
          bestD = d;
        }
      }
      if (best) {
        best.hp -= heroDef.damage;
        hero.cd = heroDef.cooldown;
        this.events.push({ type: "hit", from: hero.id, to: best.id, damage: heroDef.damage });
      }
    }

    for (const e of s.enemies) {
      const def = UNITS[e.kind];
      if (e.hp > 0 && e.cd === 0 && Math.hypot(e.x - hero.x, e.y - hero.y) <= def.range) {
        hero.hp -= def.damage;
        e.cd = def.cooldown;
        this.events.push({ type: "hit", from: e.id, to: hero.id, damage: def.damage });
      }
    }

    // Deaths resolve once, after all attacks of this tick.
    const survivors: Actor[] = [];
    for (const e of s.enemies) {
      if (e.hp > 0) {
        survivors.push(e);
        continue;
      }
      s.gold += UNITS[e.kind].reward;
      s.kills++;
      this.events.push({ type: "death", id: e.id, kind: e.kind });
    }
    s.enemies = survivors;

    if (hero.hp <= 0) {
      hero.hp = 0;
      s.phase = "defeat";
      this.log(`Defeated at tick ${s.tick} with ${s.kills} kills`);
      this.events.push({ type: "defeat" });
    }
  }

  private log(text: string) {
    const log = this.state.log;
    log.push({ tick: this.state.tick, text });
    if (log.length > WORLD.maxLog) log.splice(0, log.length - WORLD.maxLog);
  }
}
