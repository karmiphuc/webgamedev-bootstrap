#!/usr/bin/env node
// Self-test for the bootstrap. Every behaviour the charter promises is
// exercised here against real generated games:
//
//   A. init into an "empty GitHub repo" (README-only) for each renderer,
//      full gate (types, tests, assets, build, soak, browser), idempotent re-run
//   B. asset policy enforcement
//   C. safe sync: updates untouched kernel/locked files, keeps local edits,
//      never touches game-owned files, reports conflicts, --resolved, --check
//   D. locks: pre-push refuses main, PR gate (owner label, visual review,
//      decision records, append-only fixtures), save shape guard
//
//   node scripts/selftest.mjs [--only canvas,three] [--fast]   (--fast: no browser tests/soak)

import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : ["canvas", "phaser", "three"];
const fast = argv.includes("--fast");
const work = mkdtempSync(join(tmpdir(), "wgdb-selftest-"));
const env = { ...process.env, GIT_AUTHOR_NAME: "selftest", GIT_AUTHOR_EMAIL: "selftest@example.org", GIT_COMMITTER_NAME: "selftest", GIT_COMMITTER_EMAIL: "selftest@example.org" };
let failures = 0;

function sh(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", env });
}
function expect(name, r, { status = 0, text = null, notText = null } = {}) {
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ok = (status === "nonzero" ? r.status !== 0 : r.status === status) && (!text || text.test(out)) && (!notText || !notText.test(out));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    console.log(`      exit ${r.status}, expected ${status}${text ? ` and ${text}` : ""}`);
    console.log(out.split("\n").slice(-30).map((l) => `      ${l}`).join("\n"));
  }
  return r;
}
const node = (args, cwd) => sh(process.execPath, args, cwd);
const boot = (root, args, cwd) => node([join(root, "bootstrap.mjs"), ...args], cwd);
const git = (cwd, ...args) => sh("git", args, cwd);
const commit = (cwd, msg) => {
  git(cwd, "add", "-A");
  return git(cwd, "commit", "-q", "--no-verify", "-m", msg);
};

/** An "empty GitHub repo": bare remote + clone with a one-line README on main. */
function emptyRepo(name) {
  const remote = join(work, `${name}.git`);
  const dir = join(work, name);
  git(work, "init", "-q", "--bare", "-b", "main", remote);
  git(work, "clone", "-q", remote, dir);
  git(dir, "checkout", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), `# ${name}\n`);
  commit(dir, "Initial commit");
  git(dir, "push", "-q", "origin", "main");
  return dir;
}

