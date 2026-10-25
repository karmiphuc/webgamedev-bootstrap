// Phaser 3 renderer (preset "phaser").
//
// Phaser runs its own requestAnimationFrame render loop. Our FixedLoop stays
// the authority over simulation time: draw() only moves display objects to
// match the state; Phaser paints them on its next frame. Phaser never owns
// game rules, health or positions.
//
// Lifetime: one Phaser.Game per renderer; dispose() destroys it (textures,
// scene, canvas, input listeners). Sprites are pooled per actor id and
// released when the actor leaves the state.

import Phaser from "phaser";
import { UNITS, WORLD } from "../content/units";
import type { Actor } from "../sim/state";
import { lerp, type CreateRenderer, type Renderer } from "./types";

export const createRenderer: CreateRenderer = async (host, assets) => {
  const T = assets.atlas.tile;
  const width = WORLD.width * T;
  const height = WORLD.height * T;
  let scene!: Phaser.Scene;

  const game = await new Promise<Phaser.Game>((resolve, reject) => {
    const g = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width,
      height,
      pixelArt: true, // nearest-neighbour sampling, rounded pixels
      backgroundColor: "#12101a",
      banner: false,
      audio: { noAudio: true }, // sound is handled by src/app/audio.ts
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: {
        preload(this: Phaser.Scene) {
          this.load.image("atlas", assets.atlasUrl);
          this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error("atlas failed to load")));
        },
        create(this: Phaser.Scene) {
          scene = this;
          const tex = this.textures.get("atlas");
          for (const [name, f] of Object.entries(assets.atlas.frames)) tex.add(name, 0, f.x, f.y, f.w, f.h);
          this.add.tileSprite(0, 0, width, height, "atlas", "grass").setOrigin(0, 0);
          resolve(g);
        },
      },
    });
  });

  game.canvas.classList.add("stage-canvas");
  game.canvas.setAttribute("aria-label", "Game view");
  const sprites = new Map<number, Phaser.GameObjects.Sprite>();
  const bars = scene.add.graphics().setDepth(10_000);
  const flashes = new Map<number, number>();

  const renderer: Renderer = {
    kind: "phaser",
    draw(view) {
      const { state, prev, alpha } = view;
      for (const ev of view.events) if (ev.type === "hit") flashes.set(ev.to, 3);
      const actors: Actor[] = [...state.enemies, state.hero];
      const alive = new Set<number>();
      bars.clear();
      for (const a of actors) {
        alive.add(a.id);
        const def = UNITS[a.kind];
        let s = sprites.get(a.id);
        if (!s) {
          s = scene.add.sprite(0, 0, "atlas", def.sprite).setOrigin(0.5, 1);
          sprites.set(a.id, s);
        }
        const p = prev.get(a.id) ?? a;
        const x = Math.round(lerp(p.x, a.x, alpha) * T);
        const y = Math.round(lerp(p.y, a.y, alpha) * T + 2);
        s.setPosition(x, y).setFlipX(a.facing < 0).setDepth(y + a.id / 1e6);
        s.setAlpha((flashes.get(a.id) ?? 0) > 0 ? 0.55 : 1);
        if (a.hp < def.hp) {
          const frac = a.hp / def.hp;
          bars.fillStyle(0x181425).fillRect(x - 7, y - T - 2, 14, 3);
          bars.fillStyle(frac > 0.5 ? 0x63c74d : frac > 0.25 ? 0xfeae34 : 0xe43b44).fillRect(x - 6, y - T - 1, Math.round(12 * frac), 1);
        }
      }
      for (const [id, s] of sprites) {
        if (!alive.has(id)) {
          s.destroy();
          sprites.delete(id);
        }
      }
      for (const [id, n] of flashes) {
        if (n <= 1) flashes.delete(id);
        else flashes.set(id, n - 1);
      }
    },
    pick(clientX, clientY) {
      const r = game.canvas.getBoundingClientRect();
      if (clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return null;
      return { x: ((clientX - r.left) / r.width) * WORLD.width, y: ((clientY - r.top) / r.height) * WORLD.height };
    },
    toScreen(x, y) {
      const r = game.canvas.getBoundingClientRect();
      return { x: r.left + (x / WORLD.width) * r.width, y: r.top + (y / WORLD.height) * r.height };
    },
    resize() {
      game.scale.refresh();
    },
    diagnostics: () => ({
      renderer: "phaser",
      phaserRenderer: game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas",
      sprites: sprites.size,
      textures: game.textures.getTextureKeys().length,
      backingWidth: game.canvas.width,
      backingHeight: game.canvas.height,
    }),
    dispose() {
      sprites.clear();
      flashes.clear();
      game.destroy(true);
    },
  };
  return renderer;
};
