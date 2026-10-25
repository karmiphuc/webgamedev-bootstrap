# Testing strategy

Lean on purpose: most confidence comes from fast, deterministic tests of the simulation;
a small number of browser tests check the shipped artifact; humans judge the look from
captured evidence. Every layer answers a different question.

| Layer | Question | Where | Runs in | Speed |
| --- | --- | --- | --- | --- |
| L0 Static | Do types, content rows and asset licences make sense? | `tsc`, `validateContent`, `npm run assets` | `check` | seconds |
| L1 Rules | Does each mechanic do what the player expects? | `tests/sim/*.test.ts` (game-owned) | `check` | ms |
| L2 Determinism | Same seed + same inputs = same world? Save/resume = uninterrupted? | `tests/locked/determinism.test.ts` (LOCKED) | `check` | ms |
| L3 Persistence | Old saves migrate; the save shape cannot change without a SCHEMA bump; broken storage never loses the game | `tests/locked/saves.test.ts` (LOCKED) + `tests/fixtures/` | `check` | ms |
| L4 Soak | Long sessions stay bounded, finite and fast | `tests/locked/soak.test.ts` (LOCKED; budgets in `game.config.json`, length in `testkit.SOAK`) | `check:full` | ~2 s |
| L5 Browser | Does the BUILT game boot, take input, save, fit 3 viewports, work offline, under a sub-path? | `tests/e2e/*.spec.ts` | `check:full`, CI | ~30 s |
| L6 Pixels | Is pixel art crisp and does a known frame render identically? | `tests/e2e/pixels.spec.ts` + golden PNG | `check:full`, CI | s |
| L7 Evidence | Does it LOOK right? | `npm run evidence` + `docs/evidence/` review | on visual changes | human |

Locked layers (L2–L5 generic parts) talk to the game only through `src/sim/testkit.ts`
and `window.__game`, so they stay fixed while the game changes completely.
Browser tests: `tests/e2e/locked.spec.ts` (LOCKED contract) + your own specs (e.g. `game.spec.ts`).

## Principles

- **Test behaviour the player would notice.** "A kill pays once", "the hero stops at the target",
  not "function X was called".
- **Deterministic or it doesn't exist.** Browser tests open `?seed=TESTAA&paused` and advance with
  `window.__game.step(n)`. No sleeps, no retries. A flaky test is a bug.
- **Test what ships.** Browser tests run against `dist/` served under `/<slug>/` like GitHub Pages.
- **Cross-check browser vs. Node.** The smoke test asserts the browser's state hash after N ticks
  equals the Node simulation's hash: the renderer cannot change game state.
- **Budgets are numbers.** `stepMicros`, `saveBytes`, `assetBytes` live in `game.config.json`.
  Change them deliberately, never to make a red test green.
- **Goldens are reviewed, not rubber-stamped.** After `--update-snapshots`, open the PNG.
  Goldens exist only for the canvas renderer (WebGL output varies across GPUs/drivers).
- **Automated tests do not prove visual quality.** Evidence review is part of done for visual work.

## Adding tests

| You added… | Add… |
| --- | --- |
| A content row type or field | a rule in `src/content/validate.ts` |
| A mechanic | a focused test in `tests/sim/` (set up state directly, step, assert) and make `play()` in `src/sim/testkit.ts` exercise it |
| A player action | a `Command` variant + validation test for bad input |
| A save field | migration + old-save fixture + a test that loads and keeps playing it |
| A UI flow | one Playwright test using roles/labels (`getByRole`) |
| A visual feature | an evidence scene in `tests/e2e/evidence.spec.ts` |

## Debug API (`window.__game`)

`state()`, `hash()`, `step(n)`, `command(cmd)`, `pause(bool)`, `render()`, `toScreen(x, y)`,
`save()`, `clearSave()`, `newGame(seed)`, `diagnostics()` (renderer info, frame-time and
tick-time percentiles, owned resource count, enemy count, captured errors).

## Docs dogfood (when AGENTS.md or recipes change a lot)

Give a small model only AGENTS.md and a task ("add a new enemy that reuses the bat sprite and
appears from tick 800"). Pass = it completes with `npm run check` green and invents nothing.
Every doc line it misreads gets rewritten.
