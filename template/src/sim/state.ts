// Game state: plain JSON, saved as-is. Renderers and UI READ it; only the
// simulation (sim.ts) WRITES it. No classes, Maps, Sets, functions or DOM
// nodes in here: it must survive JSON.stringify -> JSON.parse unchanged.

import { makeRng, normalizeSeed, seedToCode, type RngState } from "../core/rng";
import type { Migration, SaveCodec } from "../core/save";
import { UNITS, WORLD, type UnitId } from "../content/units";
import config from "../../game.config.json" with { type: "json" };

export const SCHEMA = 2;
export const GAME_ID = config.slug;

export interface Actor {
  id: number;
  kind: UnitId;
  x: number;
  y: number;
  hp: number;
  /** Ticks until the next attack is allowed. */
  cd: number;
  /** Move target in tiles, or null when idle. */
  tx: number | null;
  ty: number | null;
  /** 1 = facing right, -1 = facing left. Changes only on horizontal movement. */
  facing: 1 | -1;
}

export interface GameState {
  schema: number;
  rng: RngState;
  worldCode: string;
  tick: number;
  nextId: number;
  phase: "play" | "defeat";
  hero: Actor;
  enemies: Actor[];
  gold: number;
  kills: number;
  log: { tick: number; text: string }[];
}

export function makeActor(id: number, kind: UnitId, x: number, y: number): Actor {
  return { id, kind, x, y, hp: UNITS[kind].hp, cd: 0, tx: null, ty: null, facing: 1 };
}

export function newGame(worldSeed: number): GameState {
  const seed = normalizeSeed(worldSeed);
  const rng: RngState = { seed };
  // Burn one value so seed 0 and seed 1 diverge immediately.
  makeRng(rng).next();
  return {
    schema: SCHEMA,
    rng,
    worldCode: seedToCode(seed),
    tick: 0,
    nextId: 2,
    phase: "play",
    hero: makeActor(1, "hero", WORLD.width / 2, WORLD.height / 2),
    enemies: [],
    gold: 0,
    kills: 0,
    log: [],
  };
}

// ---- save validation & migrations -------------------------------------

const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);

function actorProblems(a: unknown, where: string): string[] {
  if (!a || typeof a !== "object") return [`${where} is not an object`];
  const o = a as Record<string, unknown>;
  const out: string[] = [];
  if (!Number.isInteger(o.id)) out.push(`${where}.id`);
  if (typeof o.kind !== "string" || !(o.kind in UNITS)) out.push(`${where}.kind "${String(o.kind)}"`);
  for (const k of ["x", "y", "hp", "cd"]) if (!finite(o[k])) out.push(`${where}.${k}`);
  for (const k of ["tx", "ty"]) if (o[k] !== null && !finite(o[k])) out.push(`${where}.${k}`);
  if (o.facing !== 1 && o.facing !== -1) out.push(`${where}.facing`);
  return out;
}

export function validateState(state: unknown): string[] {
  if (!state || typeof state !== "object") return ["state is not an object"];
  const s = state as Record<string, unknown>;
  const out: string[] = [];
  if (s.schema !== SCHEMA) out.push(`schema ${String(s.schema)} != ${SCHEMA}`);
  for (const k of ["tick", "nextId", "gold", "kills"]) if (!Number.isInteger(s[k]) || (s[k] as number) < 0) out.push(k);
  if (!s.rng || !Number.isInteger((s.rng as RngState).seed)) out.push("rng.seed");
  if (s.phase !== "play" && s.phase !== "defeat") out.push("phase");
  out.push(...actorProblems(s.hero, "hero"));
  if (!Array.isArray(s.enemies)) out.push("enemies");
  else {
    if (s.enemies.length > WORLD.maxEnemies) out.push(`enemies over cap (${s.enemies.length})`);
    s.enemies.forEach((e, i) => out.push(...actorProblems(e, `enemies[${i}]`)));
  }
  if (!Array.isArray(s.log) || s.log.length > WORLD.maxLog) out.push("log");
  return out;
}

/**
 * migrations[n] upgrades schema n -> n+1. Each step must only read fields
 * that existed in schema n. Example kept as a worked reference:
 * schema 1 had no `kills` counter.
 */
export const MIGRATIONS: Record<number, Migration> = {
  1: (s) => ({ ...s, schema: 2, kills: typeof s.kills === "number" ? s.kills : 0 }),
};

export const SAVE_CODEC: SaveCodec<GameState> = {
  game: GAME_ID,
  schema: SCHEMA,
  migrations: MIGRATIONS,
  validate: validateState,
  maxBytes: 512 * 1024,
};
