#!/usr/bin/env node
// THE one command to run before every commit:
//
//   npm run check         fast gate (~10-30 s): types, content + sim tests,
//                         asset provenance/pixel rules, production build
//   npm run check:full    + 30-minute soak with budgets, + browser tests
//
// Prints PASS/FAIL per step and exits non-zero on any failure.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
let failed = 0;

function step(name, cmd, args, env = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env }, shell: false });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (r.status === 0) {
    const last = out.split("\n").filter(Boolean).pop() ?? "";
    console.log(`PASS  ${name} (${secs}s)${last ? ` — ${last.slice(0, 120)}` : ""}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} (${secs}s)\n${out.split("\n").slice(-40).map((l) => `      ${l}`).join("\n")}`);
  }
}

const bin = (name) => join(ROOT, "node_modules/.bin", name);

step("typecheck", bin("tsc"), ["--noEmit"]);
step("unit + simulation tests", bin("vitest"), ["run"]);
step("assets: provenance, licenses, pixel rules", process.execPath, ["tools/assets.mjs", "validate"]);
step("production build + offline worker", "npm", ["run", "build", "--silent"]);
if (full) {
  step("soak (30 game-minutes x 3 seeds, budgets)", bin("vitest"), ["run", "tests/sim/soak.test.ts"], { SOAK: "1" });
  step("browser tests against the built artifact", bin("playwright"), ["test"]);
}

console.log(failed ? `\n${failed} step(s) failed` : `\nall checks passed${full ? " (full)" : ""}`);
process.exit(failed ? 1 : 0);
