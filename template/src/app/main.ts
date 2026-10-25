// Boot, fixed-step loop, input, autosave and the debug/test API.
//
// URL options (stripped from the address bar after boot so a reload never
// repeats them): ?new  fresh game   ?seed=K7F2QX  fresh game in that world
// ?paused  start paused (used by tests and screenshot evidence)

import "../style.css";
import { FixedLoop } from "../core/loop";
import { hashState } from "../core/hash";
import { Lifetime, Samples } from "../core/lifetime";
import { codeToSeed, randomSeed } from "../core/rng";
import { SaveSlot, decodeSave, encodeSave } from "../core/save";
import { validateContent, type AtlasFrames } from "../content/validate";
import { createRenderer } from "../render";
import type { RenderAssets } from "../render/types";
import { Sim, TICK_HZ, type Command, type StepEvent } from "../sim/sim";
import { SAVE_CODEC, newGame, type GameState } from "../sim/state";
import { Hud } from "../ui/hud";
import { Sound } from "./audio";
import { registerOffline } from "./offline";

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

const AUTOSAVE_TICKS = TICK_HZ * 10;

function fatal(message: string): void {
  const box = document.createElement("div");
  box.className = "fatal";
  box.setAttribute("role", "alert");
  box.textContent = message;
  document.body.appendChild(box);
}

