# webgamedev-bootstrap

A generator plus a tested template for starting **personal browser remakes of existing games**:
deterministic simulation, swappable renderer (pixel canvas, Phaser, three.js), licence-gated
asset pipeline, visual-review workflow, and a lean test suite that runs against the shipped
artifact. Distilled from four earlier projects
(Ashen Company, Emberfall, Pirate Crew, Wayfarer Guild; see [docs/LESSONS.md](docs/LESSONS.md)).

## Start a new game

Create an empty GitHub repo, open an agent session on it, and say:

> Bootstrap this from karmiphuc/webgamedev-bootstrap. It's a remake of <game>.

The agent follows [AGENTS.md](AGENTS.md). By hand it is two commands, run inside the new repo:

```sh
git clone --depth 1 https://github.com/karmiphuc/webgamedev-bootstrap ../webgamedev-bootstrap
node ../webgamedev-bootstrap/bootstrap.mjs . --reference "Dota 2 x MLBB" --renderer three
```

`bootstrap.mjs` is **idempotent**:
- **First run** creates the game in place.
- **Later runs** sync improvements from the bootstrap into files the game hasn't edited. They never touch game-owned files and report conflicts instead of overwriting.
- **Running it twice** changes nothing.

Options: `--renderer canvas|phaser|three`, `--policy public-permissive|public-sharealike|private-personal`,
`--name`, `--slug`, `--check` (dry run), `--resolved <path|all>`, `--no-install`, `--force`, `--list`.

Requires Node 22+. Browser tests need Chromium: `npx playwright install chromium`, or set
`PLAYWRIGHT_CHROMIUM_PATH`.

## Rigid where it matters, open where it doesn't

Every game carries `docs/CHARTER.md` with three tiers:

| Tier | What | How it is enforced |
| --- | --- | --- |
| **Locked** | tests and saves (determinism, migrations, save-shape guard, soak, browser contract); PR-only delivery; reviewed visual evidence for every visual change | pre-push hook, locked test suites, CI `pr-gate`; changing locked files needs the owner's `owner-approved` label |
| **Defaults** | stack and versions, renderer, asset policy and provenance, budgets, sim architecture, working style (facts, no mock data) | change freely with a decision record in `docs/decisions/` (PR gate checks it) |
| **Open** | mechanics, balance, content, art direction, UI/UX, audio, code structure | the agent's call within `docs/GAME_BRIEF.md`; noted in the PR |

## What a generated game contains

| Area | What you get | Why |
| --- | --- | --- |
| Simulation | seeded RNG in state, fixed 20 Hz loop with bounded catch-up, commands in / events out, plain-JSON state | testable in ms, reproducible worlds (`?seed=K7F2QX`), renderer-independent |
| Saves | versioned envelope, migration chain, backup slot, failure-tolerant writes, export/import, old-save fixtures | saves never break |
| Content | data tables + validator | new content = new rows |
| Rendering | `canvas` integer-scale pixel renderer (default) or `phaser` / `three` presets behind one contract | pick per game, swap later |
| Assets | `provenance.json` register, licence policy, pinned SHA-256, hard-alpha / grid / palette checks, contact sheets, generated CREDITS | coherent look, no licence surprises |
| Visual guidance | ART_DIRECTION with measured-reference table, style gate, animation rules, review checklist; `npm run evidence` captures | the look is reviewed, not hoped for |
| Tests | 26 locked + game tests in Node, soak with budgets, ~24 browser tests on desktop/tablet/phone against `dist/` (offline, sub-path, Node-vs-browser state hash, pixel golden) | lean, deterministic, catches real defects |
| Agents | CHARTER (locked / defaults / open), AGENTS.md session routine + definition of done + traps, GAME_NOTES, CLAUDE.md, 4 skills | a fresh agent knows the rules in one read |
| Locks | `tests/locked/*` via a small `src/sim/testkit.ts` adapter, save-shape guard, `tests/e2e/locked.spec.ts`, pre-push hook, `tools/pr-gate.mjs`, `bootstrap.manifest.json` | the rules that matter cannot be skipped |
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
node scripts/selftest.mjs            # every promise: init per renderer + full gate, idempotency, sync, locks (~3 min)
node scripts/selftest.mjs --fast     # skip browser tests
node scripts/relock.mjs              # after changing pinned versions
```

Pinned: TypeScript 5.9.3, Vite 7.3.6, Vitest 4.1.11, @playwright/test 1.63.0 (Chromium 1243),
Phaser 3.90.0, three 0.180.0. These are the versions already used across the earlier projects,
chosen over the newer majors (Vite 8, Phaser 4, TypeScript 7) for stability.
