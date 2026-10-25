// Content validator: fail fast on broken data rows instead of discovering
// them as invisible sprites or NaN damage in the browser.
// Add a rule whenever a content bug slips through once.

import { UNITS, WAVES, WORLD, type UnitDef } from "./units";

export interface AtlasFrames {
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

export function validateContent(atlas?: AtlasFrames): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const positive = (row: UnitDef, key: keyof UnitDef) => {
    const v = row[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) err(`unit ${row.id}.${key} must be > 0 (got ${v})`);
  };

  for (const [key, row] of Object.entries(UNITS) as [string, UnitDef][]) {
    if (row.id !== key) err(`unit key "${key}" does not match id "${row.id}"`);
    for (const k of ["hp", "speed", "damage", "range", "cooldown"] as const) positive(row, k);
    if (!Number.isInteger(row.cooldown)) err(`unit ${row.id}.cooldown must be whole ticks`);
    if (row.reward < 0) err(`unit ${row.id}.reward must be >= 0`);
    if (atlas && !atlas.frames[row.sprite]) err(`unit ${row.id} uses missing sprite frame "${row.sprite}"`);
  }

  let lastFrom = -1;
  for (const [i, wave] of WAVES.entries()) {
    if (wave.fromTick < lastFrom) err(`wave ${i} starts before the previous wave`);
    lastFrom = wave.fromTick;
    if (wave.every < 1 || !Number.isInteger(wave.every)) err(`wave ${i}.every must be a whole number >= 1`);
    if (!wave.pool.length) err(`wave ${i} has an empty pool`);
    for (const id of wave.pool) {
      if (!(id in UNITS)) err(`wave ${i} references unknown unit "${id}"`);
      if (id === "hero") err(`wave ${i} spawns the hero`);
    }
  }
  if (WORLD.maxEnemies < 1) err("WORLD.maxEnemies must be >= 1");
  return errors;
}
