#!/usr/bin/env node
// Asset pipeline gate. Usage (npm run assets -- <command>):
//
//   validate                  (default) provenance coverage, license policy,
//                             pinned hashes, pixel-art rules, size budgets
//   hash                      re-pin sha256 of every file listed in provenance
//   add <pack-id> <files...>  register files (paths under public/assets) in a pack
//   credits                   regenerate CREDITS.md from provenance
//   inspect <png...>          size, colours, soft-alpha pixels, opaque bbox
//   sheet <out.png> <png[@x,y,w,h]>... [--scale N] [--grid N]
//                             side-by-side contact sheet for style review
//
// Exit code 1 on any error. Warnings never fail the build.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, pixelStats } from "./png.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "public/assets");
const PROVENANCE = join(ASSETS, "provenance.json");
const config = JSON.parse(readFileSync(join(ROOT, "game.config.json"), "utf8"));

// License policy. Values are matched exactly against provenance `license`.
// See docs/ASSETS.md for why each one is allowed or denied.
export const POLICIES = {
  "public-permissive": {
    allow: ["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "OGA-BY-3.0", "MIT", "OFL-1.1", "project-original", "ai-generated"],
    deployPublic: true,
  },
  "public-sharealike": {
    allow: [
      "CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "OGA-BY-3.0", "MIT", "OFL-1.1", "project-original", "ai-generated",
      "CC-BY-SA-3.0", "CC-BY-SA-4.0", "GPL-2.0", "GPL-3.0",
    ],
    deployPublic: true,
  },
  "private-personal": {
    allow: [
      "CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "OGA-BY-3.0", "MIT", "OFL-1.1", "project-original", "ai-generated",
      "CC-BY-SA-3.0", "CC-BY-SA-4.0", "GPL-2.0", "GPL-3.0",
      "CC-BY-NC-3.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-3.0", "CC-BY-NC-SA-4.0", "personal-use-only", "reference-game-adapted",
    ],
    deployPublic: false,
  },
};
const NEEDS_ATTRIBUTION = /^(CC-BY|OGA-BY)/;
const NEEDS_SOURCE_URL = (lic) => !["project-original", "ai-generated"].includes(lic);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const posix = (p) => p.split(sep).join("/");

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function loadProvenance() {
  try {
    return JSON.parse(readFileSync(PROVENANCE, "utf8"));
  } catch (e) {
    console.error(`cannot read ${relative(ROOT, PROVENANCE)}: ${e.message}`);
    process.exit(1);
  }
}

function runtimeFiles() {
  return walk(ASSETS)
    .map((f) => posix(relative(ASSETS, f)))
    .filter((f) => f !== "provenance.json" && !f.startsWith("LICENSES/"))
    .sort();
}

function validate() {
  const prov = loadProvenance();
  const policyName = config.assetPolicy;
  const policy = POLICIES[policyName];
  if (!policy) err(`game.config.json assetPolicy "${policyName}" is not one of ${Object.keys(POLICIES).join(", ")}`);
  const owner = new Map();
  const ids = new Set();
  let placeholders = 0;

  for (const pack of prov.packs ?? []) {
    const where = `pack "${pack.id}"`;
    if (!pack.id) err("a pack has no id");
    if (ids.has(pack.id)) err(`${where} is listed twice`);
    ids.add(pack.id);
    for (const k of ["title", "author", "source", "license"]) if (!pack[k]) err(`${where} is missing "${k}"`);
    if (policy && pack.license && !policy.allow.includes(pack.license)) {
      err(`${where} license "${pack.license}" is not allowed by policy "${policyName}"`);
    }
    if (NEEDS_ATTRIBUTION.test(pack.license ?? "") && !pack.attribution) {
      err(`${where} (${pack.license}) needs an exact "attribution" string`);
    }
    if (NEEDS_SOURCE_URL(pack.license) && !/^https?:\/\//.test(pack.source ?? "")) {
      err(`${where} source must be the primary URL (author's itch.io / OpenGameArt / repo page)`);
    }
    if (pack.license === "ai-generated" && !pack.generator) {
      err(`${where} is ai-generated: record "generator" (tool, date, prompt summary, reference images used)`);
    }
    if (pack.licenseFile && !existsSync(join(ASSETS, pack.licenseFile))) {
      err(`${where} licenseFile ${pack.licenseFile} does not exist`);
    }
    if (NEEDS_SOURCE_URL(pack.license) && !pack.licenseFile) {
      warn(`${where} has no licenseFile: copy the license text into public/assets/LICENSES/`);
    }
    if (pack.placeholder) placeholders++;
    for (const [file, hash] of Object.entries(pack.files ?? {})) {
      if (owner.has(file)) err(`${file} is listed in both "${owner.get(file)}" and "${pack.id}"`);
      owner.set(file, pack.id);
      const full = join(ASSETS, file);
      if (!existsSync(full)) {
        err(`${where} lists missing file ${file}`);
        continue;
      }
      const actual = sha256(full);
      if (!hash) err(`${file} has no pinned sha256: run \`npm run assets -- hash\``);
      else if (hash !== actual) err(`${file} changed since its hash was pinned: verify the source, then \`npm run assets -- hash\``);
      checkFile(file, full, pack);
    }
  }

  for (const file of runtimeFiles()) {
    if (!owner.has(file)) err(`${file} is not covered by any provenance pack`);
  }

  const total = runtimeFiles().reduce((n, f) => n + statSync(join(ASSETS, f)).size, 0);
  if (total > config.budgets.assetBytes) err(`assets total ${total} bytes > budget ${config.budgets.assetBytes}`);
  if (placeholders) warn(`${placeholders} placeholder pack(s) still shipped`);
  if (policy && !policy.deployPublic) warn(`policy "${policyName}": public deploy is disabled; keep this repository private`);

  for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`assets: ${owner.size} files in ${ids.size} packs, ${(total / 1024).toFixed(0)} KB, ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

function checkFile(file, full, pack) {
  const ext = extname(file).toLowerCase();
  const size = statSync(full).size;
  if ([".mp3", ".ogg", ".wav", ".m4a"].includes(ext) && size > config.budgets.audioFileBytes) {
    warn(`${file} is ${size} bytes (audio budget ${config.budgets.audioFileBytes}); re-encode (music 96 kbps, sfx 64 kbps mono)`);
  }
  if (ext === ".wav") warn(`${file}: ship .mp3 or .ogg instead of .wav`);
  if (ext !== ".png") return;
  let img;
  try {
    img = decodePng(readFileSync(full));
  } catch (e) {
    err(`${file}: ${e.message}`);
    return;
  }
  const pixel = config.pixelArt?.enabled && pack.pixelArt !== false;
  if (!pixel) return;
  const stats = pixelStats(img);
  if (stats.softAlpha > 0) {
    err(`${file}: ${stats.softAlpha} semi-transparent pixels (pixel art needs hard 0/255 alpha; fix the export or set "pixelArt": false on the pack)`);
  }
  const tile = config.pixelArt.tileSize;
  if (tile && (img.width % tile || img.height % tile)) {
    warn(`${file}: ${img.width}x${img.height} is not a multiple of the ${tile}px grid`);
  }
  // Per-frame colour count when an atlas JSON sits next to the image.
  const atlasJson = full.replace(/\.png$/, ".json");
  const max = config.pixelArt.maxColorsPerSprite;
  if (max && existsSync(atlasJson)) {
    try {
      const atlas = JSON.parse(readFileSync(atlasJson, "utf8"));
      for (const [name, r] of Object.entries(atlas.frames ?? {})) {
        if (r.x + r.w > img.width || r.y + r.h > img.height) err(`${file}: frame "${name}" lies outside the image`);
        else {
          const s = pixelStats(img, r);
          if (s.colors > max) warn(`${file}: frame "${name}" uses ${s.colors} colours (style limit ${max})`);
          if (!s.opaque) warn(`${file}: frame "${name}" is empty`);
        }
      }
    } catch (e) {
      err(`${relative(ASSETS, atlasJson)}: ${e.message}`);
    }
  }
}

function hash() {
  const prov = loadProvenance();
  let changed = 0;
  for (const pack of prov.packs) {
    for (const file of Object.keys(pack.files ?? {})) {
      const full = join(ASSETS, file);
      if (!existsSync(full)) {
        console.log(`missing ${file} (pack ${pack.id})`);
        continue;
      }
      const h = sha256(full);
      if (pack.files[file] !== h) {
        pack.files[file] = h;
        changed++;
      }
    }
  }
  writeFileSync(PROVENANCE, JSON.stringify(prov, null, 2) + "\n");
  console.log(`pinned ${changed} hash(es)`);
}

function add(packId, files) {
  const prov = loadProvenance();
  const pack = prov.packs.find((p) => p.id === packId);
  if (!pack) {
    console.error(`no pack "${packId}" in provenance.json; add the pack entry (source, author, license) first`);
    process.exit(1);
  }
  pack.files ??= {};
  for (const f of files) {
    const rel = posix(relative(ASSETS, resolve(f)));
    if (rel.startsWith("..")) {
      console.error(`${f} is outside public/assets`);
      process.exit(1);
    }
    pack.files[rel] = sha256(join(ASSETS, rel));
    console.log(`added ${rel} -> ${packId}`);
  }
  pack.files = Object.fromEntries(Object.entries(pack.files).sort());
  writeFileSync(PROVENANCE, JSON.stringify(prov, null, 2) + "\n");
}

function credits() {
  const prov = loadProvenance();
  const lines = [
    `# Credits — ${config.name}`,
    "",
    "Generated from `public/assets/provenance.json` by `npm run assets -- credits`. Do not edit by hand.",
    "",
  ];
  if (config.reference?.game) {
    lines.push(
      `This is an unofficial, non-commercial fan remake inspired by *${config.reference.game}*. It is not affiliated with or endorsed by its creators.`,
      "",
    );
  }
  lines.push("| Asset pack | Author | License | Source | Changes |", "| --- | --- | --- | --- | --- |");
  for (const p of prov.packs) {
    const credit = p.attribution ? `${p.author} — ${p.attribution}` : p.author;
    lines.push(`| ${p.title}${p.placeholder ? " (placeholder)" : ""} | ${credit} | ${p.license} | ${p.source} | ${p.modifications || "none"} |`);
  }
  writeFileSync(join(ROOT, "CREDITS.md"), lines.join("\n") + "\n");
  console.log("wrote CREDITS.md");
}

