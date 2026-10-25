# webgamedev-bootstrap

A generator plus a tested template for starting **personal browser remakes of existing games**:
deterministic simulation, swappable renderer (pixel canvas, Phaser, three.js), licence-gated
asset pipeline, visual-review workflow, and a lean test suite that runs against the shipped
artifact. Distilled from four earlier projects
(Ashen Company, Emberfall, Pirate Crew, Wayfarer Guild; see [docs/LESSONS.md](docs/LESSONS.md)).

## Quick start

```sh
git clone https://github.com/karmiphuc/webgamedev-bootstrap
node webgamedev-bootstrap/create.mjs riftbound --name "Riftbound" \
  --renderer three --reference "Dota 2 x Mobile Legends" --git
cd riftbound
npm run dev          # http://localhost:5173/?new — a playable arena with placeholder art
npm run check        # the gate before every commit
```

Requires Node 22+. Browser tests need Chromium: `npx playwright install chromium`, or set
`PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium/Chrome.

```
node create.mjs <dir> --name "<Name>" [--renderer canvas|phaser|three]
                [--policy public-permissive|public-sharealike|private-personal]
                [--reference "<game, build>"] [--slug <slug>] [--git] [--no-install] [--force]
node create.mjs --diff <game-dir>     # which kernel files changed here vs upstream
node create.mjs --list                # renderers and asset policies
```

## What a generated game contains

| Area | What you get | Why |
| --- | --- | --- |
| Simulation | seeded RNG in state, fixed 20 Hz loop with bounded catch-up, commands in / events out, plain-JSON state | testable in ms, reproducible worlds (`?seed=K7F2QX`), renderer-independent |
| Saves | versioned envelope, migration chain, backup slot, failure-tolerant writes, export/import, old-save fixtures | saves never break |
| Content | data tables + validator | new content = new rows |
| Rendering | `canvas` integer-scale pixel renderer (default) or `phaser` / `three` presets behind one contract | pick per game, swap later |
| Assets | `provenance.json` register, licence policy, pinned SHA-256, hard-alpha / grid / palette checks, contact sheets, generated CREDITS | coherent look, no licence surprises |
| Visual guidance | ART_DIRECTION with measured-reference table, style gate, animation rules, review checklist; `npm run evidence` captures | the look is reviewed, not hoped for |
| Tests | 24 unit/sim tests, soak with budgets, 19–21 browser tests on desktop/tablet/phone against `dist/` (offline, sub-path, Node-vs-browser state hash, pixel golden) | lean, deterministic, catches real defects |
| Agents | AGENTS.md (commands, golden rules, definition of done, trap table), CLAUDE.md, 4 skills: import-asset, visual-review, clone-recon, add-content | agents follow the same playbook every time |
| Delivery | GitHub Actions: gate → soak → browser tests → Pages deploy (blocked for `private-personal`) → live commit verification; offline service worker | test what ships; play offline |

## Documentation

| Doc | For |
| --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | the system design, options considered, decisions |
| [LESSONS.md](docs/LESSONS.md) | evidence from the four earlier repos, and bugs caught while building this |
| [CLONE_PLAYBOOK.md](docs/CLONE_PLAYBOOK.md) | from "I want X" to a playable remake, phase by phase |
| [VISUAL_GUIDE.md](docs/VISUAL_GUIDE.md) | measuring a reference look, choosing an art pipeline, coherence rules |
| [ASSET_SOURCING.md](docs/ASSET_SOURCING.md) | where to find assets and how licences map to policies |
| [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) | why the tests are shaped this way |
| [GENRE_MODULES.md](docs/GENRE_MODULES.md) | MOBA, ARPG, tactics, management, crew-sim checklists |

## Maintaining the bootstrap

```sh
node scripts/selftest.mjs            # generate canvas/phaser/three games, run each full gate (~2.5 min)
node scripts/selftest.mjs --fast     # skip browser tests
node scripts/relock.mjs              # after changing pinned versions
```

Pinned: TypeScript 5.9.3, Vite 7.3.6, Vitest 4.1.11, @playwright/test 1.63.0 (Chromium 1243),
Phaser 3.90.0, three 0.180.0. These are the versions already used across the earlier projects,
chosen over the newer majors (Vite 8, Phaser 4, TypeScript 7) for stability.
