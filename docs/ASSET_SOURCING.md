# Where to find assets, and what their licences usually are

Licences are **per asset**. The "usual licence" column is a starting expectation, never a
substitute for reading the licence on the author's page or in the download. Record what you
actually found in `public/assets/provenance.json`.

| Source | Content | Usual licence | Notes |
| --- | --- | --- | --- |
| kenney.nl | 2D/3D packs, UI, audio | CC0 | consistent styles across packs; first stop for prototypes (Wayfarer, Ashen audio) |
| Ninja Adventure (Pixel-boy & AAA, itch.io) | 16 px top-down tiles, characters, monsters, UI, music, SFX | CC0 | Wayfarer v2's main art family |
| OpenGameArt.org | everything | mixed: CC0, CC-BY, CC-BY-SA, GPL, OGA-BY | check each entry; many LPC assets are CC-BY-SA/GPL (needs `public-sharealike`) |
| itch.io asset pages | pixel packs, tilesets, UI, audio | set by each creator (CC0, CC-BY, custom "free for personal/commercial use") | custom licences often forbid redistributing raw files: check before committing to a public repo |
| Flare art sources (flareteam on GitHub/OGA) | rigged 3D characters/creatures | per asset; Emberfall used CC-BY 3.0 rigs | pin the revision; some items in the set are CC-BY-SA (Emberfall excluded them) |
| 0 A.D. art (Wildfire Games) | 3D meshes/textures | CC-BY-SA 3.0 | Ashen rendered monuments from it |
| Quaternius, KayKit (Kay Lousberg) | low-poly 3D characters, environments | CC0 (verify per pack) | good fit for the `three` preset |
| Poly Pizza | low-poly 3D models | mixed CC0 / CC-BY | attribution string per model |
| ambientCG | PBR textures, HDRIs | CC0 | Emberfall used a texture dependency from it |
| Lospec | palettes, pixel tutorials | palettes free to use | pick a palette before recolouring packs |
| Freesound | SFX recordings | mixed CC0 / CC-BY / CC-BY-NC | NC is not allowed under public policies |
| Google Fonts | UI fonts | OFL-1.1 / Apache-2.0 | bundle the font file for offline play |
| Original game files, mods, rips | reference look | proprietary | never in a public repo; `private-personal` only, with recorded terms |

## Licence → policy quick map

| Licence | public-permissive | public-sharealike | private-personal | Obligation |
| --- | --- | --- | --- | --- |
| CC0-1.0 | ✓ | ✓ | ✓ | none (credit anyway) |
| CC-BY-3.0 / 4.0, OGA-BY-3.0 | ✓ | ✓ | ✓ | exact attribution, shown in Credits |
| MIT, OFL-1.1 | ✓ | ✓ | ✓ | keep licence text |
| CC-BY-SA-3.0 / 4.0, GPL | ✗ | ✓ | ✓ | adaptations stay under the same licence |
| CC-BY-NC-* | ✗ | ✗ | ✓ | non-commercial only |
| "personal use only" / proprietary / ripped | ✗ | ✗ | ✓ (`personal-use-only`, `reference-game-adapted`) | private repo, no public deploy |
| unknown / no licence | ✗ | ✗ | ✗ | no licence = no permission |

## Recording a find

```json
{
  "id": "na-monsters",
  "title": "Ninja Adventure — monsters",
  "author": "Pixel-boy & AAA",
  "source": "https://pixel-boy.itch.io/ninja-adventure-asset-pack",
  "license": "CC0-1.0",
  "licenseFile": "LICENSES/ninja-adventure.txt",
  "attribution": "",
  "modifications": "Packed 12 monster sheets into sprites/monsters.png; no pixel edits",
  "files": {}
}
```

Then `npm run assets -- add na-monsters public/assets/sprites/monsters.png`.
