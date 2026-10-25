// Canvas 2D pixel-art renderer.
//
// Pixel rules (enforced by tests/e2e/pixels.spec.ts):
// - imageSmoothingEnabled is always false.
// - The world is drawn at an INTEGER scale of device pixels.
// - Sprite positions snap to whole source pixels (no sub-pixel shimmer).
// - Sprites are mirrored, never rotated or fractionally scaled.

import { UNITS, WORLD } from "../content/units";
import type { Actor } from "../sim/state";
import { lerp, type CreateRenderer, type RenderView, type Renderer } from "./types";

export const createRenderer: CreateRenderer = async (host, assets) => {
  const image = new Image();
  image.src = assets.atlasUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.className = "stage-canvas";
  canvas.setAttribute("aria-label", "Game view");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D is not available");

  const T = assets.atlas.tile;
  const frames = assets.atlas.frames;
  let scale = 1;
  const flashes = new Map<number, number>();

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = host.clientWidth * dpr;
    const h = host.clientHeight * dpr;
    scale = Math.max(1, Math.floor(Math.min(w / (WORLD.width * T), h / (WORLD.height * T))));
    canvas.width = WORLD.width * T * scale;
    canvas.height = WORLD.height * T * scale;
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    ctx.imageSmoothingEnabled = false;
  };
  resize();
  // Re-fit whenever the stage changes size (HUD wraps, rotation, panels).
  const observer = new ResizeObserver(() => resize());
  observer.observe(host);

  const sprite = (name: string, wx: number, wy: number, flip: boolean) => {
    const f = frames[name];
    if (!f) return;
    // Snap to whole source pixels, then multiply by the integer scale.
    const px = Math.round(wx * T - f.w / 2) * scale;
    const py = Math.round(wy * T - f.h + 2) * scale;
    if (flip) {
      ctx.save();
      ctx.translate(px + f.w * scale, py);
      ctx.scale(-1, 1);
      ctx.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, f.w * scale, f.h * scale);
      ctx.restore();
    } else {
      ctx.drawImage(image, f.x, f.y, f.w, f.h, px, py, f.w * scale, f.h * scale);
    }
  };

  const bar = (wx: number, wy: number, frac: number) => {
    const w = 12;
    const x = Math.round(wx * T - w / 2) * scale;
    const y = Math.round(wy * T - T - 1) * scale;
    ctx.fillStyle = "#181425";
    ctx.fillRect(x - scale, y - scale, (w + 2) * scale, 3 * scale);
    ctx.fillStyle = frac > 0.5 ? "#63c74d" : frac > 0.25 ? "#feae34" : "#e43b44";
    ctx.fillRect(x, y, Math.max(0, Math.round(w * frac)) * scale, scale);
  };

  const renderer: Renderer = {
    kind: "canvas",
    draw(view: RenderView) {
      const { state, prev, alpha } = view;
      for (const ev of view.events) if (ev.type === "hit") flashes.set(ev.to, 3);

      for (let ty = 0; ty < WORLD.height; ty++)
        for (let tx = 0; tx < WORLD.width; tx++) {
          const f = frames.grass;
          ctx.drawImage(image, f.x, f.y, f.w, f.h, tx * T * scale, ty * T * scale, T * scale, T * scale);
        }

      const actors: Actor[] = [...state.enemies, state.hero];
      // Painter's order: lower on screen draws later; ties by id (stable).
      const pos = actors.map((a) => {
        const p = prev.get(a.id) ?? a;
        return { a, x: lerp(p.x, a.x, alpha), y: lerp(p.y, a.y, alpha) };
      });
      pos.sort((p, q) => p.y - q.y || p.a.id - q.a.id);
      for (const { a, x, y } of pos) {
        const def = UNITS[a.kind];
        const flash = (flashes.get(a.id) ?? 0) > 0;
        if (flash) ctx.globalAlpha = 0.55;
        sprite(def.sprite, x, y, a.facing < 0);
        ctx.globalAlpha = 1;
        if (a.hp < def.hp) bar(x, y, a.hp / def.hp);
      }
      for (const [id, n] of flashes) {
        if (n <= 1) flashes.delete(id);
        else flashes.set(id, n - 1);
      }
    },
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      if (clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return null;
      return {
        x: ((clientX - r.left) / r.width) * WORLD.width,
        y: ((clientY - r.top) / r.height) * WORLD.height,
      };
    },
    toScreen(x, y) {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (x / WORLD.width) * r.width, y: r.top + (y / WORLD.height) * r.height };
    },
    resize,
    diagnostics: () => ({
      renderer: "canvas",
      scale,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      smoothing: ctx.imageSmoothingEnabled,
      flashes: flashes.size,
    }),
    dispose() {
      observer.disconnect();
      flashes.clear();
      canvas.remove();
    },
  };
  return renderer;
};
