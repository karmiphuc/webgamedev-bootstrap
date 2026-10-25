#!/usr/bin/env node
// webgamedev-bootstrap: ONE idempotent command.
//
//   node bootstrap.mjs [dir] [options]
//
// - dir has no bootstrap.lock.json  -> INIT: create the game in place (an existing
//   .git, README, LICENSE, .gitignore are fine), install, print next steps.
// - dir has bootstrap.lock.json     -> SYNC: bring locked + kernel files up to date
//   where the game has not edited them; never touch game-owned files; report
//   conflicts (upstream copy written to .bootstrap/incoming/<path>).
// Running it again with the same bootstrap version changes nothing.
//
// Options:
//   --name "<Name>"        game name (default: from the git remote or folder name)
//   --slug <slug>          url/repo-safe id (default: from the name)
//   --renderer <name>      canvas (default) | phaser | three          (init only)
//   --policy <name>        public-permissive (default) | public-sharealike | private-personal (init only)
//   --reference "<game>"   the game being studied (init only)
//   --check                dry run: report what would change; exit 1 if anything would, 3 on conflicts
//   --resolved <path|all>  after merging a conflict by hand: accept your version as up to date
//   --no-install           skip npm ci / npm install
//   --force                init into a folder that already has other files
//   --list                 renderers and asset policies
//
// Exit codes: 0 done / up to date, 1 error (or --check found pending changes), 3 conflicts.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template");
const PRESETS = join(HERE, "presets");
const { classify } = await import(pathToFileURL(join(TEMPLATE, "tools/glob.mjs")).href);
const RENDERERS = ["canvas", ...readdirSync(PRESETS).filter((d) => existsSync(join(PRESETS, d, "preset.json")))];
const POLICIES = ["public-permissive", "public-sharealike", "private-personal"];
const SKIP_NAMES = new Set(["node_modules", "dist", "test-results", "playwright-report", ".bootstrap", "CREDITS.md"]);
const PREEXISTING_OK = /^(\.git|\.gitignore|\.gitattributes|README(\.md)?|LICEN[CS]E(\.md|\.txt)?|\.DS_Store)$/i;
const LOCK = "bootstrap.lock.json";

// ---------------------------------------------------------------- helpers
const die = (msg, code = 1) => {
  console.error(`error: ${msg}`);
  process.exit(code);
};
const hashBuf = (buf) => createHash("sha256").update(buf).digest("hex");
const hashFile = (file) => (existsSync(file) ? hashBuf(readFileSync(file)) : null);
const posix = (p) => p.split(sep).join("/");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const stable = (v) =>
  Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const jsonText = (data) => JSON.stringify(data, null, 2) + "\n";
/** Write only when content differs. Returns true if written. */
function writeIfChanged(file, text) {
  if (existsSync(file) && readFileSync(file, "utf8") === text) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return true;
}
function copyFile(src, dst) {
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  chmodSync(dst, statSync(src).mode & 0o777);
}
function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_NAMES.has(name)) return [];
    const full = join(dir, name);
    const rel = posix(relative(base, full));
    if (statSync(full).isDirectory()) return /^docs\/evidence\/v/.test(rel) ? [] : walk(full, base);
    return [rel];
  });
}
const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
const run = (cwd, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) die(`${cmd} ${args.join(" ")} failed in ${cwd}`);
};
const titleCase = (s) =>
  s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function bootstrapInfo() {
  const commit = git(HERE, "rev-parse", "HEAD") ?? "unknown";
  let repo = git(HERE, "remote", "get-url", "origin") ?? "https://github.com/karmiphuc/webgamedev-bootstrap";
  repo = repo.replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "").replace(/\/\/[^@/]+@/, "//");
  // Some sandboxes rewrite the remote to a local proxy; keep the public URL.
  if (!/^https:\/\/github\.com\//.test(repo)) repo = "https://github.com/karmiphuc/webgamedev-bootstrap";
  return { repo, commit };
}

// --------------------------------------------------------------- args
function parseArgs(argv) {
  const o = { install: true, force: false, check: false, resolved: [], list: false };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i] ?? die(`${a} needs a value`);
    if (a === "--name") o.name = val();
    else if (a === "--slug") o.slug = val();
    else if (a === "--renderer") o.renderer = val();
    else if (a === "--policy") o.policy = val();
    else if (a === "--reference") o.reference = val();
    else if (a === "--resolved") o.resolved.push(val());
    else if (a === "--check") o.check = true;
    else if (a === "--no-install") o.install = false;
    else if (a === "--force") o.force = true;
    else if (a === "--list") o.list = true;
    else if (a === "--git") {
      /* accepted for compatibility; agents commit on a branch themselves */
    } else if (a === "--help" || a === "-h") o.help = true;
    else if (a.startsWith("--")) die(`unknown option ${a}`);
    else pos.push(a);
  }
  o.dir = resolve(pos[0] ?? ".");
  return o;
}

