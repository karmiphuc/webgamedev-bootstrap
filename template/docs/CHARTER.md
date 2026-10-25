# Charter

LOCKED file. This is the contract between the owner and every agent working on this game.
Three tiers: **Locked** (enforced by tools; only the owner changes them),
**Defaults** (change them when there is a reason, and write the reason down),
**Open** (your creative call inside the game brief).

## 1. Locked: enforced by tools, owner-only

| Rule | Enforced by |
| --- | --- |
| Every push passes `npm run check` | `.githooks/pre-push` (installed by `npm ci`), CI `verify` job |
| No direct pushes to `main`; all work arrives through a pull request that is green on CI and the PR gate | `.githooks/pre-push`, CI `pr-gate` job (make both required checks in GitHub branch protection) |
| Same seed + same inputs = same game; a save resumes exactly; state stays valid, bounded, finite | `tests/locked/determinism.test.ts`, `tests/locked/soak.test.ts` |
| Saves never break: the saved shape changes only with a `SCHEMA` bump, a migration and an old-save fixture, and the owner approves the new shape | `tests/locked/saves.test.ts` (shape guard + fixtures); the recorded shape (`tests/fixtures/schema-signature.json`) is owner-guarded; old-save fixtures are append-only |
| The built game boots cleanly, fits phone/tablet/desktop, matches the Node simulation, keeps progress, works offline | `tests/e2e/locked.spec.ts` |
| Any visual change ships with a reviewed evidence record: `docs/evidence/<version>/REVIEW.md` with linked captures and a filled `## Verdict` | `tools/pr-gate.mjs` (paths listed under `visual` in `bootstrap.manifest.json`) |
| Locked and guarded files change only with the owner's `owner-approved` label on the PR | `tools/pr-gate.mjs` (lists in `bootstrap.manifest.json`) |

Never: skip, disable, delete or weaken a test to get green; push with `--no-verify`; add the
`owner-approved` label yourself; run `schema:accept` to paper over an unbumped shape change
(it refuses anyway).

**Contracts the game keeps** (the locked tests depend on them; everything behind them is open):

- `src/sim/testkit.ts` exports `createGame`, `advance`, `play`, `invariants`, `SOAK`,
  `prepareSoak`, `SAVE_CODEC`, `SCHEMA` with the meanings documented in that file.
- `window.__game` exposes `ready`, `step(n) → hash`, `hash()`, `state().tick`, `save()`,
  `diagnostics().lifetimeResources` and `diagnostics().errors`.
- URL options `?seed=<CODE>`, `?paused`, `?new`; the game view element has
  `data-testid="game-view"`; all URLs are relative (the game runs under `/<repo>/`).

## 2. Defaults: change with a decision record

Change any of these when it serves the game, and add `docs/decisions/NNNN-<topic>.md`
(copy `TEMPLATE.md`) in the same PR. The PR gate checks this for the starred items.

- ★ Stack and pinned versions (`package.json` dependencies), `tsconfig.json`, `vite.config.ts`
- ★ Renderer (`canvas` / `phaser` / `three` / your own behind `src/render/types.ts`)
- ★ Asset policy, pixel-art rules and budgets in `game.config.json`
- Asset provenance: every shipped file is listed in `public/assets/provenance.json`
  (checked by `npm run check`); never commit restricted art to a public repo
- Sim architecture: pure rules in `src/sim`, data in `src/content`, renderers only read state
- Working style:
  - Facts and real data. No mock or invented data unless the owner asks for it.
  - Write down what was observed in the reference game separately from what you authored
    (`docs/FIDELITY.md`).
  - When the owner's request itself is unclear, ask before writing code.
  - Report honestly what you could not verify.

## 3. Open: your call, inside `docs/GAME_BRIEF.md`

Decide freely: mechanics, rules, balance numbers, content, level and world design, art
direction (until the owner approves a baseline in `docs/ART_DIRECTION.md`), HUD/UI/UX, audio,
effects and juice, controls, renderer internals, code structure inside `src/`, extra tests and
tools. Prefer bold, playable choices over asking.

Two light obligations:

- List notable choices under **Design choices** in the PR description (informational, not a
  request for approval).
- The brief itself (intent, core loop, scope, out-of-scope) is the owner's. If a good idea needs
  the brief to change, propose the change in the PR. The gate flags brief edits for the owner.

## 4. Keeping this game in sync with the bootstrap

`node <bootstrap>/bootstrap.mjs .` is idempotent. It updates kernel and locked files that this
game has not edited, never touches game-owned files, and lists conflicts for a human or agent to
merge (upstream copies go to `.bootstrap/incoming/`). Running it twice changes nothing.
Sync PRs that touch locked files need the `owner-approved` label like any other change.
