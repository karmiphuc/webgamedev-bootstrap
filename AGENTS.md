# Agents: start here

This repository bootstraps personal browser-game remakes. Find your situation below and follow
it literally.

## A. You were pointed here to start a NEW game

You are in (or were given) a new, empty game repository (a README or LICENSE is fine).

1. Get the bootstrap next to the game (re-running is safe):
   ```sh
   git clone --depth 1 https://github.com/karmiphuc/webgamedev-bootstrap ../webgamedev-bootstrap \
     || git -C ../webgamedev-bootstrap pull --ff-only
   ```
2. Pick the two choices from the owner's request (both are **defaults**, changeable later):
   - `--renderer`: `canvas` for 2D pixel art (default), `phaser` for 2D wanting engine features,
     `three` for 3D / isometric-3D / MOBA-style cameras.
   - `--policy`: `public-permissive` (default, public repo), `public-sharealike`, or
     `private-personal` (private repo only; allows adapted/NC art, never deployed publicly).
3. Bootstrap in place (name and slug come from the repo name):
   ```sh
   node ../webgamedev-bootstrap/bootstrap.mjs . --reference "<game being remade>" --renderer <r> --policy <p>
   ```
4. Follow the new game's `AGENTS.md` §0. In short:
   - Read `docs/CHARTER.md`.
   - Fill `docs/GAME_BRIEF.md` from the owner's words.
   - Run `npm run check`, then `npm run evidence`.
   - Write `docs/evidence/v0.1.0/REVIEW.md`.
   - On a branch, run `npm run pr-gate`, then open a pull request.
5. Tell the owner that this first PR changes locked files, so it needs their `owner-approved` label.
   Ask them to make the CI checks `pr-gate` and `verify` required on `main`
   (Settings → Branches → branch protection).

## B. You are working in an EXISTING game made from this bootstrap

Read that game's `AGENTS.md` and `docs/CHARTER.md`; they are the rules. To bring in bootstrap
improvements (idempotent; never touches game-owned files):

```sh
git -C ../webgamedev-bootstrap pull --ff-only   # or clone as in A.1
node ../webgamedev-bootstrap/bootstrap.mjs . --check   # what would change
node ../webgamedev-bootstrap/bootstrap.mjs .           # apply; exit 3 = conflicts to merge by hand
```

Merge each conflict against `.bootstrap/incoming/<path>`, then
`node ../webgamedev-bootstrap/bootstrap.mjs . --resolved <path>`. Run `npm run check`, then open a PR.
A sync that touches locked files needs the owner's label.

## C. You are changing the bootstrap ITSELF

- `template/` is a complete game; `presets/` overlay other renderers; `bootstrap.mjs` creates
  and syncs games; `template/bootstrap.manifest.json` classifies every file:
  - **locked**: synced, owner-only;
  - **kernel**: synced when the game has not edited it;
  - **guarded / appendOnly**: game-owned but owner-protected;
  - everything else: game-owned.
- Keep the promises: bootstrap is idempotent; sync never touches game-owned files; locked rules
  stay enforced by tools. `node scripts/selftest.mjs` proves all of these (`--fast` skips the
  browser tests).
- After changing pinned versions: `node scripts/relock.mjs`.
- Adding a file: decide its class in the manifest first. Rules that matter to the owner belong in
  `template/docs/CHARTER.md` and must be enforced by a test or the PR gate, not only written down.
- Work on a branch and open a PR; CI runs the self-test.

Design and rationale: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
