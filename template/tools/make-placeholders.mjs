// Writes the starter sprite atlas (public/assets/sprites/atlas.png + .json)
// from the ASCII pixel grids below. These are SELF-AUTHORED PLACEHOLDERS so
// the template runs out of the box; replace them with your chosen pack and
// update public/assets/provenance.json. Run: node tools/make-placeholders.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/assets/sprites");

// One shared palette keeps the placeholders coherent (dark 1px outline).
const PALETTE = {
  ".": null,
  k: [24, 20, 37], // outline
  s: [234, 186, 140], // skin
  b: [44, 110, 196], // tunic
  B: [26, 70, 140],
  h: [120, 72, 40], // hair
  w: [236, 236, 236],
  g: [96, 196, 92], // slime
  G: [52, 132, 64],
  p: [130, 90, 170], // bat
  P: [82, 52, 118],
  r: [220, 60, 60],
  t: [74, 140, 70], // grass
  T: [62, 122, 60],
  u: [92, 160, 82],
};

const SPRITES = {
  hero: [
    "................",
    "......kkkk......",
    ".....khhhhk.....",
    "....khhhhhhk....",
    "....khssssk.....",
    "....ksksksk.....",
    "....kssssskk....",
    ".....kkssk......",
    "....kbbbbbbk....",
    "...kbbbbbbbbk...",
    "...kskBbbBksk...",
    "....kkBbbBkk....",
    ".....kBBBBk.....",
    ".....kBkkBk.....",
    ".....kkk.kkk....",
    "................",
  ],
  slime: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kkggggkk....",
    "...kgggwggggk...",
    "..kggwwggggggk..",
    "..kgggggggggGk..",
    ".kggkwggkwggGGk.",
    ".kggkkggkkgGGGk.",
    ".kGggggggggGGGk.",
    "..kGGGGGGGGGGk..",
    "...kkkkkkkkkk...",
    "................",
  ],
  bat: [
    "................",
    "................",
    "................",
    ".k............k.",
    ".kk....kk....kk.",
    ".kpk..kppk..kpk.",
    ".kppkkpppPkkPpk.",
    ".kpppkrpprkpppk.",
    "..kpppppppPPPk..",
    "..kpPkpppPkPPk..",
    "...kk.kPPk.kk...",
    "......kwwk......",
    ".......kk.......",
    "................",
    "................",
    "................",
  ],
  grass: [
    "tttttttttttttttt",
    "tttttTtttttttttt",
    "ttttTutttttttTtt",
    "tttttttttttttutt",
    "tttttttttttttttt",
    "ttTtttttttttttTt",
    "tTuttttttTtttutt",
    "tttttttttutttttt",
    "tttttttttttttttt",
    "tttttttttttTtttt",
    "ttttttTttttuTttt",
    "tttttTutttttttTt",
    "tttttttttttttutt",
    "ttTttttttttttttt",
    "tTutttttttTttttt",
    "ttttttttttuttttt",
  ],
};

const TILE = 16;
const names = Object.keys(SPRITES);
const width = TILE * names.length;
const height = TILE;
const rgba = new Uint8Array(width * height * 4);
const frames = {};
names.forEach((name, i) => {
  const rows = SPRITES[name];
  if (rows.length !== TILE || rows.some((r) => r.length !== TILE)) throw new Error(`${name} is not ${TILE}x${TILE}`);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!(ch in PALETTE)) throw new Error(`${name}: unknown palette key "${ch}"`);
      const c = PALETTE[ch];
      if (!c) return;
      const o = (y * width + i * TILE + x) * 4;
      rgba.set([c[0], c[1], c[2], 255], o);
    });
  });
  frames[name] = { x: i * TILE, y: 0, w: TILE, h: TILE };
});

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "atlas.png"), encodePng(width, height, rgba));
writeFileSync(join(OUT, "atlas.json"), JSON.stringify({ image: "atlas.png", tile: TILE, frames }, null, 2) + "\n");
console.log(`wrote ${names.length} sprites -> public/assets/sprites/atlas.png`);
