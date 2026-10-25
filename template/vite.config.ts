import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
let commit = "dev";
try {
  commit = execSync("git rev-parse --short=8 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {
  /* not a git checkout */
}

export default defineConfig({
  // Relative base: the same build works at / and at /<repo>/ on GitHub Pages.
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  build: {
    target: "es2022",
    assetsDir: "build",
    // Engines (phaser ~1.2 MB, three ~0.7 MB) exceed Vite's 500 kB default.
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/sim/**/*.test.ts"],
    environment: "node",
  },
});
