# Architecture

```
        input (pointer/keys)                      window.__game (tests, debug)
               │                                          │
               ▼                                          ▼
 src/app/main.ts ── Command ──► src/sim/sim.ts ◄── src/content/*.ts (data)
   │  FixedLoop (20 Hz)          │  mutates GameState (plain JSON)
   │                             │  returns StepEvents (transient)
   │                             ▼
   │                      src/sim/state.ts ── SaveSlot (localStorage, backup, migrations)
   ▼
 src/render/<renderer>.ts  reads state + prev positions + alpha + events → pixels
 src/ui/hud.ts             reads state → DOM (throttled, dirty-checked)
 src/app/audio.ts          reads events → sound (opt-in, capped voices)
```

## Boundaries

| Module | May import | Must never |
| --- | --- | --- |
| `src/core` | nothing project-specific | know about the game |
| `src/content` | core types | import DOM, sim, render |
| `src/sim` | core, content | touch DOM, time, `Math.random`, renderer |
| `src/render` | content, sim *types* | write state |
| `src/ui` | sim *types* | write state (calls app actions) |
| `src/app` | everything | contain game rules |

## Time

The sim advances in fixed ticks (`TICK_HZ` = 20). The loop runs at most 4 catch-up ticks per
frame and drops surplus time after stalls (game time slows instead of freezing). Pause and tab
visibility reset the clock. Renderers interpolate between the previous and current tick with
`alpha`. Effects and sound are driven by `StepEvent`s, never by re-deriving rules.

## Determinism

Same build + same seed + same command sequence = same state hash (`hashState`). The RNG state
lives inside `GameState`, so saving and loading continues the exact sequence. Iteration order is
canonical (arrays in id order; ties broken by id).

## Persistence

`SaveSlot` writes a versioned envelope `{game, schema, savedAt, state}`, keeps the previous save
as a backup, never throws into gameplay, and falls back to the backup if the main save is damaged.
Imports are size-checked before parsing and validated after migration. Players can export/import
saves from the menu.

## Resources

`Lifetime` owns listeners, timers, observers and renderer resources; disposal is idempotent and
reverse-ordered. Every collection in state has a cap (`WORLD.maxEnemies`, `WORLD.maxLog`).
Add pooling, spatial indexes or workers only after a measurement shows the need.

## Swapping the renderer

Implement `CreateRenderer` from `src/render/types.ts` (`draw`, `pick`, `toScreen`, `resize`,
`diagnostics`, `dispose`) and change `src/render/index.ts`. Presets in webgamedev-bootstrap:
`canvas` (default), `phaser`, `three`. The sim, saves and most tests do not change.

## Offline and release

`npm run build` → Vite bundle in `dist/` + `tools/build-sw.mjs` writes `sw.js` (content-hashed
precache) and `release.json` (version, commit, cache id). The player is offered a reload when a
new version is ready; the game saves first. CI deploys `dist/` to GitHub Pages only after the
full gate passes, and only when the asset policy allows public deployment.

Decisions that change this document get a record in [decisions/](decisions/).
