# Clone playbook: from "I want X" to a playable personal remake

## Phase 0: Decide (15 min)

1. **Which build is the reference?** Platform + patch (e.g. "Dota 2 7.3x on PC" or "MLBB, Oct 2026").
   Mechanics change between patches; wikis often lag.
2. **What is the personal flavour?** Write one sentence of what deliberately differs (hybrid,
   removed grind, shorter matches, offline bots).
3. **Pick renderer and asset policy** (see [VISUAL_GUIDE.md](VISUAL_GUIDE.md) §2 and
   [ASSET_SOURCING.md](ASSET_SOURCING.md)). Public repo → `public-permissive` unless you accept share-alike.
4. Create an empty GitHub repo for the game, then inside it (see the bootstrap's AGENTS.md §A):
   ```sh
   node ../webgamedev-bootstrap/bootstrap.mjs . --renderer <canvas|phaser|three> \
     --policy <policy> --reference "<Game, build>"
   ```

## Phase 1: Recon (per system, before code)

Use the **clone-recon** skill inside the game. Output goes to `docs/FIDELITY.md`.

- Observe → write down → measure → mark as `observed`, `adapted`, `authored` or `unknown`.
- Frame-step recordings for timings (attack wind-up, cooldowns, respawn, wave intervals).
- Pixel-count 1× captures for sizes; sample palettes.
- Ask the user for anything you cannot observe that changes the feel.

## Phase 2: Core verb (rung 1)

Make the single most-repeated action feel right with placeholder art: movement + basic attack
for action games, placing a building for builders, issuing an order for tactics/crew games.
Tests: rule tests for the verb in `tests/sim/`; determinism, saves and soak are covered by the locked tests via `src/sim/testkit.ts`.

## Phase 3: Close the loop (rung 2)

Start → goal → win/lose → restart, even if tiny. Add a **bot** that plays the loop headlessly
(make `play()` in `src/sim/testkit.ts` a real bot). The bot becomes the
balance and soak driver: every new player action gets a line in the bot.

## Phase 4: Look (in parallel from rung 2)

Measure the reference look (ART_DIRECTION §1) → pick one pack family / pipeline → style gate →
evidence review → **player approves a baseline**. Do not mass-import art before approval.

## Phase 5: Persistence & progression (rung 3)

Every saved field: schema bump, migration, fixture. Export a real save before each bump.

## Phase 6: Breadth (rung 4)

Content as rows. Each row type has validator rules. Balance gates as ranges in tests
("bot reaches level 10 within 30 minutes in 3 of 3 seeds"), never exact numbers from one run.

## Phase 7: Polish & release (rung 5)

Audio (opt-in), juice that respects reduced motion, tutorial that advances on demonstrated
actions, offline install, credits complete, `check:full` green, Pages deploy verified.

## Working agreement with agents

- One rung at a time; each ends with `npm run check:full` and an evidence review if visuals changed.
- Agents report: what changed for the player, how it was verified, known limits (PR template).
- Unknown reference facts are written as unknown, never guessed silently.
