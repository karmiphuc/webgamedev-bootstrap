// Versioned saves with a migration chain.
//
// Rules:
// - Game state is plain JSON (no classes, Maps, Sets, functions, DOM).
// - Every shape change bumps SCHEMA and adds a migration step from N-1 to N.
// - Migrations run on every load; each one only transforms its own version.
// - Writes keep the previous save as a backup; a failed write never
//   destroys the in-memory game, and the player can still export.
// - Imported saves are untrusted: size-check before parse, validate after.

export interface SaveEnvelope<S> {
  game: string;
  schema: number;
  savedAt: number;
  state: S;
}

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

export interface SaveCodec<S> {
  game: string;
  schema: number;
  /** migrations[n] upgrades a schema-n state to schema n+1. */
  migrations: Record<number, Migration>;
  validate: (state: unknown) => string[];
  maxBytes: number;
  /** Type-only marker tying the codec to its state type; never set. */
  readonly __state?: S;
}

export class SaveError extends Error {}

export function encodeSave<S>(codec: SaveCodec<S>, state: S, savedAt = 0): string {
  const env: SaveEnvelope<S> = { game: codec.game, schema: codec.schema, savedAt, state };
  const text = JSON.stringify(env);
  if (text.length > codec.maxBytes) {
    throw new SaveError(`save is ${text.length} bytes, budget ${codec.maxBytes}`);
  }
  return text;
}

export function decodeSave<S>(codec: SaveCodec<S>, text: string): S {
  if (text.length > codec.maxBytes) throw new SaveError("save file is too large");
  let env: SaveEnvelope<Record<string, unknown>>;
  try {
    env = JSON.parse(text);
  } catch {
    throw new SaveError("save file is not valid JSON");
  }
  if (!env || typeof env !== "object" || env.game !== codec.game) {
    throw new SaveError("save file belongs to a different game");
  }
  if (!Number.isInteger(env.schema) || env.schema < 1) throw new SaveError("save has no schema version");
  if (env.schema > codec.schema) throw new SaveError(`save is from a newer version (schema ${env.schema})`);
  let state = env.state;
  for (let v = env.schema; v < codec.schema; v++) {
    const step = codec.migrations[v];
    if (!step) throw new SaveError(`no migration from schema ${v}`);
    state = step(state);
  }
  const problems = codec.validate(state);
  if (problems.length) throw new SaveError(`save failed validation: ${problems.slice(0, 5).join("; ")}`);
  return state as S;
}

/** Minimal storage port so tests can inject failing storage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveSlot<S> {
  constructor(
    private readonly codec: SaveCodec<S>,
    private readonly store: KeyValueStore,
    private readonly key = `${codec.game}:save`,
  ) {}

  /** Returns null on success, or a human-readable error (game keeps running). */
  write(state: S, savedAt = Date.now()): string | null {
    let text: string;
    try {
      text = encodeSave(this.codec, state, savedAt);
    } catch (err) {
      return (err as Error).message;
    }
    try {
      const previous = this.store.getItem(this.key);
      if (previous) this.store.setItem(`${this.key}:backup`, previous);
      this.store.setItem(this.key, text);
      return null;
    } catch (err) {
      return `could not write save (${(err as Error).name}); export your save to keep it`;
    }
  }

  /** Loads the main save, falling back to the backup if the main one is broken. */
  read(): { state: S | null; error: string | null; usedBackup: boolean } {
    let mainError: string | null = null;
    for (const [key, usedBackup] of [
      [this.key, false],
      [`${this.key}:backup`, true],
    ] as const) {
      let text: string | null = null;
      try {
        text = this.store.getItem(key);
      } catch (err) {
        return { state: null, error: `storage unavailable (${(err as Error).name})`, usedBackup: false };
      }
      if (!text) continue;
      try {
        return { state: decodeSave(this.codec, text), error: mainError, usedBackup };
      } catch (err) {
        mainError ??= (err as Error).message;
      }
    }
    return { state: null, error: mainError, usedBackup: false };
  }

  clear(): void {
    try {
      this.store.removeItem(this.key);
      this.store.removeItem(`${this.key}:backup`);
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }
}

export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("quota", "QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
