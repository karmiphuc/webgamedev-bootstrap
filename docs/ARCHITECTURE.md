# Bootstrap system architecture

## 1. Problem

Recurring goal: clone a popular game for personal play (often offline, desktop/iPad/phone),
replicating its look and mechanics as closely as possible with free or properly sourced
assets (pixel art, Godot/Blender/itch.io/OpenGameArt material, generated art), built mostly by
coding agents. Every new project used to re-solve the same infrastructure, and re-learn the
same lessons through bugs. This repository turns those lessons into a reusable starting point.

## 2. Requirements

| # | Requirement | Why (evidence in [LESSONS.md](LESSONS.md)) |
| --- | --- | --- |
| R1 | Day-0 playable: a generated game boots, plays, saves and deploys before any feature work | each project spent its first iterations on scaffolding |
| R2 | Game rules testable in milliseconds without a browser | Wayfarer `check.mjs`, Pirate Vitest sims, Ashen headless combat |
| R3 | Determinism: seed + inputs reproduce a world; saves resume exactly | Wayfarer seeded RNG + world codes; Pirate determinism contract |
| R4 | Saves never break | Wayfarer `migrate()`, Pirate schema v1→v10, Ashen save validation |
| R5 | Visual coherence and pixel integrity, enforced not hoped for | Wayfarer "one art style" rule, Pirate soft-edge checks, Emberfall approved baseline |
| R6 | Every asset has provenance and an allowed licence for where it is deployed | Wayfarer CC0/CC-BY policy vs Ashen adapted Battle Brothers art |
| R7 | Renderer choice per game (2D pixel, engine 2D, 3D) without rewriting rules | Wayfarer Canvas, Pirate Phaser, Emberfall three.js |
| R8 | Tests check the shipped artifact on phone/tablet/desktop, including offline | Ashen release workflow, Pirate hosting check, Emberfall phone checks |
| R9 | Agent-operable: one gate command, literal rules, definition of done, trap table | Wayfarer AGENTS.md + docs dogfood with a small model |
| R10 | Lean: few dependencies, fast feedback, no framework lock-in | Wayfarer zero-dependency v2; Pirate decision 0002 (measure before ECS/pools) |
| R11 | Old games never break when the bootstrap evolves; fixes can still be ported | four repos on four different stacks |

## 3. Options considered

| Option | Verdict | Reason |
| --- | --- | --- |
| A. Shared npm runtime library used by all games | rejected | one release can break every existing game (R11); version drift across personal repos; agents then debug a library they cannot see |
| B. GitHub "template repository" only | partial | easy to copy, but no renderer choice, no names, no drift tracking |
| C. Godot / Unity project template with web export | rejected as default | heavier web builds, weaker DOM UI, slower agent iteration; Godot/Unity stores remain asset *sources* |
| **D. Generator + copied kernel + renderer presets + contracts** | **chosen** | each game owns its code (R11), presets give R7, generated docs and gates give R5/R6/R9, idempotent sync ports fixes safely |

## 4. Shape of the system

```
webgamedev-bootstrap/
├─ AGENTS.md / CLAUDE.md entry point: "pointed here? do this" (new game, existing game, bootstrap work)
├─ bootstrap.mjs         ONE idempotent command: init in place (no lock) or safe sync (lock present)
├─ create.mjs            compatibility alias for bootstrap.mjs
├─ template/             a complete, runnable, tested game (canvas renderer)
│  ├─ src/core           KERNEL: rng, fixed loop, save+migrations, lifetime, hash
│  ├─ src/content        data tables + validator          (game-specific)
│  ├─ src/sim            pure deterministic rules         (game-specific)
│  ├─ src/render         renderer contract + canvas renderer
│  ├─ src/ui, src/app    HUD/dialogs; boot, input→commands, autosave, offline, debug API
│  ├─ tools/             KERNEL: check, assets (policy/provenance/pixels/sheets), png, build-sw, serve
│  ├─ bootstrap.manifest.json  classifies files: locked / kernel / guarded / appendOnly / game; visual paths; defaults
│  ├─ docs/CHARTER.md    the locked / defaults / open contract every agent reads first
│  ├─ src/sim/testkit.ts game-owned adapter the locked tests drive (createGame, advance, play, invariants)
│  ├─ tests/             locked (determinism, saves + shape guard, soak, kernel), sim (game rules), e2e (locked contract + game specs)
│  ├─ .githooks/pre-push no direct pushes to main; npm run check before every push
│  ├─ docs/              brief, fidelity, art direction, assets, testing, architecture, decisions, evidence
│  ├─ .claude/skills     import-asset, visual-review, clone-recon, add-content
│  └─ .github/           CI: gate → soak → browser tests → policy-gated Pages deploy → live verify
├─ presets/phaser, presets/three   renderer overlays (+ pinned lockfiles)
├─ scripts/selftest.mjs  generates every preset and runs its full gate
└─ docs/                 this design, lessons, visual guide, testing strategy, sourcing, clone playbook, genres
```

### Layer contracts inside a generated game

