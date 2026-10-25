# Save fixtures

Every file here is a save in an OLD schema. `tests/sim/content-and-saves.test.ts`
loads each one through the migration chain and keeps playing it.

- When you bump `SCHEMA` in `src/sim/state.ts`, first export a save from the
  current build (Menu → Export save) and commit it here as
  `schema<N>-<what-it-covers>.json`. Never delete old fixtures.
- `schema1-new-game.json` documents the template's original schema-1 shape
  (before the `kills` counter existed). It ships with the template as the
  worked example of the migration pattern.
- Tests overwrite the envelope's `game` id with the current slug, so renaming
  the project does not invalidate fixtures.
