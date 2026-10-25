# Assets: licences, provenance and pipeline

This game's asset policy is `assetPolicy` in `game.config.json` (enforced by
`npm run assets`). Credits are generated into `CREDITS.md` and shown in-game (Menu → Credits).

## 1. Policies

| Policy | Allowed licences | Deploy | Use when |
| --- | --- | --- | --- |
| `public-permissive` | CC0-1.0, CC-BY-3.0/4.0, OGA-BY-3.0, MIT, OFL-1.1, `project-original`, `ai-generated` | public GitHub Pages OK | default; the repo is public |
| `public-sharealike` | the above + CC-BY-SA-3.0/4.0, GPL-2.0/3.0 | public OK | you accept share-alike: adapted assets stay under the same licence |
| `private-personal` | the above + CC-BY-NC-*, `personal-use-only`, `reference-game-adapted` | **never public**; the CI deploy job refuses | strictly personal offline play in a private repo |

Notes:
- A licence applies **per asset**, not per website. itch.io and OpenGameArt host every kind
  of licence; read the licence on the author's page or the LICENSE file inside the download.
  A mirror's README is not enough.
- "Free to download" or "free for personal use" is not permission to redistribute in a public repo.
- Adapted art from a commercial game or its mods (`reference-game-adapted`) is only acceptable
  under `private-personal`, and even then record the exact source and terms. Making a personal
  remake does not grant a licence.
- CC-BY needs the exact attribution string (`attribution` field); it is shown in Credits.
- `ai-generated` needs a `generator` record: tool, date, prompt summary, and any reference
  images used. Do not feed copyrighted reference captures into generation for shipped art.

## 2. Provenance register (`public/assets/provenance.json`)

One entry per source pack:

```json
{
  "id": "kenney-tiny-dungeon",
  "title": "Tiny Dungeon",
  "author": "Kenney",
  "source": "https://kenney.nl/assets/tiny-dungeon",
  "license": "CC0-1.0",
  "licenseFile": "LICENSES/kenney-tiny-dungeon.txt",
  "attribution": "",
  "modifications": "Recoloured outlines to #181425; packed into sprites/atlas.png",
  "files": { "sprites/dungeon.png": "<sha256 pinned by npm run assets -- hash>" }
}
```

The validator fails when a runtime file is not covered, a licence is not allowed by the policy,
a hash changed without re-pinning (silent replacement), a source URL is missing, CC-BY has no
attribution, or AI art has no generator record.

## 3. Pipeline

1. Download the source pack to `assets-src/` (git-ignored). Large `.blend`, `.psd`, `.aseprite`
   and full packs stay out of git; record how to re-fetch them in the pack's `source` / `modifications`.
2. Pass the style gate (docs/ART_DIRECTION.md §4).
3. Copy only the files you use into `public/assets/...` (or pack them into an atlas).
4. Add or extend the pack entry, then: `npm run assets -- add <pack-id> public/assets/<files...>`
5. Copy the licence text to `public/assets/LICENSES/<pack-id>.txt`.
6. `npm run assets -- credits`, then `npm run check`.

## 4. Formats and budgets

| Kind | Format | Budget / rule |
| --- | --- | --- |
| Pixel sprites, tiles | PNG, non-interlaced, hard alpha | grid = `pixelArt.tileSize`; pack frames into atlases (fewer requests) |
| Painted / rendered sprites | PNG or WebP | set `"pixelArt": false` on the pack; keep a fixed scale per actor |
| 3D models | GLB (glTF binary) | record poly count; pin the source revision |
| Music | MP3 or OGG, ~96 kbps stereo | one track loaded at a time |
| SFX | MP3 or OGG, ~64 kbps mono, < 1 s | `budgets.audioFileBytes` per file |
| Total shipped assets | — | `budgets.assetBytes` |

## 5. Tools

```
npm run assets -- validate                 # the gate (also part of npm run check)
npm run assets -- hash                     # re-pin hashes after a deliberate change
npm run assets -- add <pack> <files...>    # register files
npm run assets -- credits                  # regenerate CREDITS.md
npm run assets -- inspect <png...>         # size, colours, soft-alpha pixels, bbox
npm run assets -- sheet <out.png> <png[@x,y,w,h]>... --grid 16 --scale 6   # contact sheet
node tools/make-placeholders.mjs           # regenerate the starter placeholder atlas
```
