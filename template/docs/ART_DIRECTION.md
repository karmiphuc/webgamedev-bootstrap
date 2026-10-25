# Art direction — {{GAME_NAME}}

Status: **draft until approved by the player.** Once you approve a look in-game, write
"Approved baseline: vX.Y" below. From then on, every visual change must either extend
that baseline or show a side-by-side in-game comparison before it replaces it.

Approved baseline: _(none yet)_

## 1. Reference study

Reference game: {{REFERENCE_GAME}}. Keep reference captures in `reference/` (git-ignored,
never committed: they are someone else's copyrighted work). Describe what you observe
here in words and numbers.

| Property | Observed in reference | Our target | How measured |
| --- | --- | --- | --- |
| Camera / projection | e.g. top-down 3/4, isometric 2:1, side view, angled 3D | | screenshot + grid overlay |
| Base sprite / tile size | e.g. 16 px tiles, characters 16×24 | | crop and count pixels at 1× |
| On-screen scale | e.g. 3× on a 1080p screen | | |
| Outline | e.g. 1 px dark, selective, none | | |
| Palette | count, saturation, shadow hue shift | | colour-picker samples |
| Lighting | flat, fixed top-left, baked, dynamic | | |
| Animation | frames per walk / attack / idle, fps, facings (4/8/16) | | frame-step a recording |
| UI | frame style, font, icon size, HUD layout | | |
| Readability | how allies / enemies / loot / danger are told apart | | |

## 2. The look in one paragraph

_Describe the intended mood and identity: materials, palette temperature, silhouette rules,
what must read at a glance (e.g. "enemies always have a red-orange accent; loot sparkles
gold; the player is the only blue")._

## 3. Hard rules (enforced by tools and tests)

| Rule | Enforced by |
| --- | --- |
| Every runtime file has provenance and an allowed licence | `npm run assets` |
| Pixel art uses hard alpha (0 or 255 only) | `npm run assets` (`softAlpha`) |
| Sprites at integer scale, no smoothing, snapped to source pixels | `tests/e2e/pixels.spec.ts` |
| Per-frame colour count ≤ `pixelArt.maxColorsPerSprite` | `npm run assets` (warning) |
| Sprite sizes on the `pixelArt.tileSize` grid | `npm run assets` (warning) |
| A known scene renders pixel-identically | golden image in `tests/e2e/__screenshots__` |
| Game view fits desktop, tablet and phone with no horizontal scroll | `tests/e2e/smoke.spec.ts` |

## 4. Style gate (before importing ANY new art)

Mixing packs is the most common way these remakes start to look cheap: isometric buildings
on top-down grass, different outline weights, fractional scaling, muted next to saturated.

1. Make a contact sheet next to an approved sprite, at the game's scale:
   `npm run assets -- sheet /tmp/gate.png public/assets/sprites/atlas.png@0,0,1,1 <new.png>@0,0,1,1 --grid 16 --scale 6`
2. Accept only if ALL match the approved baseline: projection/view angle, pixel density
   (same source px per world unit), outline weight and colour, palette saturation and
   value range, light direction, proportions (chibi vs. realistic).
3. If one property is off, adapt it (recolour, re-outline, crop, redraw) when the licence
   allows modification. Record the change in the pack's `modifications`.
4. Check the art IN THE GAME at normal scale, among existing actors, not only on the sheet.

## 5. Characters and animation

- Keep camera scale, light and ground origin (feet anchor) fixed across every action of an
  actor. Crop transparent margins without resizing pixels; store the anchor offset per frame.
- Equipment shares the body's rig or has explicit per-frame hand/grip anchors. Check both
  hands, the grip and the full weapon arc in every facing.
- Facing changes on horizontal movement; vertical-only movement keeps the last facing.
- Attacks read as anticipation → contact → recovery. Gameplay damage happens on the contact
  frame (sync the event, not a timer).
- Idle is a stable pose. Walk speed matches the stride (no foot sliding).
- Separate inventory icons from worn/in-world art: never squeeze an icon onto a body.

## 6. UI

- Readability beats pixel-font purity: body text ≥ 14 CSS px, touch targets ≥ 40 px.
- Never encode status by colour alone (add icon or shape).
- Keep routine notifications off the playfield; reserve the centre for play.
- Honour `prefers-reduced-motion` (no screen shake or flashing).

## 7. Review checklist (every visual change)

Run `npm run evidence`, open the captures, then answer in `docs/evidence/v<version>/REVIEW.md`:

- [ ] Same projection, scale and outline as the baseline?
- [ ] Silhouettes readable at phone size? Player, enemies and loot distinguishable at a glance?
- [ ] Animation checked in motion (dev build): walk, stop, turn, attack, hit, death, in several facings?
- [ ] Weapons and equipment attached in every facing and action?
- [ ] Several copies on screen at once look correct (no shared-state corruption)?
- [ ] HUD does not cover the action on phone, tablet and desktop?
- [ ] Compared side by side with the reference capture: what is closer, what is still off?
