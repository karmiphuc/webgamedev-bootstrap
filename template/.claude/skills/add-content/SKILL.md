---
name: add-content
description: Add units, enemies, items, waves or a new mechanic following the data-first recipe, with validation and tests. Use for any gameplay addition.
---

# Add content or a mechanic

Order: **data → validator → sim rule → test → UI → render.**

1. Content only (new enemy, item, wave): add a row in `src/content/*.ts`. Reuse existing
   mechanics. If the row needs a sprite, its frame must exist in the atlas
   (`tests/sim/content.test.ts` checks it).
2. New field on a row: add a rule to `src/content/validate.ts` (positive numbers, known ids,
   whole ticks…).
3. New mechanic: implement it in `src/sim/sim.ts` as part of the fixed step order. Use only
   `this.rng` for randomness, cap any new collection, and emit a `StepEvent` if the player
   should see or hear it.
4. New saved field: bump `SCHEMA` in `src/sim/state.ts`, add `MIGRATIONS[old]`, extend
   `validateState`, export an old save into `tests/fixtures/` first, then `npm run schema:accept`
   (the owner approves the new recorded shape: it is owner-guarded).
5. Tests: a focused rule test in `tests/sim/` (set state directly, step, assert what the
   player would notice). Make `play()` in `src/sim/testkit.ts` exercise it so the locked determinism and soak tests cover it.
6. Player action: add a `Command` variant + `checkCommand` validation + a bad-input test.
7. UI and rendering last; renderers read state and events only.
8. `npm run check`, play it with `?new`, update docs/FIDELITY.md (observed vs authored).
