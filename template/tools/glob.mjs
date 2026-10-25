// LOCKED helper: tiny glob matcher shared by bootstrap sync and the PR gate.
// Supports ** (any depth), * (within one path segment) and ? (one char).
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function matcher(globs) {
  const res = globs.map(globToRegExp);
  return (path) => res.some((r) => r.test(path));
}

/** Classify a repo-relative POSIX path using bootstrap.manifest.json. */
export function classify(manifest) {
  const isLocked = matcher(manifest.locked);
  const isKernel = matcher(manifest.kernel);
  return (path) => (isLocked(path) ? "locked" : isKernel(path) ? "kernel" : "game");
}
