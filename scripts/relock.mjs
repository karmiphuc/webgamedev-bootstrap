#!/usr/bin/env node
// Regenerates template/package-lock.json and presets/<name>/package-lock.json.
// Run after changing any pinned version. Uses --legacy-peer-deps only to
// work around an npm 10 arborist crash ("Cannot read properties of null
// (reading 'edgesOut')") when resolving vitest's optional peers; generated
// games then install with a plain `npm ci` from these lockfiles.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(readFileSync(join(ROOT, "template/package.json"), "utf8"));
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

function lock(pkg, outFile) {
  const dir = mkdtempSync(join(tmpdir(), "relock-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  const r = spawnSync("npm", ["install", "--package-lock-only", "--legacy-peer-deps", "--no-audit", "--no-fund"], { cwd: dir, stdio: "inherit" });
  if (r.status !== 0) process.exit(1);
  cpSync(join(dir, "package-lock.json"), outFile);
  rmSync(dir, { recursive: true, force: true });
  console.log(`locked ${outFile}`);
}

lock(base, join(ROOT, "template/package-lock.json"));
for (const name of readdirSync(join(ROOT, "presets"))) {
  const presetFile = join(ROOT, "presets", name, "preset.json");
  if (!existsSync(presetFile)) continue;
  const preset = JSON.parse(readFileSync(presetFile, "utf8"));
  const pkg = structuredClone(base);
  pkg.dependencies = sortKeys({ ...(pkg.dependencies ?? {}), ...preset.dependencies });
  pkg.devDependencies = sortKeys({ ...pkg.devDependencies, ...preset.devDependencies });
  lock(pkg, join(ROOT, "presets", name, "package-lock.json"));
}
