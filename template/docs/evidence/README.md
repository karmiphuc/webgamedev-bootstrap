# Visual evidence

Automated tests prove behaviour; they cannot tell you whether the game *looks* right.
This is a LOCKED rule: the PR gate fails any PR that touches visual files (see `visual` in
`bootstrap.manifest.json`) unless the same PR adds or updates `docs/evidence/<version>/REVIEW.md`
with at least one linked image that exists and a filled `## Verdict`. For every visual change:

1. `npm run evidence` → captures every scene in `tests/e2e/evidence.spec.ts` on desktop,
   tablet and phone into `docs/evidence/v<version>/`.
2. For animation, also record a short clip of the dev build (screen recorder, or Playwright
   `video: "on"`), because stills hide foot sliding, popping and flicker.
3. Open the images. Compare with the approved baseline and the reference capture.
4. Write `docs/evidence/v<version>/REVIEW.md` using the template below. Commit the PNGs you
   refer to (prefer lossless WebP/PNG crops over full screenshots to keep the repo small).

```markdown
# Visual review v<version> — <scope>

Date · build commit · reviewer (human / agent)

## Compared against
Approved baseline vX.Y · reference capture (kept privately in reference/)

![start, desktop](start-desktop.png) ![start, phone](start-phone.png)

## Findings
1. P1/P2/P3 — <what is wrong or improved>, <where>, <evidence file>
2. …

## Checklist (docs/ART_DIRECTION.md §7)
- [ ] projection/scale/outline match baseline
- [ ] readable at phone size
- [ ] animation reviewed in motion
- [ ] equipment attached in all facings
- [ ] HUD clear of the action on all viewports

## Verdict

Accept / accept with follow-ups (#issues) / reject — one line, on the line after the heading
```

Known template finding (v0.1.0): on a portrait phone the landscape playfield uses about
a third of the screen. Choose per game: lock to landscape, rotate the world, use a follow
camera, or design a portrait layout.
