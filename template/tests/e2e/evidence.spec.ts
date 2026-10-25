// Visual EVIDENCE for human review (not a pass/fail gate).
// `npm run evidence` writes screenshots for every viewport project to
// docs/evidence/<version>/ . Look at them, then summarise what you checked
// in docs/evidence/<version>/REVIEW.md (template in docs/evidence/README.md).
import { test } from "@playwright/test";
import pkg from "../../package.json" with { type: "json" };
import { api, openGame } from "./helpers";

test.skip(!process.env.EVIDENCE, "run with `npm run evidence`");

const SCENES: { name: string; ticks: number; setup?: string }[] = [
  { name: "start", ticks: 0 },
  { name: "early-fight", ticks: 300, setup: 'g.command({ type: "move", x: 4, y: 3 });' },
  { name: "crowded", ticks: 1600 },
];

for (const scene of SCENES) {
  test(`capture ${scene.name}`, async ({ page }, info) => {
    await openGame(page);
    await api(page, `${scene.setup ?? ""} g.step(${scene.ticks}); g.render();`);
    await page.screenshot({ path: `docs/evidence/v${pkg.version}/${scene.name}-${info.project.name}.png` });
  });
}
