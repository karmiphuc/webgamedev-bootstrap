# Lessons from existing projects

Sources reviewed on 2026-10-25 (repository files and commit history). Each lesson links to where
it lives in the bootstrap. The Riftbound MOBA site
(`riftbound-frontier-moba.karmi-nguyen.chatgpt.site`) could not be reviewed: this build
environment's network proxy refused the connection, so nothing here is derived from it.

| Project | Stack (from package.json / docs) | Size at review |
| --- | --- | --- |
| ashen-company (Battle Brothers-like) | vanilla JS modules, Node test runner, Playwright 1.56.1, service worker, Pages via Actions | 192 commits, 169 `*.test.js` files + 18 e2e specs, 23 MB assets |
| d2-clone-emberfall (Diablo II-like) | three.js ^0.180, Vite ^7.1.7, Playwright, Blender-baked sprite atlases | 35 commits, 19 unit + 25 e2e specs |
| pirate-crew-web (Pixel Piracy-like) | TypeScript 5.9.3, Phaser 3.90.0, Vite 7.3.6, Vitest 4.1.11, Playwright 1.56.1 | 28 commits, 14 test files |
| wayfarer-guild v2 (Dungeon Village 2-like) | plain JS + Canvas 2D, no npm deps, Node scripts, Python atlas tools | 78 commits, 39 test scripts |

## What worked (kept)

| Lesson | Seen in | Bootstrap mechanism |
| --- | --- | --- |
| One command that answers "safe to commit?" | Wayfarer `tests/check.mjs` (`all checks passed`) | `npm run check` / `check:full` (`tools/check.mjs`) |
| Seeded RNG stored in state; world codes reproduce worlds | Wayfarer `js/rng.js`, `seedCode()` | `src/core/rng.ts`, `?seed=K7F2QX` |
| Sim independent of renderer, browser APIs and wall-clock time | Pirate AGENTS.md "Keep simulation independent of Phaser…"; Wayfarer rule 5 | `src/sim` boundary, Node-vs-browser hash test |
| Content as data tables + validator that fails on bad rows | Wayfarer `validate.mjs` (sprites exist, perk keys consumed) | `src/content/validate.ts` + content test |
| Migrations run on every load and must be no-ops on current saves | Wayfarer AGENTS.md rule 4 | `MIGRATIONS[n]` step chain + fixtures |
| Explicit lifetimes, bounded queues, measure before pooling/ECS | Pirate `performance-and-lifecycle.md`, decision 0002, `Lifetime` class | `src/core/lifetime.ts`, caps in `WORLD`, soak budgets |
| Bounded catch-up after stalls | Pirate (≤2 steps, 100 ms), Wayfarer (≤40 steps) | `FixedLoop` `maxStepsPerFrame` + dropped-time stat |
| Test the production artifact, under the Pages sub-path, offline | Ashen release workflow + `release.spec.js`; Pirate `hosting-check.mjs` | e2e against `dist/` at `/<slug>/`; `offline.spec.ts` |
| Content-hashed offline cache; never reload mid-game without saving | Ashen RELEASES.md ("asks open windows to pause/save before reloading") | `tools/build-sw.mjs`, `src/app/offline.ts` |
| Verify the live deployment matches the commit | Ashen `verify-deployment.mjs` | CI "Verify the live release" step via `release.json` |
| Provenance manifests with source path, licence and SHA-256 | Ashen `*-source.json` manifests; Emberfall THIRD_PARTY.md pinned revisions | `provenance.json` + `npm run assets -- hash` |
| Strict licence policy for public repos | Wayfarer ASSETS.md (CC0/CC-BY only, no NC, no Kairosoft assets) | `public-permissive` policy |
| Observed reference facts separate from authored values | Pirate `fidelity.md`, `research.md` (dated sources, "not measured") | `docs/FIDELITY.md` + clone-recon skill |
| Approved art baseline; changes need in-game comparison | Emberfall ART_DIRECTION.md (v0.20/v0.21 approved) | ART_DIRECTION "Approved baseline" + style gate |
| Visual QA from real captures at several viewports | Emberfall `docs/qa-v*.md`, Pirate `visual-review.md` | `npm run evidence` + REVIEW template |
| Pixel art must have hard alpha edges | Pirate `browser-check.mjs` counts `softEdges === 0` | `npm run assets` soft-alpha check |
| Docs tested by a smaller model | Wayfarer TESTING.md "Docs dogfood test" | template TESTING.md dogfood section |
| Trap table of "looks right but is wrong" | Wayfarer AGENTS.md §5 | template AGENTS.md §5 |
| No alert/confirm/prompt | Wayfarer rule 9 | `hud.ask()` / `hud.toast()` + e2e dialog guard |
| PR template: player-visible change / validation / limits | Emberfall `.github/pull_request_template.md` | template PR template |

## What hurt (designed out)

| Problem | Seen in | Bootstrap response |
| --- | --- | --- |
| Many fix commits for weapon grip, facing, animation continuity, crisp sprites | Wayfarer `fix(v2): …weapons…`, Pirate "Fix v0.6.1: crisp raster pirate sprites", Emberfall "Fix movement and attack playback discontinuities" | ART_DIRECTION §5 rules; facing rule tested in `rules.test.ts`; pixel checks |
| Test fixtures drifting with balance changes | Ashen "Update combat fixtures for the new skill balance", "Align time-jump fixtures…" | budgets and invariants over snapshot numbers; balance gates stated as ranges |
| Mixed packs looking incoherent | Wayfarer ASSETS.md ("Most rejected attempts… mixed packs") | style gate with contact sheets |
| Stale atlas = invisible sprites | Wayfarer trap table | content test checks every sprite frame exists |
| Dev server with cached code | Wayfarer trap ("use serve.py, not http.server") | Vite dev; `tools/serve.mjs` sends `no-cache` |
| Public repo containing restricted art | Ashen credits note Legends terms (permission required) | `private-personal` policy refuses public deploy |
| Per-scenario browser scripts multiplying | Pirate has 10 `*-browser-check.mjs` scripts | one Playwright suite with shared helpers and a debug API |
| CI publishing a superseded build / wrong Pages mode | Ashen release.yml preflight + superseded-build rejection | single deploy job after verify; `configure-pages` enablement; live verification |

## Bugs this bootstrap's own tests caught while it was built

These show the gates working on real defects, not hypothetical ones:

1. **World codes did not round-trip** for half of all seeds (6 chars × 5 bits = 30 bits, seeds were 31-bit). Caught by `core.test.ts`; fixed with `normalizeSeed`.
2. **Service worker never registered**: boot is async, so `window.load` had already fired. Caught by `offline.spec.ts`.
3. **Canvas overflowed the stage** after the HUD was inserted. Spotted while reviewing the golden image; the smoke test was then tightened to fail on it (verified failing on the old code).
4. **Phaser measured the stage before the HUD existed** (same class). Caught by the tightened smoke test; fixed by creating the renderer after the HUD.
5. **The three.js camera cropped the field on portrait phones**, so taps missed. Caught by the phone e2e project; the camera now fits the playfield for any aspect ratio.
