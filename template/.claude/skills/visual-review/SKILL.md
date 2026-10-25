---
name: visual-review
description: Review how the game looks after any visual, animation, HUD or layout change, using captured evidence on desktop, tablet and phone. Use before reporting visual work as done.
---

# Visual review

1. Make sure source/asset edits are finished first (captures of half-done work waste a cycle).
2. If the change needs a new scene, add it to `SCENES` in `tests/e2e/evidence.spec.ts`
   (seeded, paused, advanced with `g.step(n)`, set up with commands).
3. `npm run evidence` → `docs/evidence/v<version>/<scene>-<viewport>.png`.
4. Open every relevant image (Read tool). Also run `npm run dev` and watch motion for at least
   one full action cycle: stills hide foot sliding, popping, flicker and facing errors.
5. Compare against the approved baseline in docs/ART_DIRECTION.md and (privately) the reference
   capture. Go through the checklist in docs/ART_DIRECTION.md §7.
6. Write `docs/evidence/v<version>/REVIEW.md` with numbered findings (P1/P2/P3), the files that
   show them (relative image links) and a filled `## Verdict` line. The PR gate requires this for
   every PR touching visual files; commit the images you link. State what you could not verify (e.g. real-device performance).
7. If the golden image changed intentionally: `npx playwright test pixels --update-snapshots`,
   open the new PNG, and say in the review why it changed.
