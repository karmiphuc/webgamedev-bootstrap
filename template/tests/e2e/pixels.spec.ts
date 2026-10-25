// Pixel-art integrity + one golden image. Desktop project only: goldens are
// generated on Linux Chromium (the CI image) and are renderer-specific.
import { expect, test } from "@playwright/test";
import config from "../../game.config.json" with { type: "json" };
import { api, openGame } from "./helpers";

test("pixel rules: no smoothing, integer scale, backing size matches CSS size", async ({ page }) => {
  await openGame(page);
  const d = await api<Record<string, number | boolean | string>>(page, "return g.diagnostics().renderer;");
  if (d.renderer !== "canvas") test.skip(true, `pixel checks target the canvas renderer (got ${d.renderer})`);
  expect(d.smoothing).toBe(false);
  expect(Number.isInteger(d.scale)).toBe(true);
  const css = await page.getByTestId("game-view").evaluate((c: HTMLCanvasElement) => ({
    w: c.getBoundingClientRect().width * devicePixelRatio,
    h: c.getBoundingClientRect().height * devicePixelRatio,
    bw: c.width,
    bh: c.height,
    rendering: getComputedStyle(c).imageRendering,
  }));
  expect(Math.abs(css.w - css.bw)).toBeLessThan(1);
  expect(Math.abs(css.h - css.bh)).toBeLessThan(1);
  expect(css.rendering).toBe("pixelated");
});

test("golden frame: seed TESTAA after 300 ticks", async ({ page }) => {
  test.skip(config.renderer !== "canvas", "goldens are kept for the canvas renderer only");
  await openGame(page);
  await api(page, "g.step(300); g.render();");
  // Update deliberately with: npx playwright test pixels --update-snapshots
  // then LOOK at the new image before committing it.
  await expect(page.getByTestId("game-view")).toHaveScreenshot("arena-t300.png", { maxDiffPixels: 0 });
});