function inspect(files) {
  for (const f of files) {
    const img = decodePng(readFileSync(f));
    const s = pixelStats(img);
    console.log(
      `${f}: ${img.width}x${img.height} type ${img.info.colorType}/${img.info.bitDepth}` +
        ` colours ${s.colors} soft-alpha ${s.softAlpha} opaque ${s.opaque}` +
        ` bbox ${s.bbox ? `${s.bbox.x},${s.bbox.y} ${s.bbox.w}x${s.bbox.h}` : "empty"}`,
    );
  }
}

function sheet(out, specs, scale, grid) {
  const tiles = specs.map((spec) => {
    const [file, rectText] = spec.split("@");
    const img = decodePng(readFileSync(file));
    let r = { x: 0, y: 0, w: img.width, h: img.height };
    if (rectText) {
      const [x, y, w, h] = rectText.split(",").map(Number);
      r = grid ? { x: x * grid, y: y * grid, w: w * grid, h: h * grid } : { x, y, w, h };
    }
    return { img, r };
  });
  const pad = 4 * scale;
  const width = tiles.reduce((n, t) => n + t.r.w * scale + pad, pad);
  const height = Math.max(...tiles.map((t) => t.r.h * scale)) + pad * 2;
  const rgba = new Uint8Array(width * height * 4);
  // Checkerboard reveals stray semi-transparent or off-palette pixels.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const v = ((x >> 3) + (y >> 3)) % 2 ? 200 : 168;
      rgba.set([v, v, v, 255], (y * width + x) * 4);
    }
  let ox = pad;
  for (const { img, r } of tiles) {
    for (let y = 0; y < r.h * scale; y++)
      for (let x = 0; x < r.w * scale; x++) {
        const sx = r.x + Math.floor(x / scale);
        const sy = r.y + Math.floor(y / scale);
        const si = (sy * img.width + sx) * 4;
        const a = img.data[si + 3] / 255;
        if (!a) continue;
        const di = ((pad + y) * width + ox + x) * 4;
        for (let c = 0; c < 3; c++) rgba[di + c] = Math.round(img.data[si + c] * a + rgba[di + c] * (1 - a));
      }
    ox += r.w * scale + pad;
  }
  writeFileSync(out, encodePng(width, height, rgba));
  console.log(`wrote ${out} (${width}x${height}, ${tiles.length} images at ${scale}x)`);
}

const [cmd = "validate", ...rest] = process.argv.slice(2);
const flag = (name, def) => {
  const i = rest.indexOf(name);
  if (i < 0) return def;
  const v = Number(rest[i + 1]);
  rest.splice(i, 2);
  return v;
};
switch (cmd) {
  case "validate":
    validate();
    break;
  case "hash":
    hash();
    break;
  case "add":
    add(rest[0], rest.slice(1));
    break;
  case "credits":
    credits();
    break;
  case "inspect":
    inspect(rest);
    break;
  case "sheet": {
    const scale = flag("--scale", 4);
    const grid = flag("--grid", 0);
    sheet(rest[0], rest.slice(1), scale, grid);
    break;
  }
  default:
    console.error(`unknown command "${cmd}"`);
    process.exit(1);
}