try {
  // ---------------------------------------------------------------- A
  for (const renderer of only) {
    const dir = emptyRepo(`${renderer}-game`);
    expect(`A ${renderer}: bootstrap into an empty repo`, boot(ROOT, [".", "--renderer", renderer, "--reference", "Selftest"], dir), { text: /bootstrapped "Canvas Game|Phaser Game|Three Game"/i });
    expect(`A ${renderer}: ${fast ? "check" : "check:full"}`, sh("npm", ["run", fast ? "check" : "check:full"], dir), { text: /all checks passed/ });
    commit(dir, "bootstrap");
    expect(`A ${renderer}: re-run is a no-op`, boot(ROOT, ["."], dir), { text: /sync: up to date/ });
    expect(`A ${renderer}: working tree unchanged after re-run`, git(dir, "status", "--porcelain"), { notText: /\S/ });
    expect(`A ${renderer}: --check reports up to date`, boot(ROOT, [".", "--check"], dir), { text: /up to date/ });
  }

  // ---------------------------------------------------------------- B
  {
    const dir = emptyRepo("policy-game");
    boot(ROOT, [".", "--no-install"], dir);
    const provPath = join(dir, "public/assets/provenance.json");
    const prov = JSON.parse(readFileSync(provPath, "utf8"));
    Object.assign(prov.packs[0], { license: "CC-BY-NC-4.0", source: "https://example.org/pack", attribution: "Example author" });
    writeFileSync(provPath, JSON.stringify(prov, null, 2));
    expect("B public policy rejects CC-BY-NC", node(["tools/assets.mjs"], dir), { status: 1, text: /not allowed by policy "public-permissive"/ });
    const cfgPath = join(dir, "game.config.json");
    writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(readFileSync(cfgPath, "utf8")), assetPolicy: "private-personal" }, null, 2));
    expect("B private policy accepts CC-BY-NC", node(["tools/assets.mjs"], dir));
    appendFileSync(join(dir, "public/assets/sprites/atlas.json"), "\n");
    expect("B changed asset without re-pinned hash is rejected", node(["tools/assets.mjs"], dir), { status: 1, text: /changed since its hash was pinned/ });
    node(["tools/assets.mjs", "hash"], dir);
    writeFileSync(join(dir, "public/assets/stray.png"), readFileSync(join(dir, "public/assets/sprites/atlas.png")));
    expect("B file without provenance is rejected", node(["tools/assets.mjs"], dir), { status: 1, text: /stray\.png is not covered/ });
  }

  // ---------------------------------------------------------------- C
  {
    // "upstream v2": a copy of this bootstrap with kernel, locked, package and game-owned changes
    const up = join(work, "upstream-v2");
    for (const p of ["bootstrap.mjs", "template", "presets"]) cpSync(join(ROOT, p), join(up, p), { recursive: true, filter: (s) => !/node_modules|[/\\]dist[/\\]?|test-results/.test(s) });
    const dir = emptyRepo("sync-game");
    boot(ROOT, [".", "--no-install"], dir);
    commit(dir, "bootstrap");
    appendFileSync(join(dir, "src/core/rng.ts"), "\n// local kernel edit\n"); // kept
    appendFileSync(join(dir, "src/sim/sim.ts"), "\n// game code\n");
    commit(dir, "local edits");
    appendFileSync(join(up, "template/src/core/hash.ts"), "\n// upstream kernel fix\n");
    appendFileSync(join(up, "template/tools/check.mjs"), "\n// upstream locked change\n");
    appendFileSync(join(up, "template/src/sim/sim.ts"), "\n// upstream example change\n"); // game-owned: never synced
    writeFileSync(join(up, "template/src/core/new-helper.ts"), "export const answer = 42;\n");
    const upPkg = JSON.parse(readFileSync(join(up, "template/package.json"), "utf8"));
    upPkg.scripts.typecheck = "tsc --noEmit --pretty false";
    writeFileSync(join(up, "template/package.json"), JSON.stringify(upPkg, null, 2) + "\n");

    expect("C --check lists pending upstream changes (exit 1)", boot(up, [".", "--check"], dir), { status: 1, text: /updated\s+src\/core\/hash\.ts[\s\S]*pending/ });
    const r = expect("C sync applies untouched kernel/locked/package changes", boot(up, [".", "--no-install"], dir), {
      text: /updated\s+src\/core\/hash\.ts[\s\S]*updated\s+tools\/check\.mjs|updated\s+tools\/check\.mjs[\s\S]*updated\s+src\/core\/hash\.ts/,
    });
    expect("C sync adds new kernel files", r, { text: /added\s+src\/core\/new-helper\.ts/ });
    expect("C sync updates kernel package scripts", r, { text: /updated\s+package\.json scripts\.typecheck/ });
    expect("C sync keeps the local kernel edit", r, { text: /kept\s+src\/core\/rng\.ts/ });
    const simText = readFileSync(join(dir, "src/sim/sim.ts"), "utf8");
    expect("C sync never touches game-owned files", { status: simText.includes("upstream example change") ? 1 : 0, stdout: "", stderr: "" });
    commit(dir, "sync");
    expect("C second sync is a no-op", boot(up, [".", "--no-install"], dir), { text: /sync: up to date/ });
    expect("C tree unchanged after second sync", git(dir, "status", "--porcelain"), { notText: /\S/ });

    appendFileSync(join(up, "template/src/core/loop.ts"), "\n// upstream loop change\n");
    appendFileSync(join(dir, "src/core/loop.ts"), "\n// local loop change\n");
    expect("C both-changed file is a conflict (exit 3), nothing overwritten", boot(up, [".", "--no-install"], dir), { status: 3, text: /CONFLICT\s+src\/core\/loop\.ts/ });
    expect("C upstream copy written for merging", { status: existsSync(join(dir, ".bootstrap/incoming/src/core/loop.ts")) ? 0 : 1, stdout: "", stderr: "" });
    expect("C local file left as is", { status: readFileSync(join(dir, "src/core/loop.ts"), "utf8").includes("local loop change") ? 0 : 1, stdout: "", stderr: "" });
    expect("C --resolved accepts the hand-merged file", boot(up, [".", "--no-install", "--resolved", "src/core/loop.ts"], dir), { status: 0 });
    expect("C after resolving, sync is a no-op", boot(up, [".", "--no-install"], dir), { text: /sync: up to date/ });
    expect(".bootstrap/ is ignored by git", git(dir, "check-ignore", ".bootstrap/incoming/x"), { status: 0 });
  }

  // ---------------------------------------------------------------- D
  {
    const dir = emptyRepo("locks-game");
    boot(ROOT, [".", "--no-install"], dir);
    git(dir, "config", "core.hooksPath", ".githooks");
    commit(dir, "bootstrap");
    expect("D pre-push refuses a direct push to main", git(dir, "push", "origin", "main"), { status: "nonzero", text: /direct pushes to main are not allowed/ });
    git(dir, "switch", "-q", "-c", "bootstrap");
    expect("D PR gate: locked files without the owner label fail", node(["tools/pr-gate.mjs", "--base", "origin/main"], dir), { status: 1, text: /FAIL\s+locked files changed/ });
    expect("D PR gate: visual changes without a review fail", node(["tools/pr-gate.mjs", "--base", "origin/main", "--labels", "owner-approved"], dir), { status: 1, text: /FAIL\s+visual files changed/ });
    mkdirSync(join(dir, "docs/evidence/v0.1.0"), { recursive: true });
    cpSync(join(dir, "public/assets/sprites/atlas.png"), join(dir, "docs/evidence/v0.1.0/start-desktop.png"));
    writeFileSync(join(dir, "docs/evidence/v0.1.0/REVIEW.md"), "# Review\n\n![start](start-desktop.png)\n\n## Verdict\n\nAccept.\n");
    commit(dir, "evidence");
    expect("D PR gate: label + reviewed evidence pass", node(["tools/pr-gate.mjs", "--base", "origin/main", "--labels", "owner-approved"], dir), { text: /pr-gate passed/ });

    // Land the bootstrap on main (as a merged PR would), then test game PRs.
    git(dir, "switch", "-q", "main");
    git(dir, "merge", "-q", "--ff-only", "bootstrap");
    git(dir, "-c", "core.hooksPath=/dev/null", "push", "-q", "origin", "main");
    git(dir, "switch", "-q", "-c", "feature");
    appendFileSync(join(dir, "src/content/units.ts"), "\n// balance tweak\n");
    commit(dir, "content");
    expect("D PR gate: a game-only change passes with no label", node(["tools/pr-gate.mjs", "--base", "origin/main"], dir), { text: /pr-gate passed/ });
    const cfgPath = join(dir, "game.config.json");
    writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(readFileSync(cfgPath, "utf8")), renderer: "three" }, null, 2) + "\n");
    commit(dir, "default");
    expect("D PR gate: changing a default needs a decision record", node(["tools/pr-gate.mjs", "--base", "origin/main"], dir), { status: 1, text: /without a decision record/ });
    writeFileSync(join(dir, "docs/decisions/0002-renderer.md"), "# 0002: three.js renderer\n\nWhy: 3D camera for a MOBA.\n");
    commit(dir, "decision");
    expect("D PR gate: with a decision record it passes", node(["tools/pr-gate.mjs", "--base", "origin/main"], dir), { text: /pr-gate passed/ });
    rmSync(join(dir, "tests/fixtures/schema1-new-game.json"));
    commit(dir, "drop fixture");
    expect("D PR gate: deleting an old-save fixture needs the owner", node(["tools/pr-gate.mjs", "--base", "origin/main"], dir), { status: 1, text: /schema1-new-game\.json \(deleted\)/ });
    git(dir, "reset", "-q", "--hard", "HEAD~1");
    writeFileSync(join(dir, "tests/fixtures/schema1-extra.json"), readFileSync(join(dir, "tests/fixtures/schema1-new-game.json")));
    commit(dir, "add fixture");
    expect("D PR gate: adding an old-save fixture is allowed", node(["tools/pr-gate.mjs", "--base", "origin/main"], dir), { text: /pr-gate passed/ });
  }
  if (only.includes("canvas")) {
    // shape guard runs inside the canvas game from A (deps installed there)
    const dir = join(work, "canvas-game");
    const statePath = join(dir, "src/sim/state.ts");
    const original = readFileSync(statePath, "utf8");
    writeFileSync(statePath, original.replace("    kills: 0,", "    kills: 0,\n    score: 0,"));
    expect("D shape guard: a new saved field without a SCHEMA bump fails", sh("npx", ["vitest", "run", "tests/locked/saves.test.ts"], dir), { status: "nonzero", text: /shape changed but SCHEMA did not/ });
    expect("D shape guard: schema:accept refuses to paper over it", sh("npm", ["run", "schema:accept"], dir), { status: "nonzero" });
    writeFileSync(statePath, original);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} selftest failure(s)` : "\nselftest passed");
process.exit(failures ? 1 : 0);
