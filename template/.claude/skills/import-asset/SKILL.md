---
name: import-asset
description: Import third-party or generated art/audio into this game with licence checks, provenance, style gate and credits. Use whenever adding or replacing any file under public/assets.
---

# Import an asset

1. **Licence first.** Open the author's primary page (itch.io / OpenGameArt / kenney.nl / GitHub
   repo) or the LICENSE file inside the download. Record the exact licence id. Check it is allowed
   by `assetPolicy` in `game.config.json` (table in docs/ASSETS.md). If it is not allowed, stop and
   tell the user; do not import "for now".
2. Download into `assets-src/<pack-id>/` (git-ignored). Never commit full packs.
3. **Style gate.** Build a contact sheet against an approved sprite:
   `npm run assets -- sheet /tmp/gate.png public/assets/sprites/atlas.png@0,0,1,1 assets-src/<pack>/<file>.png --grid 16 --scale 6`
   and LOOK at it. Compare projection, pixel density, outline, palette, light direction and
   proportions (docs/ART_DIRECTION.md §4). Report mismatches and how you adapted them.
4. Copy only the used files into `public/assets/<area>/`. Prefer packing frames into an atlas.
5. Add a pack entry in `public/assets/provenance.json` (id, title, author, source URL, license,
   licenseFile, attribution for CC-BY, modifications, generator for AI art), then
   `npm run assets -- add <pack-id> public/assets/<files...>`.
6. Copy the licence text to `public/assets/LICENSES/<pack-id>.txt`.
7. Reference the art from content data (sprite frame names), not hard-coded in renderers.
8. `npm run assets -- credits` and `npm run check`. Then `npm run evidence` and review in-game.