// --------------------------------------------------------------- shared
function templateManifest() {
  return readJson(join(TEMPLATE, "bootstrap.manifest.json"));
}
/** Upstream locked+kernel files with their source paths (preset files are game-owned). */
function upstreamTracked(manifest) {
  const cls = classify(manifest);
  const out = new Map();
  for (const f of walk(TEMPLATE)) if (cls(f) !== "game") out.set(f, join(TEMPLATE, f));
  return out;
}
function packageBaseline(manifest, pkg) {
  const pick = (section, keys) => Object.fromEntries(keys.filter((k) => pkg[section]?.[k] !== undefined).map((k) => [k, pkg[section][k]]));
  return { scripts: pick("scripts", manifest.kernelPackage.scripts), devDependencies: pick("devDependencies", manifest.kernelPackage.devDependencies) };
}

// --------------------------------------------------------------- init
function init(o) {
  const target = o.dir;
  mkdirSync(target, { recursive: true });
  const extra = readdirSync(target).filter((f) => !PREEXISTING_OK.test(f));
  if (extra.length && !o.force) die(`${target} already has files (${extra.slice(0, 5).join(", ")}); use --force to bootstrap into it anyway`);

  const renderer = o.renderer ?? "canvas";
  const policy = o.policy ?? "public-permissive";
  if (!RENDERERS.includes(renderer)) die(`renderer must be one of ${RENDERERS.join(", ")}`);
  if (!POLICIES.includes(policy)) die(`policy must be one of ${POLICIES.join(", ")}`);
  const remote = git(target, "remote", "get-url", "origin");
  const remoteName = remote ? basename(remote).replace(/\.git$/, "") : null;
  const name = o.name ?? titleCase(remoteName ?? basename(target));
  const slug = o.slug ?? slugify(remoteName ?? name);
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) die(`slug "${slug}" must be lowercase letters, digits and dashes (use --slug)`);

  // Preserve an existing substantial README; replace a trivial one.
  const readmePath = join(target, "README.md");
  const oldReadme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : null;
  const keepReadme = oldReadme !== null && oldReadme.split("\n").filter((l) => l.trim()).length > 3;
  const oldIgnore = existsSync(join(target, ".gitignore")) ? readFileSync(join(target, ".gitignore"), "utf8") : "";

  for (const f of walk(TEMPLATE)) {
    if (f === "README.md" && keepReadme) continue;
    copyFile(join(TEMPLATE, f), join(target, f));
  }
  // .gitignore = union of the existing one and the template's
  const ignoreLines = [...new Set([...oldIgnore.split("\n"), ...readFileSync(join(TEMPLATE, ".gitignore"), "utf8").split("\n"), ".bootstrap/"].map((l) => l.trimEnd()))].filter(Boolean);
  writeFileSync(join(target, ".gitignore"), ignoreLines.join("\n") + "\n");

  const pkgPath = join(target, "package.json");
  const pkg = readJson(pkgPath);
  let lockSource = join(TEMPLATE, "package-lock.json");
  if (renderer !== "canvas") {
    const presetDir = join(PRESETS, renderer);
    const preset = readJson(join(presetDir, "preset.json"));
    for (const f of walk(presetDir)) if (f !== "preset.json" && f !== "package-lock.json") copyFile(join(presetDir, f), join(target, f));
    pkg.dependencies = stable({ ...(pkg.dependencies ?? {}), ...preset.dependencies });
    pkg.devDependencies = stable({ ...pkg.devDependencies, ...preset.devDependencies });
    writeFileSync(join(target, "src/render/index.ts"), `// The active renderer (chosen at bootstrap; a default: see docs/CHARTER.md).\nexport { createRenderer } from "${preset.rendererModule}";\n`);
    rmSync(join(target, "tests/e2e/__screenshots__"), { recursive: true, force: true });
    lockSource = join(presetDir, "package-lock.json");
  }
  pkg.name = slug;
  pkg.description = o.reference ? `${name}: personal remake study of ${o.reference}.` : `${name}.`;
  writeFileSync(pkgPath, jsonText(pkg));
  const lockfile = readJson(lockSource);
  lockfile.name = slug;
  if (lockfile.packages?.[""]) Object.assign(lockfile.packages[""], { name: slug, version: pkg.version });
  writeFileSync(join(target, "package-lock.json"), jsonText(lockfile));

  const cfg = readJson(join(target, "game.config.json"));
  Object.assign(cfg, { name, slug, renderer, assetPolicy: policy });
  cfg.reference.game = o.reference ?? "";
  writeFileSync(join(target, "game.config.json"), jsonText(cfg));

  const sub = (rel, pairs) => {
    const f = join(target, rel);
    if (!existsSync(f)) return;
    let t = readFileSync(f, "utf8");
    for (const [a, b] of pairs) t = t.split(a).join(b);
    writeFileSync(f, t);
  };
  const tokens = [
    ["{{GAME_NAME}}", name],
    ["{{GAME_SLUG}}", slug],
    ["{{REFERENCE_GAME}}", o.reference || "(not chosen yet)"],
    ["{{RENDERER}}", renderer],
    ["{{ASSET_POLICY}}", policy],
  ];
  for (const doc of ["README.md", "docs/GAME_BRIEF.md", "docs/FIDELITY.md", "docs/ART_DIRECTION.md"]) if (!(doc === "README.md" && keepReadme)) sub(doc, tokens);
  sub("index.html", [["<title>Bootstrap Arena</title>", `<title>${name.replace(/</g, "&lt;")}</title>`]]);
  const mf = readJson(join(target, "public/manifest.webmanifest"));
  Object.assign(mf, { name, short_name: name.slice(0, 12) });
  writeFileSync(join(target, "public/manifest.webmanifest"), jsonText(mf));

  const manifest = templateManifest();
  const files = {};
  for (const f of upstreamTracked(manifest).keys()) files[f] = hashFile(join(target, f));
  writeFileSync(
    join(target, LOCK),
    jsonText(stable({ $comment: "Written by webgamedev-bootstrap. Do not edit; run `node <bootstrap>/bootstrap.mjs .` to sync.", bootstrap: bootstrapInfo(), renderer, files, package: packageBaseline(manifest, pkg) })),
  );

  run(target, process.execPath, ["tools/assets.mjs", "credits"]);
  if (o.install) run(target, "npm", ["ci", "--no-audit", "--no-fund"]);

  console.log(`\nbootstrapped "${name}" (${slug}) in ${target}`);
  console.log(`  renderer ${renderer} · asset policy ${policy}${keepReadme ? " · kept your existing README.md" : ""}`);
  console.log(`\nnext (agents: follow AGENTS.md §0):
  1. fill docs/GAME_BRIEF.md from the owner's request
  2. npm run check
  3. git switch -c bootstrap && git add -A && git commit && git push -u origin bootstrap   (then open a PR)`);
}

