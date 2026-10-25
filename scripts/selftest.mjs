#!/usr/bin/env node
// Self-test for the bootstrap. Generates a game per renderer preset and runs
// each one's FULL gate (types, tests, assets, build, soak, browser tests),
// then checks the generator's policy and drift features.
//
//   node scripts/selftest.mjs [--only canvas,three] [--fast]   (--fast skips browser tests)

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : ["canvas", "phaser", "three"];
const fast = argv.includes("--fast");
const work = mkdtempSync(join(tmpdir(), "wgdb-selftest-"));
let failures = 0;

function run(name, cmd, args, cwd, { expectFail = false, expectText = null } = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: process.env });
  const ok = (expectFail ? r.status !== 0 : r.status === 0) && (!expectText || expectText.test(`${r.stdout}${r.stderr}`));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} (${secs}s)`);
  if (!ok) {
    failures++;
    console.log(`${r.stdout}${r.stderr}`.split("\n").slice(-40).map((l) => `      ${l}`).join("\n"));
  }
  return r;
}

try {
  for (const renderer of only) {
    const dir = join(work, `${renderer}-game`);
    run(`create (${renderer})`, process.execPath, [join(ROOT, "create.mjs"), dir, "--name", `Selftest ${renderer}`, "--renderer", renderer, "--reference", "Selftest"], ROOT);
    run(`check${fast ? "" : ":full"} (${renderer})`, "npm", ["run", fast ? "check" : "check:full"], dir);
    const diff = run(`drift report is clean (${renderer})`, process.execPath, [join(ROOT, "create.mjs"), "--diff", dir], ROOT);
    if (!/no differences/.test(diff.stdout)) {
      failures++;
      console.log(`FAIL  expected "no differences", got:\n${diff.stdout}`);
    }
  }

  // Policy enforcement: a non-commercial pack must fail under the public policy
  // and pass under private-personal.
  const dir = join(work, "policy-game");
  run("create (policy fixture)", process.execPath, [join(ROOT, "create.mjs"), dir, "--name", "Policy Test", "--no-install"], ROOT);
  const provPath = join(dir, "public/assets/provenance.json");
  const prov = JSON.parse(readFileSync(provPath, "utf8"));
  prov.packs[0].license = "CC-BY-NC-4.0";
  prov.packs[0].source = "https://example.org/pack";
  prov.packs[0].attribution = "Example author";
  prov.packs[0].licenseFile = undefined;
  writeFileSync(provPath, JSON.stringify(prov, null, 2));
  run("public policy rejects CC-BY-NC", process.execPath, ["tools/assets.mjs", "validate"], dir, { expectFail: true, expectText: /license "CC-BY-NC-4.0" is not allowed by policy "public-permissive"/ });
  const cfgPath = join(dir, "game.config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.assetPolicy = "private-personal";
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  run("private policy accepts CC-BY-NC", process.execPath, ["tools/assets.mjs", "validate"], dir);
  appendFileSync(join(dir, "public/assets/sprites/atlas.json"), "\n");
  run("changed asset without re-pinned hash is rejected", process.execPath, ["tools/assets.mjs", "validate"], dir, { expectFail: true, expectText: /atlas\.json changed since its hash was pinned/ });
  run("re-pin hashes", process.execPath, ["tools/assets.mjs", "hash"], dir);
  run("validates again after re-pin", process.execPath, ["tools/assets.mjs", "validate"], dir);
  writeFileSync(join(dir, "public/assets/stray.png"), readFileSync(join(dir, "public/assets/sprites/atlas.png")));
  run("file without provenance is rejected", process.execPath, ["tools/assets.mjs", "validate"], dir, { expectFail: true, expectText: /stray\.png is not covered by any provenance pack/ });

  // Drift: a local kernel edit is reported.
  appendFileSync(join(dir, "src/core/hash.ts"), "\n// local edit\n");
  const drift = run("drift report runs", process.execPath, [join(ROOT, "create.mjs"), "--diff", dir], ROOT);
  if (!/changed locally\s+src\/core\/hash\.ts/.test(drift.stdout)) {
    failures++;
    console.log(`FAIL  drift report did not flag src/core/hash.ts:\n${drift.stdout}`);
  } else console.log("PASS  drift report flags a local kernel edit");
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} selftest failure(s)` : "\nselftest passed");
process.exit(failures ? 1 : 0);
