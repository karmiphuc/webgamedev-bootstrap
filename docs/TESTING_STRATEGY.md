# Testing strategy (why it is shaped this way)

The per-game reference is `template/docs/TESTING.md`. This page explains the reasoning.

## Goals

Lean (few tools, fast), light (no device farm, no paid services), robust (no flaky tests,
tests that fail on real defects). Measured on the template in this sandbox:

| Gate | Contents | Time |
| --- | --- | --- |
| `npm run check` | typecheck, 24 unit/sim tests, asset gate, production build | ~4–15 s (canvas ~4 s; phaser build ~12 s) |
| `npm run soak` | 3 seeds × 30 game-minutes with budgets | ~1.5 s |
| browser tests | 19–21 Playwright tests on desktop, tablet, phone against `dist/` | ~30–40 s |

## The pyramid

```
            L7 evidence review (human, on visual changes)
          L6 pixel integrity + 1 golden frame (canvas)
        L5 browser: built artifact, 3 viewports, offline, sub-path
      L4 soak: long runs, bounded + finite + budgets
    L3 persistence: migrations, fixtures, failing storage
  L2 determinism: seed+inputs → same hash; save/resume == straight run
L0–L1 types, content validator, asset gate, rule tests
```

Most defects in these games are rule, state or persistence defects, which the bottom layers catch
in milliseconds because the sim has no browser dependencies. The browser layer is deliberately
small: it proves the shipped artifact boots, takes input, saves, fits screens and works offline,
and that the browser runs the *same* simulation as Node (state hash comparison).

## Why not…

| Alternative | Why not by default |
| --- | --- |
| Many screenshot goldens | brittle across fonts/GPUs; WebGL output varies. One canvas golden + reviewed evidence instead |
| Retries in CI | hide nondeterminism; the template forbids them (`retries: 0`) |
| Coverage targets | reward tests that mirror code; the template tests player-noticeable behaviour |
| Real-device farms | cost; record honestly that software-rendered timings are not device FPS |
| Snapshotting exact balance numbers | drifts with every tuning change (Ashen fixture churn); use ranges and invariants |

## Robustness techniques used

- Deterministic entry: `?seed=TESTAA&paused` + `__game.step(n)`; no sleeps.
- Problem watcher: any page error, console error, failed request or HTTP ≥ 400 fails boot tests.
- Native dialogs are a test failure (`alert/confirm/prompt` would block the loop).
- Layout assertions are geometric (canvas within stage, below HUD, no horizontal scroll), so they
  catch stale-size bugs on every viewport. Two such bugs were caught while building this.
- Failure injection: storage quota errors and corrupted saves are tested, not assumed.
- Budgets live in `game.config.json` so they are visible and changed deliberately.