```
Command ──► Sim.step() ──► GameState (plain JSON, seeded RNG inside)
                 │                │
                 ▼                ├─► SaveSlot (versioned, migrated, backup)
            StepEvents            ├─► Renderer.draw(state, prev, alpha, events)  (read-only)
          (fx, sound)             └─► Hud.update(state)                          (read-only)
```

- **Kernel** (`src/core`, `tools`, test helpers, CI, skills, policy docs) is identical across
  games and tracked by hash in `bootstrap.lock.json`.
- **Game layer** (`src/content`, `src/sim`, `src/ui`, renderer, brief/fidelity/art docs) is
  expected to diverge completely.
- **Renderer contract** (`draw`, `pick`, `toScreen`, `resize`, `diagnostics`, `dispose`) is the
  only seam between rules and pixels; presets implement it.

## 5. Key decisions

| Decision | Detail |
| --- | --- |
| TypeScript + Vite 7.3.6, Vitest 4.1.11, Playwright 1.63.0, TS 5.9.3 | versions already proven in these projects (Pirate, Emberfall), pinned exactly; Playwright 1.63.0 matches Chromium build 1243 |
| Fixed 20 Hz tick, ≤4 catch-up steps, drop surplus | Pirate performance contract; Wayfarer 40-step cap; avoids spiral-of-death after tab sleep |
| RNG state inside game state; 30-bit world codes | Wayfarer `rng.js` and world codes; the code must round-trip (a bug the tests caught during this build) |
| Plain-JSON state + `MIGRATIONS[n]` + fixtures | Wayfarer migrate rules, Pirate import validation; backup slot and failure-tolerant writes |
| Assets gated by policy + provenance + pinned SHA-256 | Ashen source manifests with hashes; Wayfarer licence rules; Pirate attribution register |
| Dependency-free PNG codec in `tools/png.mjs` | pixel checks and contact sheets with no Python/Pillow; verified pixel-identical to Pillow on 85 real PNGs from these repos (RGBA, palette, greyscale) |
| E2E against `dist/` under `/<slug>/` | Ashen tests the production artifact; Pirate hosting sub-path check |
| Goldens only for canvas | WebGL output differs across GPUs/drivers; Emberfall/Pirate rely on reviewed captures for WebGL |
| Public deploy refused for `private-personal` | keeps adapted or NC art out of public Pages by construction |
| Copy kernel, don't depend on it | see option A above |

## 6. Tiers, idempotency and sync

**Tiers** (template `docs/CHARTER.md`):
- **Locked** rules are enforced by code, not prose: locked test suites, the save-shape guard, the
  pre-push hook and the CI PR gate. Changing their files needs the owner's label.
- **Defaults** change with a decision record, which the gate checks.
- **Open** choices belong to the agent within the game brief.

**Idempotency.** `bootstrap.mjs` decides by the presence of `bootstrap.lock.json`. Init writes the
lock with the hash of every synced file and the kernel `package.json` entries. Sync compares
three hashes per file (game, lock baseline, upstream):

| game vs baseline | upstream vs baseline | action |
| --- | --- | --- |
| same | changed | update file, move baseline |
| changed | same | keep the game's edit |
| changed | changed | conflict: upstream copy to `.bootstrap/incoming/`, exit 3, `--resolved` after merging |
| missing | — | locked: conflict; kernel: respect the deletion |

Game-owned files are never synced. Writes happen only when content differs, and the lock is
written with sorted keys and no timestamps. Running sync twice is therefore a no-op, which the
self-test asserts with `git status --porcelain`.

**Rigid tests, free game.** Locked tests import only `src/sim/testkit.ts` (game-owned adapter)
and use only the `window.__game` contract. A game can rewrite every rule, renderer and screen; the
locked suites still apply unchanged, and they still sync from upstream.

## 7. Lifecycle of a game

1. Empty repo → `node ../webgamedev-bootstrap/bootstrap.mjs . --reference "Dota 2 / Mobile Legends" --renderer three`
2. Fill `docs/GAME_BRIEF.md` (intent, loop, scope ladder) and run the **clone-recon** skill
   for the first system → `docs/FIDELITY.md`.
3. Approve a look: style gate + evidence review → `docs/ART_DIRECTION.md` baseline.
4. Climb the scope ladder; every rung passes `npm run check:full`.
5. Push to GitHub: CI runs the gate and (policy permitting) deploys and verifies Pages.
6. Later: `node ../webgamedev-bootstrap/bootstrap.mjs .` pulls kernel fixes safely (`--check` first to preview).

## 8. Evolving the bootstrap

- Change the template, run `node scripts/selftest.mjs` (generates canvas/phaser/three games and
  runs each one's full gate, including browser tests).
- After changing a pinned version: `node scripts/relock.mjs` (regenerates lockfiles; works around
  an npm 10 resolver crash with vitest optional peers).
- When a game discovers a new failure class, add the rule to template `AGENTS.md` (golden rules or
  traps), a test or validator rule that catches it, and a line in [LESSONS.md](LESSONS.md).
