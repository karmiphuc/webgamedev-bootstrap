// LOCKED (see docs/CHARTER.md). Saves never break:
// - every old-schema fixture in tests/fixtures/ migrates and keeps playing
// - every older schema has at least one fixture
// - the save SHAPE cannot change without a SCHEMA bump (shape guard)
// - storage failures and corrupted saves never lose the game
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../game.config.json" with { type: "json" };
import { MemoryStore, SaveSlot, decodeSave, encodeSave } from "../../src/core/save";
import { SAVE_CODEC, SCHEMA, createGame, invariants, play, type GameState } from "../../src/sim/testkit";
import { merge, shapeOf } from "./shape";

const FIXTURES = new URL("../fixtures/", import.meta.url);
const SIGNATURE = new URL("../fixtures/schema-signature.json", import.meta.url);

function currentSignature() {
  let sig = shapeOf(createGame(1));
  for (const seed of [1, 2]) {
    const s = createGame(seed);
    for (let i = 0; i < 4; i++) {
      play(s, 500);
      sig = merge(sig, shapeOf(s));
    }
  }
  return sig;
}

describe("locked: saves", () => {
  const fixtures = readdirSync(FIXTURES).filter((f) => /^schema\d+-.+\.json$/.test(f));

  it("has an old-save fixture for every older schema", () => {
    const covered = new Set(fixtures.map((f) => Number(/^schema(\d+)-/.exec(f)![1])));
    const missing = [];
    for (let v = 1; v < SCHEMA; v++) if (!covered.has(v)) missing.push(v);
    expect(missing, "export a save before bumping SCHEMA and commit it as tests/fixtures/schema<N>-<what>.json").toEqual([]);
  });

  for (const file of fixtures) {
    it(`fixture ${file} migrates to the current schema and keeps playing`, () => {
      const env = JSON.parse(readFileSync(new URL(file, FIXTURES), "utf8"));
      env.game = SAVE_CODEC.game; // the project slug may have been renamed since
      const s = decodeSave(SAVE_CODEC, JSON.stringify(env));
      expect(s.schema).toBe(SCHEMA);
      play(s, 200);
      expect(invariants(s)).toEqual([]);
    });
  }

  it("save shape changes only together with a SCHEMA bump (shape guard)", () => {
    const sig = currentSignature();
    const accept = process.env.ACCEPT_SCHEMA === "1";
    const recorded = existsSync(SIGNATURE) ? JSON.parse(readFileSync(SIGNATURE, "utf8")) : null;
    if (!recorded || (accept && SCHEMA > recorded.schema)) {
      if (!accept) throw new Error("no recorded save shape: run `npm run schema:accept`");
      writeFileSync(SIGNATURE, JSON.stringify({ schema: SCHEMA, signature: sig }, null, 2) + "\n");
      return;
    }
    expect(SCHEMA, "SCHEMA went backwards").toBeGreaterThanOrEqual(recorded.schema);
    if (SCHEMA > recorded.schema) {
      throw new Error(`SCHEMA is now ${SCHEMA}: after adding the migration and fixture, run \`npm run schema:accept\``);
    }
    expect(
      JSON.stringify(sig),
      "The saved state's shape changed but SCHEMA did not. Bump SCHEMA in src/sim/state.ts, add MIGRATIONS[old], " +
        "commit an exported old save in tests/fixtures/, then run `npm run schema:accept`.",
    ).toBe(JSON.stringify(recorded.signature));
  });

  it("rejects saves from other games, newer schemas, garbage, invalid state and oversize files", () => {
    const good = encodeSave(SAVE_CODEC, createGame(1));
    const env = JSON.parse(good);
    expect(() => decodeSave(SAVE_CODEC, JSON.stringify({ ...env, game: `${env.game}-other` }))).toThrow(/different game/);
    expect(() => decodeSave(SAVE_CODEC, JSON.stringify({ ...env, schema: SCHEMA + 1 }))).toThrow(/newer/);
    expect(() => decodeSave(SAVE_CODEC, "{not json")).toThrow(/not valid JSON/);
    expect(() => decodeSave(SAVE_CODEC, JSON.stringify({ ...env, state: {} }))).toThrow(/validation/);
    expect(() => decodeSave(SAVE_CODEC, "x".repeat(SAVE_CODEC.maxBytes + 1))).toThrow(/too large/);
  });

  it("a failing storage write keeps the game and the previous save", () => {
    const store = new MemoryStore();
    const slot = new SaveSlot<GameState>(SAVE_CODEC, store);
    const s = createGame(2);
    expect(slot.write(s)).toBeNull();
    const firstTick = s.tick;
    play(s, 50);
    store.failWrites = true;
    expect(slot.write(s)).toMatch(/could not write save/);
    store.failWrites = false;
    expect(slot.read().state?.tick).toBe(firstTick);
  });

  it("falls back to the backup when the main save is corrupted", () => {
    const store = new MemoryStore();
    const slot = new SaveSlot<GameState>(SAVE_CODEC, store);
    const s = createGame(3);
    slot.write(s);
    const firstTick = s.tick;
    play(s, 20);
    slot.write(s);
    store.setItem(`${SAVE_CODEC.game}:save`, "{broken");
    const loaded = slot.read();
    expect(loaded.usedBackup).toBe(true);
    expect(loaded.state?.tick).toBe(firstTick);
  });

  it("a long played session stays inside the save budget", () => {
    const s = createGame(11);
    play(s, 6000);
    expect(encodeSave(SAVE_CODEC, s).length).toBeLessThan(config.budgets.saveBytes);
  });
});
