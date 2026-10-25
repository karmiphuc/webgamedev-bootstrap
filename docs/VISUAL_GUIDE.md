# Visual guide: replicating a game's look with free and generated art

The per-game contract is `template/docs/ART_DIRECTION.md` (copied into every game). This guide
explains how to choose a pipeline and keep a clone visually coherent.

## 1. First, measure the reference

Before collecting any art, capture the reference at 1× (no scaling filter) and measure:

| Measure | How |
| --- | --- |
| Projection | top-down 3/4, side view, isometric 2:1 (dimetric), true 3D with fixed camera |
| Native pixel density | crop a character and count pixels per tile/body; find the integer upscale the game uses |
| Facings | 4 / 8 / 16 directions; mirrored or authored per side |
| Frame counts and fps | frame-step a screen recording of walk, attack, idle, death |
| Palette | sample 20–40 colours; note shadow hue shift and saturation range |
| Outline | none / 1 px dark / coloured selout |
| UI | frame style, font size at 1×, icon size, HUD placement on phone vs desktop |

Write the numbers in the game's ART_DIRECTION §1. They become the acceptance criteria for every
asset you add. Keep captures in `reference/` (git-ignored).

## 2. Choose a pipeline by projection

| Reference look | Pipeline | Renderer preset | Notes from your projects |
| --- | --- | --- | --- |
| 16–32 px top-down pixel (Kairosoft, Zelda-likes, DV2) | one CC0 pixel family (e.g. Ninja Adventure, Kenney) + recolour/redraw | `canvas` | Wayfarer: one 16 px family, dark 1 px outline, integer scale, atlas packing |
| Side-view pixel crew/ship (Pixel Piracy) | authored or generated source → hard-edge quantise → per-pose atlases with hand anchors | `phaser` or `canvas` | Pirate: generated source converted to hard-edge cells, weapons as separate layers with grip points |
| Isometric ARPG (Diablo II) | rigged 3D models rendered to directional sprite atlases with a fixed camera | `three` (billboards) or `canvas` | Emberfall: Blender + three.js bake, 8/16 facings, fixed root/scale/light, trimmed but never resized |
| Tactical portraits/layers (Battle Brothers) | layered paper-doll PNGs with anchors | `canvas` | Ashen: separate worn layer vs inventory icon; preserve original perspective |
| 3D MOBA / action (Dota, MLBB) | low-poly CC0 GLB models (Quaternius, KayKit, Kenney 3D) or billboards to start | `three` | start with billboards for gameplay; swap to GLB once the loop is fun |

## 3. Pipelines in detail

### 3.1 Pixel pack + adaptation (cheapest, most coherent)
1. Pick **one** primary pack family that matches projection and pixel density.
2. Fill gaps from other packs only after the style gate (contact sheet at game scale).
3. Adapt: palette-map to the primary palette, re-outline to the same weight/colour, crop or
   pad to the grid. Record every change in provenance `modifications`.
4. Pack into atlases (one request instead of hundreds); frame names are the contract with content data.

### 3.2 3D → sprite bake (Emberfall approach)
- Rig and animate in Blender (or use CC0/CC-BY rigged models). Render each action from N
  facings with an orthographic camera at a **fixed** scale, light and ground origin.
- Trim transparent margins **without resizing**; store each frame's anchor offset in the atlas JSON.
- Sample walks by displacement so stride matches movement speed (no foot sliding).
- Keep source `.blend`/GLB files outside git; pin the source revision and dependency hashes.
- Review in motion, in-game, with several copies on screen.

### 3.3 Generated art (Pirate approach)
- Allowed under every policy as `ai-generated` **with a generator record** (tool, date, prompt
  summary, reference images used). Do not feed the reference game's copyrighted captures in as
  image prompts for shipped art.
- Generated images are rarely true pixel art: quantise to the target palette, remove soft alpha
  (the asset gate rejects it), downscale with nearest-neighbour to the native density, then
  hand-fix outlines.
- Use generation for backdrops, portraits and concept sheets first; characters that animate need
  consistent frames, which generation is poor at.

### 3.4 Godot / Unity / itch.io sources
- Engine asset stores and itch.io pages host many licences. The licence is per asset: read it on
  the author's page or in the bundled LICENSE. Export to PNG/GLB/OGG; no engine files at runtime.
- Godot `.tres`/`.tscn` animation data does not transfer; re-express frame timings in your atlas JSON.

## 4. Coherence rules (summary)

1. One projection, one pixel density, one outline rule, one light direction.
2. Integer scale only; no smoothing; snap to source pixels (enforced by `pixels.spec.ts`).
3. Silhouette and a controlled accent colour carry identity (player vs enemy vs loot).
4. Equipment is a separate layer with anchors, or shares the body rig.
5. UI readability over pixel-font purity (≥ 14 CSS px, ≥ 40 px touch targets).
6. Approve a baseline in-game; afterwards change it only with a side-by-side comparison.

## 5. Review loop

`npm run evidence` → open captures on desktop/tablet/phone → watch motion in `npm run dev` →
write `docs/evidence/v<version>/REVIEW.md` with P1/P2/P3 findings → fix → repeat.
The golden image (canvas) guards against accidental pixel changes between reviews.
