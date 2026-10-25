# Agent guide (read this first)

This is a browser game made from **webgamedev-bootstrap**: a personal,
offline-capable remake study. It is TypeScript + Vite, with a deterministic
simulation that has no rendering dependencies, a swappable renderer, and
data-driven content. Follow this file literally. When in doubt, pick the
option this file names.

Before changing gameplay or visuals, read:
[docs/GAME_BRIEF.md](docs/GAME_BRIEF.md) (what we are making),
[docs/FIDELITY.md](docs/FIDELITY.md) (reference vs. delivered),
[docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) (the approved look),
[docs/ASSETS.md](docs/ASSETS.md) (licences and pipeline),
[docs/TESTING.md](docs/TESTING.md) (what proves what),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (module boundaries).

## 1. Commands

| Goal | Command | Expected result |
| --- | --- | --- |
| Gate before EVERY commit | `npm run check` | ends with `all checks passed` (~10–30 s) |
| Full gate (before merging or releasing) | `npm run check:full` | `all checks passed (full)`: adds soak and browser tests |
| Play locally | `npm run dev` then open `http://localhost:5173/?new` | `?new` = fresh game, `?seed=K7F2QX` = a fixed world |
| Browser tests only | `npm run test:e2e` | builds, then tests the built artifact |
| Visual evidence for review | `npm run evidence` | screenshots in `docs/evidence/v<version>/` |
| Asset gate / tools | `npm run assets -- validate \| hash \| add \| credits \| inspect \| sheet` | see docs/ASSETS.md |

Chromium is already installed? Set `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome`.
Otherwise run `npx playwright install chromium` once.

## 2. Where things live

```
src/core/      kernel: rng, fixed loop, save/migrate, lifetime, hash (rarely edited)
src/content/   DATA tables + validator. New units/items/waves = new rows here
src/sim/       game rules (state.ts = save shape + migrations, sim.ts = step)
src/render/    renderer contract (types.ts) + the active renderer
src/ui/        DOM HUD, menus, dialogs
src/app/       boot, input -> commands, autosave, audio, offline, debug API
public/assets/ runtime assets + provenance.json (licence register)
tools/         check, assets, build-sw, serve, placeholder art
tests/unit, tests/sim   Vitest (fast, no browser)
tests/e2e      Playwright against the BUILT game (desktop, tablet, phone)
docs/          brief, fidelity, art direction, assets, testing, decisions, evidence
```

## 3. Golden rules (each one has broken a previous game)

1. **The sim is pure.** `src/sim` and `src/content` never import the DOM, a renderer, `Date.now`,
   `performance.now` or `Math.random`. Randomness comes from `makeRng(state.rng)`.
2. **State is plain JSON.** No classes, Maps, Sets, functions or DOM nodes in `GameState`. IDs come
   from `state.nextId++` and are never reused.
3. **Renderers and UI only read state.** Player input becomes a validated `Command`
   (`sim.command()`), applied on the next tick.
4. **Content is data.** Add rows to `src/content/*.ts`. Change `sim.ts` only for a NEW mechanic.
   Add a validator rule whenever a data mistake slips through.
5. **Save shape change = migration + fixture.** Bump `SCHEMA`, add `MIGRATIONS[old]`, and commit an
   exported old save in `tests/fixtures/` first. Never break existing saves.
6. **Everything is bounded.** Every array in state, queue, cache, log and effect list has a cap.
   Every listener, timer, observer and GPU resource is owned by a `Lifetime`.
7. **Pixel art: integer scale, no smoothing, one style.** Never fractional-scale sprites. Never mix
   packs without passing the style gate in docs/ART_DIRECTION.md.
8. **No asset without provenance.** Every file in `public/assets` is listed in `provenance.json`
   with source URL, author and licence, allowed by `assetPolicy` in `game.config.json`.
   A free download is not the same as permission. Never commit ripped game assets to a public repo.
9. **No `alert()` / `confirm()` / `prompt()`.** Use `hud.ask()` and `hud.toast()`.
10. **Observed vs. authored.** When cloning, record what you *measured* in the reference game
    separately from what you *guessed* (docs/FIDELITY.md). Never present guesses as facts.
11. **Look at it.** Tests prove behaviour, not appearance. For any visual change, run
    `npm run evidence`, open the images, and write what you checked in the evidence review.

## 4. Definition of done (copy into your final message and tick it)

- [ ] `npm run check` → `all checks passed` (`check:full` for gameplay/visual/release changes)
- [ ] Played it: `npm run dev`, `?new`, one minute, no console errors, the change is visible
- [ ] New mechanic: a focused test in `tests/sim/`, plus the bot script uses it if relevant
- [ ] New assets: provenance entry, `npm run assets -- hash`, `npm run assets -- credits`, style gate passed
- [ ] Save shape changed: `SCHEMA` bumped, migration added, old-save fixture committed
- [ ] Visual change: evidence captured and reviewed (docs/evidence/README.md)
- [ ] Docs: FIDELITY row updated; ART_DIRECTION if the look changed; decision record if architecture changed

## 5. Known traps

| Trap | Do this instead |
| --- | --- |
| Golden screenshot fails after an intended visual change | `npx playwright test pixels --update-snapshots`, then OPEN the new PNG before committing it |
| Sprite looks blurry or shimmers | Integer scale only; snap positions to whole source pixels; `imageSmoothingEnabled = false` |
| Sprite invisible after adding it | Frame name missing from the atlas JSON: the content test reports it |
| Hero faces the wrong way on vertical moves | Facing changes only on horizontal movement (sim.ts `move`) |
| `npm install` crashes with `reading 'edgesOut'` | npm 10 resolver bug with vitest peers: use `npm ci` (lockfile) or `npm install --legacy-peer-deps` |
| Game works in dev but not on GitHub Pages | Use relative URLs (`assets/...`, never `/assets/...`); e2e tests serve under `/<slug>/` to catch this |
| Old code after deploy | The offline worker serves the previous version until the player accepts "Reload" |
| Tab hidden then resumed = time jump | The loop resets its clock on visibility change; never use wall-clock time in rules |
| Test passes locally, flaky in CI | Make it deterministic (`?seed=TESTAA&paused` + `g.step(n)`); never add retries |
| Click passes through a panel into the world | Keep HUD/panels outside `#stage`; input handlers live on `#stage` |
