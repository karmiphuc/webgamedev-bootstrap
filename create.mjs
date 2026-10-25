#!/usr/bin/env node
// webgamedev-bootstrap generator.
//
//   node create.mjs <dir> --name "My Game" [options]     create a new game
//   node create.mjs --diff <game-dir>                    kernel drift report
//   node create.mjs --list                               renderers & policies
//
// Options:
//   --slug <slug>          url/repo-safe id (default: from --name)
//   --renderer <name>      canvas (default) | phaser | three
//   --policy <name>        public-permissive (default) | public-sharealike | private-personal
//   --reference "<game>"   the game you are studying (fills brief + credits)
//   --no-install           skip `npm ci`
//   --git                  git init + first commit
//   --force                allow a non-empty target directory
//
// The game OWNS its copy of the kernel (no shared runtime dependency), so a
// bootstrap change can never break an existing game. Use --diff to see which
// kernel files changed upstream and port fixes deliberately.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "template");
const PRESETS = join(HERE, "presets");
const RENDERERS = ["canvas", ...readdirSync(PRESETS).filter((d) => existsSync(join(PRESETS, d, "preset.json")))];
const POLICIES = ["public-permissive", "public-sharealike", "private-personal"];
const SKIP = new Set(["node_modules", "dist", "test-results", "playwright-report", "CREDITS.md"]);
// Files that make up the reusable kernel (tracked for --diff).
const KERNEL = [/^src\/core\//, /^src\/app\/(offline|audio)\.ts$/, /^src\/render\/types\.ts$/, /^tools\//, /^tests\/e2e\/helpers\.ts$/, /^tests\/unit\//, /^playwright\.config\.ts$/, /^vite\.config\.ts$/, /^\.github\//, /^\.claude\//, /^AGENTS\.md$/, /^docs\/(TESTING|ASSETS)\.md$/, /^docs\/evidence\/README\.md$/];

const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const posix = (p) => p.split(sep).join("/");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // Generated evidence captures never ship in a new game.
      if (posix(relative(base, full)).match(/^docs\/evidence\/v/)) return [];
      return walk(full, base);
    }
    return [posix(relative(base, full))];
  });
}

function bootstrapCommit() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: HERE, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function parseArgs(argv) {
  const opts = { renderer: "canvas", policy: "public-permissive", install: true, git: false, force: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) die(`${a} needs a value`);
      return v;
    };
    if (a === "--name") opts.name = val();
    else if (a === "--slug") opts.slug = val();
    else if (a === "--renderer") opts.renderer = val();
    else if (a === "--policy") opts.policy = val();
    else if (a === "--reference") opts.reference = val();
    else if (a === "--no-install") opts.install = false;
    else if (a === "--git") opts.git = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--diff") opts.diff = val();
    else if (a === "--list") opts.list = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("--")) die(`unknown option ${a}`);
    else rest.push(a);
  }
  opts.dir = rest[0];
  return opts;
}

function list() {
  console.log("renderers:");
  console.log("  canvas   zero-dependency Canvas 2D pixel renderer (default; golden-image tests)");
  for (const r of RENDERERS.slice(1)) console.log(`  ${r.padEnd(8)} ${readJson(join(PRESETS, r, "preset.json")).description}`);
  console.log("asset policies (see docs/ASSETS.md):");
  console.log("  public-permissive   CC0, CC-BY, OGA-BY, MIT, OFL, original, recorded AI art. Public deploy OK.");
  console.log("  public-sharealike   + CC-BY-SA / GPL (your shipped assets inherit share-alike terms).");
  console.log("  private-personal    + NC, personal-use-only, adapted reference-game art. Never deploy publicly.");
}

