// The renderer contract. Every renderer (canvas, phaser, three, ...) reads
// game state and draws it. A renderer NEVER writes game state; input is
// turned into Commands by the app, using pick() to map screen -> world.

import type { AtlasFrames } from "../content/validate";
import type { GameState } from "../sim/state";
import type { StepEvent } from "../sim/sim";

export interface RenderView {
  state: Readonly<GameState>;
  /** Positions at the previous tick, for interpolation. */
  prev: ReadonlyMap<number, { x: number; y: number }>;
  /** 0..1 progress between the previous and current tick. */
  alpha: number;
  /** Events produced since the last draw (hits, deaths) for effects. */
  events: readonly StepEvent[];
}

export interface RenderAssets {
  atlas: AtlasFrames & { image: string; tile: number };
  /** URL of the atlas image, relative to the page. */
  atlasUrl: string;
}

export interface Renderer {
  readonly kind: string;
  draw(view: RenderView): void;
  /** Client (CSS pixel) coordinates -> world tiles, or null when outside. */
  pick(clientX: number, clientY: number): { x: number; y: number } | null;
  /** World tiles -> client (CSS pixel) coordinates. Inverse of pick(). */
  toScreen(x: number, y: number): { x: number; y: number };
  resize(): void;
  /** Numbers the tests and the debug panel can read. */
  diagnostics(): Record<string, number | string | boolean>;
  dispose(): void;
}

export type CreateRenderer = (host: HTMLElement, assets: RenderAssets) => Promise<Renderer>;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
