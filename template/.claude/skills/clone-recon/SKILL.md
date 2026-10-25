---
name: clone-recon
description: Study the reference game before implementing a system: gather dated sources, measure observable behaviour, and record observed vs authored values in docs/FIDELITY.md. Use when starting a new system or when the user asks to make something "like the original".
---

# Reference reconnaissance

1. Name the exact reference build (platform, patch/version, date). Wikis often describe old
   patches: note the patch each source describes.
2. Gather sources in priority order: (a) the user's own observations, captures or numbers;
   (b) the developer's patch notes and official docs; (c) community wikis and guides
   (dated); (d) video frame-stepping for timings and animation counts.
3. Measure what you can: count frames, time cooldowns from video, pixel-count sprite sizes on
   1× captures, sample palettes. Write the method next to each number.
4. Record everything in docs/FIDELITY.md: systems table and numbers table, with status
   `observed` / `adapted` / `authored` / `unknown`. Unknown is fine; invented "facts" are not.
5. Keep captures in `reference/` (git-ignored). Never commit the reference game's assets,
   text or data to a public repo, and never ship them unless the asset policy and the actual
   licence allow it.
6. Turn the findings into data rows (src/content) and focused rule tests (tests/sim) before
   writing renderer code.
7. Ask the user about anything that changes the feel and that you could not observe.