// --------------------------------------------------------------- sync
function sync(o) {
  const target = o.dir;
  const lock = readJson(join(target, LOCK));
  lock.files ??= {};
  const manifest = templateManifest();
  const cls = classify(manifest);
  const upstream = upstreamTracked(manifest);
  const report = { updated: [], added: [], removed: [], kept: [], conflicts: [], skipped: [] };
  const writes = [];
  const incoming = join(target, ".bootstrap/incoming");

  for (const r of o.resolved) {
    const paths = r === "all" ? [...upstream.keys()] : [r];
    for (const p of paths) if (upstream.has(p)) lock.files[p] = hashFile(upstream.get(p));
  }

  for (const [f, src] of upstream) {
    const up = hashFile(src);
    const local = hashFile(join(target, f));
    const base = lock.files[f] ?? null;
    if (local === up) {
      lock.files[f] = up;
      continue;
    }
    if (local === null && base === null) {
      writes.push(() => copyFile(src, join(target, f)));
      report.added.push(f);
      lock.files[f] = up;
    } else if (local === null) {
      if (cls(f) === "locked") report.conflicts.push(`${f} (locked file deleted locally)`);
      else report.skipped.push(`${f} (deleted locally)`);
    } else if (local === base) {
      writes.push(() => copyFile(src, join(target, f)));
      report.updated.push(f);
      lock.files[f] = up;
    } else if (up === base) {
      report.kept.push(f);
    } else {
      writes.push(() => copyFile(src, join(incoming, f)));
      report.conflicts.push(`${f} (both changed; upstream copy: .bootstrap/incoming/${f})`);
    }
  }
  for (const f of Object.keys(lock.files)) {
    if (upstream.has(f)) continue;
    const local = hashFile(join(target, f));
    if (local !== null && local === lock.files[f]) {
      writes.push(() => rmSync(join(target, f)));
      report.removed.push(f);
    } else if (local !== null) report.skipped.push(`${f} (removed upstream; your edited copy is now game-owned)`);
    delete lock.files[f];
  }

  // package.json kernel scripts and pinned dev tools
  const pkgPath = join(target, "package.json");
  const pkg = readJson(pkgPath);
  const upPkg = readJson(join(TEMPLATE, "package.json"));
  lock.package ??= { scripts: {}, devDependencies: {} };
  let pkgChanged = false;
  for (const section of ["scripts", "devDependencies"]) {
    for (const k of manifest.kernelPackage[section]) {
      const up = upPkg[section]?.[k];
      const local = pkg[section]?.[k];
      const base = lock.package[section]?.[k];
      if (local === up) {
        if (up !== undefined) lock.package[section][k] = up;
        continue;
      }
      if (local === base || local === undefined) {
        pkg[section] ??= {};
        if (up === undefined) delete pkg[section][k];
        else pkg[section][k] = up;
        if (up === undefined) delete lock.package[section][k];
        else lock.package[section][k] = up;
        pkgChanged = true;
        report.updated.push(`package.json ${section}.${k}`);
      } else if (up === base) report.kept.push(`package.json ${section}.${k}`);
      else report.conflicts.push(`package.json ${section}.${k} (yours: ${local}, upstream: ${up})`);
    }
  }

  // .bootstrap/ must stay out of git
  const ignorePath = join(target, ".gitignore");
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  const needIgnore = !ignore.split("\n").some((l) => l.trim() === ".bootstrap/");

  lock.bootstrap = report.updated.length || report.added.length || report.removed.length || !lock.bootstrap ? bootstrapInfo() : lock.bootstrap;
  const lockText = jsonText(stable(lock));
  const lockChanged = readFileSync(join(target, LOCK), "utf8") !== lockText;
  const pending = report.updated.length + report.added.length + report.removed.length + (needIgnore ? 1 : 0);

  const line = (label, list) => list.forEach((x) => console.log(`${label.padEnd(9)} ${x}`));
  line("updated", report.updated);
  line("added", report.added);
  line("removed", report.removed);
  line("kept", report.kept);
  line("skipped", report.skipped);
  line("CONFLICT", report.conflicts);

  if (o.check) {
    console.log(`\ncheck: ${pending} pending change(s), ${report.conflicts.length} conflict(s)${pending || report.conflicts.length ? "" : " — up to date"}`);
    process.exit(report.conflicts.length ? 3 : pending || lockChanged ? 1 : 0);
  }

  rmSync(incoming, { recursive: true, force: true });
  for (const w of writes) w();
  if (pkgChanged) writeFileSync(pkgPath, jsonText(pkg));
  if (needIgnore) writeFileSync(ignorePath, `${ignore.replace(/\n*$/, "\n")}.bootstrap/\n`);
  if (lockChanged) writeFileSync(join(target, LOCK), lockText);
  if (pkgChanged && o.install) run(target, "npm", ["install", "--legacy-peer-deps", "--no-audit", "--no-fund"]);

  const summary = `${report.updated.length} updated, ${report.added.length} added, ${report.removed.length} removed, ${report.kept.length} kept, ${report.conflicts.length} conflict(s)`;
  if (!pending && !report.conflicts.length) console.log(`sync: up to date (${summary})`);
  else console.log(`\nsync: ${summary}`);
  if (report.conflicts.length) {
    console.log("Merge each conflict by hand (compare with .bootstrap/incoming/), then run with --resolved <path> (or --resolved all).");
    process.exit(3);
  }
  if (pending) console.log("Next: npm run check, then commit on a branch and open a PR (locked-file changes need the owner-approved label).");
}

// --------------------------------------------------------------- main
const o = parseArgs(process.argv.slice(2));
if (o.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 27).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
} else if (o.list) {
  console.log(`renderers: ${RENDERERS.join(", ")}`);
  for (const r of RENDERERS.slice(1)) console.log(`  ${r}: ${readJson(join(PRESETS, r, "preset.json")).description}`);
  console.log(`asset policies: ${POLICIES.join(", ")} (see template/docs/ASSETS.md)`);
} else if (existsSync(join(o.dir, LOCK))) {
  if (o.renderer || o.policy || o.reference || o.name || o.slug) console.log("note: --name/--slug/--renderer/--policy/--reference only apply at init; this game already exists, so syncing.");
  sync(o);
} else {
  if (o.check) die(`${o.dir} has no ${LOCK}; nothing to check (run without --check to bootstrap it)`);
  init(o);
}
