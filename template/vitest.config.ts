// LOCKED (see docs/CHARTER.md): which tests run. Vitest prefers this file over
// vite.config.ts, so the game's Vite config can change freely without
// accidentally dropping the locked tests.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/locked/**/*.test.ts", "tests/sim/**/*.test.ts"],
    environment: "node",
  },
});
