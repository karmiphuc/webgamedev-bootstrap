// Seeded PRNG (mulberry32). The running state lives inside the game state,
// so saving and loading continues the exact same random sequence.
// The simulation must use ONLY this for randomness. Render/audio may use
// Math.random for cosmetic effects that never touch game state.

export interface RngState {
  seed: number;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function makeRng(state: RngState): Rng {
  const next = () => {
    let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error("rng.pick on empty list");
      return items[Math.floor(next() * items.length)];
    },
  };
}

// Short human-shareable world code <-> numeric seed (e.g. "K7F2QX").
// 6 characters x 5 bits = 30 bits, so world seeds live in [0, 2^30).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SEED_LIMIT = 2 ** 30;
export function normalizeSeed(seed: number): number {
  return (seed >>> 0) % SEED_LIMIT;
}
export function randomSeed(): number {
  return Math.floor(Math.random() * SEED_LIMIT);
}
export function seedToCode(seed: number): string {
  let n = normalizeSeed(seed);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[n % ALPHABET.length];
    n = Math.floor(n / ALPHABET.length);
  }
  return out;
}
export function codeToSeed(code: string): number | null {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(clean)) return null;
  let n = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    const v = ALPHABET.indexOf(clean[i]);
    if (v < 0) return null;
    n = n * ALPHABET.length + v;
  }
  return n >>> 0;
}
