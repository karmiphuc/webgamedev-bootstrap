// CONTENT IS DATA. New units/enemies/items are new rows here, not new code.
// Every row is checked by validateContent() (tests/sim/content.test.ts and
// `npm run check`). Numbers here are AUTHORED balance values; when cloning a
// reference game, record which values were observed vs. guessed in
// docs/FIDELITY.md.

export interface UnitDef {
  id: string;
  name: string;
  /** Frame name in the sprite atlas (public/assets/sprites/atlas.json). */
  sprite: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  damage: number;
  /** Attack reach in tiles (centre to centre). */
  range: number;
  /** Ticks between attacks. */
  cooldown: number;
  /** Gold given to the player on kill (enemies only). */
  reward: number;
}

export const UNITS = {
  hero: { id: "hero", name: "Hero", sprite: "hero", hp: 60, speed: 4, damage: 6, range: 1.6, cooldown: 8, reward: 0 },
  slime: { id: "slime", name: "Slime", sprite: "slime", hp: 12, speed: 1.4, damage: 3, range: 0.8, cooldown: 12, reward: 2 },
  bat: { id: "bat", name: "Bat", sprite: "bat", hp: 6, speed: 2.6, damage: 2, range: 0.7, cooldown: 10, reward: 3 },
} satisfies Record<string, UnitDef>;

export type UnitId = keyof typeof UNITS;

export interface WaveDef {
  /** First tick at which this wave may spawn. */
  fromTick: number;
  /** Ticks between spawns while active. */
  every: number;
  pool: UnitId[];
}

export const WAVES: WaveDef[] = [
  { fromTick: 0, every: 40, pool: ["slime"] },
  { fromTick: 400, every: 30, pool: ["slime", "bat"] },
  { fromTick: 1200, every: 20, pool: ["slime", "bat", "bat"] },
];

export const WORLD = {
  /** Playfield size in tiles. */
  width: 20,
  height: 12,
  /** Hard cap on live enemies: content may never exceed this. */
  maxEnemies: 24,
  /** Bounded event log kept in state. */
  maxLog: 20,
} as const;