async function boot(): Promise<void> {
  const life = new Lifetime();
  const app = document.getElementById("app")!;
  const stage = document.getElementById("stage")!;
  const params = new URLSearchParams(location.search);
  const slot = new SaveSlot<GameState>(SAVE_CODEC, window.localStorage);
  const errors: string[] = [];
  life.listen(window, "error", (e) => errors.push(String(e.message)));
  life.listen(window, "unhandledrejection", (e) => errors.push(String(e.reason)));

  // ---- assets ----
  const atlasRes = await fetch("assets/sprites/atlas.json");
  if (!atlasRes.ok) throw new Error(`could not load sprite atlas (${atlasRes.status})`);
  const atlas = (await atlasRes.json()) as RenderAssets["atlas"];
  const contentErrors = validateContent(atlas as AtlasFrames);
  if (contentErrors.length) throw new Error(`content errors:\n${contentErrors.join("\n")}`);

  // ---- state ----
  const seedParam = params.get("seed");
  const fresh = params.has("new") || seedParam !== null;
  let state: GameState;
  let loadNote: string | null = null;
  if (fresh) {
    const seed = seedParam === null ? randomSeed() : (codeToSeed(seedParam) ?? Number(seedParam) | 0);
    state = newGame(seed);
  } else {
    const loaded = slot.read();
    state = loaded.state ?? newGame(randomSeed());
    if (loaded.error) loadNote = loaded.usedBackup ? `Main save was damaged; restored the backup (${loaded.error})` : `Could not load save: ${loaded.error}`;
  }
  if (params.has("new") || seedParam !== null) {
    params.delete("new");
    params.delete("seed");
    const q = params.toString();
    history.replaceState(null, "", location.pathname + (q ? `?${q}` : "") + location.hash);
  }

  let sim = new Sim(state);
  const prev = new Map<number, { x: number; y: number }>();
  let pendingEvents: StepEvent[] = [];
  const sound = new Sound();
  life.own(() => sound.dispose());
  const frameMs = new Samples();
  const tickUs = new Samples();
  let lastFrame = -1;
  let defeatShown = false;

  const save = () => {
    const problem = slot.write(state);
    if (problem) hud.toast(problem);
    return problem;
  };

  const doStep = () => {
    prev.clear();
    for (const a of [state.hero, ...state.enemies]) prev.set(a.id, { x: a.x, y: a.y });
    const t0 = performance.now();
    const events = sim.step();
    tickUs.add((performance.now() - t0) * 1000);
    if (events.length) pendingEvents = pendingEvents.concat(events).slice(-128);
    if (state.tick % AUTOSAVE_TICKS === 0) save();
  };

  const draw = (alpha: number) => {
    const now = performance.now();
    if (lastFrame >= 0) frameMs.add(now - lastFrame);
    lastFrame = now;
    renderer.draw({ state, prev, alpha, events: pendingEvents });
    sound.play(pendingEvents);
    pendingEvents = [];
    hud.update(state, loop.paused);
    if (state.phase === "defeat" && !defeatShown) {
      defeatShown = true;
      save();
      hud.showDefeat(state);
    }
  };

  const loop = new FixedLoop({ tickHz: TICK_HZ, maxStepsPerFrame: 4, step: doStep, render: draw });
  loop.paused = params.has("paused");

  const replaceGame = (next: GameState) => {
    state = next;
    sim = new Sim(state);
    prev.clear();
    pendingEvents = [];
    defeatShown = false;
    hud.close();
    loop.resetClock();
    save();
  };

  const hud = new Hud(
    app,
    {
      togglePause: () => {
        loop.paused = !loop.paused;
        loop.resetClock();
      },
      toggleSound: () => sound.toggle(),
      newGame: () => replaceGame(newGame(randomSeed())),
      exportSave: () => {
        const blob = new Blob([encodeSave(SAVE_CODEC, state, Date.now())], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${SAVE_CODEC.game}-${state.worldCode}-t${state.tick}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      importSave: async (file) => {
        if (file.size > SAVE_CODEC.maxBytes) return hud.toast("That file is too large to be a save.");
        try {
          replaceGame(decodeSave(SAVE_CODEC, await file.text()));
          hud.toast("Save imported.");
        } catch (err) {
          hud.toast((err as Error).message);
        }
      },
    },
    life,
  );
  if (loadNote) hud.toast(loadNote);

  // Create the renderer AFTER the HUD exists, so the stage already has its
  // final size when an engine measures it.
  const renderer = await createRenderer(stage, { atlas, atlasUrl: `assets/sprites/${atlas.image}` });
  life.own(() => renderer.dispose());

  // ---- input: pointer -> validated command ----
  life.listen(stage, "pointerdown", (e) => {
    const p = renderer.pick(e.clientX, e.clientY);
    if (!p) return;
    const problem = sim.command({ type: "move", x: p.x, y: p.y });
    if (problem) hud.toast(problem);
  });
  life.listen(window, "keydown", (e) => {
    if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      loop.paused = !loop.paused;
      loop.resetClock();
    }
  });
  life.listen(window, "resize", () => renderer.resize());
  life.listen(document, "visibilitychange", () => {
    if (document.hidden) save();
    loop.resetClock();
  });
  life.listen(window, "pagehide", () => save());

  loop.start();
  life.own(() => loop.stop());
  registerOffline((apply) => {
    hud.ask("A new version is ready. Save and reload now?", "Reload", () => {
      save();
      apply();
    });
  });

  // ---- debug / test API (deliberately always on: these are personal games) ----
  const api = {
    version: __APP_VERSION__,
    commit: __APP_COMMIT__,
    ready: true,
    state: () => JSON.parse(JSON.stringify(state)) as GameState,
    hash: () => hashState(state),
    step: (n = 1) => {
      for (let i = 0; i < n; i++) doStep();
      draw(1);
      return hashState(state);
    },
    command: (cmd: Command) => sim.command(cmd),
    pause: (paused = true) => {
      loop.paused = paused;
      loop.resetClock();
    },
    render: () => draw(1),
    /** World tiles -> client pixels (lets tests click on world positions). */
    toScreen: (x: number, y: number) => renderer.toScreen(x, y),
    save,
    clearSave: () => slot.clear(),
    newGame: (seed: number) => replaceGame(newGame(seed)),
    diagnostics: () => ({
      renderer: renderer.diagnostics(),
      frameMs: frameMs.summary(),
      tickMicros: tickUs.summary(),
      loop: { ...loop.stats, paused: loop.paused },
      lifetimeResources: life.count,
      enemies: state.enemies.length,
      errors: [...errors],
    }),
    dispose: () => life.dispose(),
  };
  (window as unknown as { __game: typeof api }).__game = api;
  document.body.dataset.ready = "true";
}

boot().catch((err) => {
  console.error(err);
  fatal(`The game failed to start: ${(err as Error).message}. Reload to retry.`);
});