function create(opts) {
  if (!opts.dir) die("missing target directory (node create.mjs <dir> --name \"My Game\")");
  if (!opts.name) die("missing --name");
  const slug = opts.slug ?? opts.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) die(`slug "${slug}" must be lowercase letters, digits and dashes`);
  if (!RENDERERS.includes(opts.renderer)) die(`renderer must be one of ${RENDERERS.join(", ")}`);
  if (!POLICIES.includes(opts.policy)) die(`policy must be one of ${POLICIES.join(", ")}`);
  const target = resolve(opts.dir);
  if (existsSync(target) && readdirSync(target).filter((f) => f !== ".git").length && !opts.force) {
    die(`${target} is not empty (use --force to write into it)`);
  }

  // 1. copy the template
  mkdirSync(target, { recursive: true });
  for (const file of walk(TEMPLATE)) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    cpSync(join(TEMPLATE, file), join(target, file));
  }

  // 2. overlay the renderer preset
  const pkgPath = join(target, "package.json");
  const pkg = readJson(pkgPath);
  let lockSource = join(TEMPLATE, "package-lock.json");
  if (opts.renderer !== "canvas") {
    const presetDir = join(PRESETS, opts.renderer);
    const preset = readJson(join(presetDir, "preset.json"));
    for (const file of walk(presetDir)) {
      if (file === "preset.json" || file === "package-lock.json") continue;
      mkdirSync(dirname(join(target, file)), { recursive: true });
      cpSync(join(presetDir, file), join(target, file));
    }
    pkg.dependencies = sortKeys({ ...(pkg.dependencies ?? {}), ...preset.dependencies });
    pkg.devDependencies = sortKeys({ ...pkg.devDependencies, ...preset.devDependencies });
    writeFileSync(
      join(target, "src/render/index.ts"),
      `// The active renderer. \`create.mjs --renderer <name>\` rewrites this line.\nexport { createRenderer } from "${preset.rendererModule}";\n`,
    );
    // Golden images belong to the canvas renderer only.
    rmSync(join(target, "tests/e2e/__screenshots__"), { recursive: true, force: true });
    lockSource = join(presetDir, "package-lock.json");
  }

  // 3. names, config, lockfile
  pkg.name = slug;
  pkg.description = opts.reference ? `${opts.name}: personal remake study of ${opts.reference}.` : `${opts.name}.`;
  writeJson(pkgPath, pkg);
  if (existsSync(lockSource)) {
    const lock = readJson(lockSource);
    lock.name = slug;
    if (lock.packages?.[""]) {
      lock.packages[""].name = slug;
      lock.packages[""].version = pkg.version;
    }
    writeJson(join(target, "package-lock.json"), lock);
  } else {
    rmSync(join(target, "package-lock.json"), { force: true });
  }

  const cfgPath = join(target, "game.config.json");
  const cfg = readJson(cfgPath);
  cfg.name = opts.name;
  cfg.slug = slug;
  cfg.renderer = opts.renderer;
  cfg.assetPolicy = opts.policy;
  cfg.reference.game = opts.reference ?? "";
  writeJson(cfgPath, cfg);

  const replaceIn = (rel, from, to) => {
    const f = join(target, rel);
    writeFileSync(f, readFileSync(f, "utf8").split(from).join(to));
  };
  replaceIn("index.html", "<title>Bootstrap Arena</title>", `<title>${opts.name.replace(/</g, "&lt;")}</title>`);
  const manifest = readJson(join(target, "public/manifest.webmanifest"));
  manifest.name = opts.name;
  manifest.short_name = opts.name.slice(0, 12);
  writeJson(join(target, "public/manifest.webmanifest"), manifest);
  for (const doc of ["README.md", "docs/GAME_BRIEF.md", "docs/FIDELITY.md", "docs/ART_DIRECTION.md"]) {
    if (!existsSync(join(target, doc))) continue;
    replaceIn(doc, "{{GAME_NAME}}", opts.name);
    replaceIn(doc, "{{GAME_SLUG}}", slug);
    replaceIn(doc, "{{REFERENCE_GAME}}", opts.reference ?? "(not chosen yet)");
    replaceIn(doc, "{{RENDERER}}", opts.renderer);
    replaceIn(doc, "{{ASSET_POLICY}}", opts.policy);
  }

  // 4. drift baseline
  const files = {};
  for (const file of walk(target)) if (KERNEL.some((re) => re.test(file))) files[file] = sha(join(target, file));
  writeJson(join(target, "bootstrap.lock.json"), {
    $comment: "Written by webgamedev-bootstrap create.mjs. `node <bootstrap>/create.mjs --diff .` compares kernel files.",
    bootstrapCommit: bootstrapCommit(),
    renderer: opts.renderer,
    files: sortKeys(files),
  });

  // 5. credits, install, git
  const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd: target, stdio: "inherit" });
    if (r.status !== 0) die(`${cmd} ${args.join(" ")} failed`);
  };
  run(process.execPath, ["tools/assets.mjs", "credits"]);
  if (opts.install) run("npm", ["ci", "--no-audit", "--no-fund"]);
  if (opts.git) {
    run("git", ["init", "-q", "-b", "main"]);
    run("git", ["add", "-A"]);
    run("git", ["commit", "-q", "-m", `Bootstrap ${opts.name} (${opts.renderer}, ${opts.policy})`]);
  }

  console.log(`\ncreated ${opts.name} in ${target}`);
  console.log(`  renderer ${opts.renderer}, asset policy ${opts.policy}`);
  console.log(`\nnext:\n  cd ${relative(process.cwd(), target) || "."}\n  npm run dev        # play at http://localhost:5173\n  npm run check      # the gate before every commit\n  then fill docs/GAME_BRIEF.md, docs/FIDELITY.md and docs/ART_DIRECTION.md`);
}

function diff(gameDir) {
  const root = resolve(gameDir);
  const lockPath = join(root, "bootstrap.lock.json");
  if (!existsSync(lockPath)) die(`${lockPath} not found (was this game created by create.mjs?)`);
  const lock = readJson(lockPath);
  const rows = [];
  for (const [file, baseHash] of Object.entries(lock.files)) {
    const local = existsSync(join(root, file)) ? sha(join(root, file)) : null;
    const upstreamFile = existsSync(join(TEMPLATE, file)) ? join(TEMPLATE, file) : null;
    const upstream = upstreamFile ? sha(upstreamFile) : null;
    const localChanged = local !== baseHash;
    const upstreamChanged = upstream !== null && upstream !== baseHash;
    if (!localChanged && !upstreamChanged) continue;
    const state = local === null ? "deleted locally" : localChanged && upstreamChanged ? "BOTH changed (merge by hand)" : localChanged ? "changed locally" : "updated upstream (safe to copy)";
    rows.push(`${state.padEnd(32)} ${file}`);
  }
  for (const file of walk(TEMPLATE)) {
    if (KERNEL.some((re) => re.test(file)) && !(file in lock.files)) rows.push(`${"new upstream file".padEnd(32)} ${file}`);
  }
  console.log(`kernel drift vs bootstrap ${lock.bootstrapCommit.slice(0, 8)} -> ${bootstrapCommit().slice(0, 8)}`);
  console.log(rows.length ? rows.join("\n") : "no differences");
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 19).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
} else if (opts.list) list();
else if (opts.diff) diff(opts.diff);
else create(opts);
