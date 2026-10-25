import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateContent } from "../../src/content/validate";
import { MemoryStore, SaveSlot, decodeSave, encodeSave } from "../../src/core/save";
import { SAVE_CODEC, newGame, type GameState } from "../../src/sim/state";
import { run } from "./helpers";

const atlas = JSON.parse(readFileSync(new URL("../../public/assets/sprites/atlas.json", import.meta.url), "utf8"));

describe("content", () => {
  it("has no data errors and every sprite exists in the atlas", () => {
    expect(validateContent(atlas)).toEqual([]);
  });
});

describe("saves", () => {
  it("migrates a schema-1 save (fixture) to the current schema", () => {
    // Fixtures are REAL saves exported from older builds. Keep every one:
    // tests/fixtures/<schema>-<what>.json. This one is the schema-1 shape.
    const v1 = JSON.parse(readFileSync(new URL("../fixtures/schema1-new-game.json", import.meta.url), "utf8"));
    v1.game = SAVE_CODEC.game; // the project slug may have been renamed since
    const s = decodeSave(SAVE_CODEC, JSON.stringify(v1));
    expect(s.schema).toBe(SAVE_CODEC.schema);
    expect(s.kills).toBe(0);
    run(s, 100); // a migrated save must keep playing
  });

  it("rejects saves from other games, newer schemas, garbage and oversize files", () => {
    const good = encodeSave(SAVE_CODEC, newGame(1));
    expect(() => decodeSave(SAVE_CODEC, good.replace(SAVE_CODEC.game, "other-game"))).toThrow(/different game/);
    expect(() => decodeSave(SAVE_CODEC, good.replace(/"schema":\d+/, '"schema":999'))).toThrow(/newer/);
    expect(() => decodeSave(SAVE_CODEC, "{not json")).toThrow(/not valid JSON/);
    expect(() => decodeSave(SAVE_CODEC, "x".repeat(SAVE_CODEC.maxBytes + 1))).toThrow(/too large/);
    const tampered = JSON.parse(good);
    tampered.state.hero.hp = "lots";
    expect(() => decodeSave(SAVE_CODEC, JSON.stringify(tampered))).toThrow(/validation/);
  });

  it("a failing storage write keeps the game and the previous save", () => {
    const store = new MemoryStore();
    const slot = new SaveSlot<GameState>(SAVE_CODEC, store);
    const s = newGame(2);
    expect(slot.write(s)).toBeNull();
    run(s, 50);
    store.failWrites = true;
    expect(slot.write(s)).toMatch(/could not write save/);
    store.failWrites = false;
    expect(slot.read().state?.tick).toBe(0);
  });

  it("falls back to the backup when the main save is corrupted", () => {
    const store = new MemoryStore();
    const slot = new SaveSlot<GameState>(SAVE_CODEC, store);
    const s = newGame(3);
    slot.write(s);
    run(s, 20);
    slot.write(s);
    store.setItem(`${SAVE_CODEC.game}:save`, "{broken");
    const loaded = slot.read();
    expect(loaded.usedBackup).toBe(true);
    expect(loaded.state?.tick).toBe(0);
  });

  it("a long run stays inside the save budget", () => {
    const s = newGame(11);
    s.hero.hp = 1e6;
    run(s, 6000);
    expect(encodeSave(SAVE_CODEC, s).length).toBeLessThan(SAVE_CODEC.maxBytes / 4);
  });
});
