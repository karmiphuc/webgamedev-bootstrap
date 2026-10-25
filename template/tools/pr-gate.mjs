#!/usr/bin/env node
// LOCKED (see docs/CHARTER.md). Pull-request gate. Runs in CI on every PR and
// locally before opening one:
//
//   npm run pr-gate                      compare HEAD with origin/main
//   npm run pr-gate -- --base <ref> [--head <ref>] [--labels a,b]
//
// Rules (from bootstrap.manifest.json):
//   1. LOCKED or GUARDED files changed, or APPEND-ONLY files modified/deleted
//                                      -> the PR needs the owner's label (ownerLabel)
//   2. VISUAL files changed            -> the PR adds/updates docs/evidence/**/REVIEW.md
//                                         with a filled "## Verdict" and at least one
//                                         linked image that exists in the PR
//   3. DEFAULTS changed                -> the PR adds/updates a record in docs/decisions/
//                                         (or carries the owner's label, e.g. a bootstrap sync)
//   4. docs/GAME_BRIEF.md changed      -> warning: the owner confirms scope changes
// Exit code 1 when a rule fails.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { matcher } from "./glob.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (...a) => {
  try {
    return git(...a);
  } catch {
    return null;
  }
};

const base = arg("--base") ?? (tryGit("rev-parse", "--verify", "-q", "origin/main") ? "origin/main" : "main");
const head = arg("--head") ?? "HEAD";
let labels = [];
if (arg("--labels")) labels = arg("--labels").split(",").map((s) => s.trim()).filter(Boolean);
else if (process.env.PR_LABELS) {
  try {
    labels = JSON.parse(process.env.PR_LABELS);
  } catch {
    labels = process.env.PR_LABELS.split(",");
  }
}

const manifest = JSON.parse(readFileSync(join(ROOT, "bootstrap.manifest.json"), "utf8"));
const mergeBase = tryGit("merge-base", base, head);
if (!mergeBase) {
  console.error(`pr-gate: cannot find a merge base between ${base} and ${head} (fetch the base branch with full history)`);
  process.exit(1);
}
const status = git("diff", "--name-status", "--no-renames", `${mergeBase}`, head)
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [code, path] = l.split("\t");
    return { code: code[0], path };
  });
const changed = status.map((s) => s.path);
const show = (ref, path) => tryGit("show", `${ref}:${path}`);

const failures = [];
const warnings = [];
const passes = [];

// 1. locked files, owner-guarded game files, and append-only files (adding is fine)
const isLocked = matcher([...manifest.locked, ...(manifest.guarded ?? [])]);
const isAppendOnly = matcher(manifest.appendOnly ?? []);
const lockedChanged = [
  ...changed.filter(isLocked),
  ...status.filter((s) => isAppendOnly(s.path) && s.code !== "A").map((s) => `${s.path} (${s.code === "D" ? "deleted" : "modified"})`),
];
if (lockedChanged.length) {
  if (labels.includes(manifest.ownerLabel)) passes.push(`locked files changed with "${manifest.ownerLabel}": ${lockedChanged.join(", ")}`);
  else
    failures.push(
      `locked files changed: ${lockedChanged.join(", ")}. Only the owner can approve this by adding the "${manifest.ownerLabel}" label (docs/CHARTER.md).`,
    );
}

// 2. visual changes need a reviewed evidence record
const isVisual = matcher(manifest.visual);
const isShared = matcher([...manifest.locked, ...manifest.kernel]);
const visualChanged = changed.filter((f) => isVisual(f) && !isShared(f));
if (visualChanged.length) {
  const reviews = changed.filter((f) => /^docs\/evidence\/.+\/REVIEW\.md$/.test(f) && show(head, f) !== null);
  const problems = [];
  let good = null;
  for (const review of reviews) {
    const text = show(head, review);
    const verdict = /^##\s*Verdict\s*\n+([^\n#][^\n]*)/im.exec(text);
    const images = [...text.matchAll(/\(([^)\s]+\.(?:png|webp|jpe?g|gif|webm|mp4))\)/gi)].map((m) => posix.normalize(posix.join(posix.dirname(review), m[1])));
    const present = images.filter((p) => show(head, p) !== null);
    if (!verdict || !verdict[1].trim()) problems.push(`${review}: "## Verdict" is missing or empty`);
    else if (!present.length) problems.push(`${review}: links no image that exists in this PR`);
    else good = `${review} (${present.length} image(s), verdict: ${verdict[1].trim().slice(0, 60)})`;
  }
  if (good) passes.push(`visual change reviewed: ${good}`);
  else
    failures.push(
      `visual files changed (${visualChanged.slice(0, 5).join(", ")}${visualChanged.length > 5 ? ", ..." : ""}) but no valid docs/evidence/<version>/REVIEW.md in this PR. ` +
        `Run \`npm run evidence\`, look at the captures, and write the review (docs/evidence/README.md).` +
        (problems.length ? ` Problems: ${problems.join("; ")}` : ""),
    );
}

// 3. defaults need a decision record
const defaultsChanged = [];
for (const f of manifest.defaults.files) if (changed.includes(f)) defaultsChanged.push(f);
const jsonAt = (ref, path) => {
  const t = show(ref, path);
  try {
    return t === null ? {} : JSON.parse(t);
  } catch {
    return {};
  }
};
if (changed.includes("game.config.json")) {
  const a = jsonAt(mergeBase, "game.config.json");
  const b = jsonAt(head, "game.config.json");
  for (const k of manifest.defaults.gameConfigKeys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) defaultsChanged.push(`game.config.json:${k}`);
}
if (changed.includes("package.json")) {
  const a = jsonAt(mergeBase, "package.json");
  const b = jsonAt(head, "package.json");
  for (const k of manifest.defaults.packageKeys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) defaultsChanged.push(`package.json:${k}`);
}
if (defaultsChanged.length) {
  const decisions = changed.filter((f) => /^docs\/decisions\/(?!TEMPLATE\.md$).+\.md$/.test(f) && show(head, f) !== null);
  if (decisions.length) passes.push(`defaults changed (${defaultsChanged.join(", ")}) with decision record ${decisions.join(", ")}`);
  else if (labels.includes(manifest.ownerLabel)) passes.push(`defaults changed (${defaultsChanged.join(", ")}) with "${manifest.ownerLabel}"`);
  else
    failures.push(
      `defaults changed (${defaultsChanged.join(", ")}) without a decision record. Add docs/decisions/NNNN-<topic>.md (copy docs/decisions/TEMPLATE.md) explaining why.`,
    );
}

// 4. brief changes
if (changed.includes("docs/GAME_BRIEF.md")) warnings.push("docs/GAME_BRIEF.md changed: the owner confirms scope changes in review");

const lines = [
  `pr-gate: ${changed.length} changed file(s) between ${base} and ${head}`,
  ...passes.map((p) => `PASS  ${p}`),
  ...warnings.map((w) => `WARN  ${w}`),
  ...failures.map((f) => `FAIL  ${f}`),
  failures.length ? `\npr-gate failed (${failures.length})` : "\npr-gate passed",
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### PR gate\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`);
if (process.env.GITHUB_ACTIONS) for (const f of failures) console.log(`::error title=PR gate::${f}`);
process.exit(failures.length ? 1 : 0);
