// Runs on desktop, tablet and phone viewports against the built artifact.
import { expect, test } from "@playwright/test";
import { hashState } from "../../src/core/hash";
import { codeToSeed } from "../../src/core/rng";
import { Sim } from "../../src/sim/sim";
import { newGame } from "../../src/sim/state";
import { api, expectNoHorizontalOverflow, openGame, watchProblems } from "./helpers";

test("boots cleanly: no errors, no missing files, HUD visible, fits the screen", async ({ page }) => {
  const problems = watchProblems(page);
  await openGame(page);
  await expect(page.locator(".hud-stats")).toContainText("World TESTAA");
  await expect(page.locator(".stage-canvas")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // The game view must sit entirely inside the stage: below the HUD and
  // inside the viewport (catches stale sizing after layout changes).
  const box = (await page.locator(".stage-canvas").boundingBox())!;
  const stage = (await page.locator("#stage").boundingBox())!;
  const hud = (await page.locator(".hud-bar").boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(hud.y + hud.height - 0.5);
  expect(box.x).toBeGreaterThanOrEqual(stage.x - 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(Math.min(vp.height, stage.y + stage.height) + 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(Math.min(vp.width, stage.x + stage.width) + 0.5);
  expect(problems).toEqual([]);
});

test("browser simulation matches the Node simulation tick for tick", async ({ page }) => {
  await openGame(page);
  const browserHash = await api<string>(page, "return g.step(400);");
  const s = newGame(codeToSeed("TESTAA")!);
  const sim = new Sim(s);
  for (let i = 0; i < 400; i++) sim.step();
  expect(browserHash).toBe(hashState(s));
});

test("tapping the map moves the hero (input -> command -> state)", async ({ page }) => {
  await openGame(page);
  const before = await api<{ x: number; y: number }>(page, "return g.state().hero;");
  // Click the world point 3 tiles from the left edge, on the hero's row.
  const target = await api<{ x: number; y: number }>(page, `return g.toScreen(3, ${before.y});`);
  await page.mouse.click(target.x, target.y);
  await api(page, "g.step(60);");
  const after = await api<{ x: number; y: number }>(page, "return g.state().hero;");
  expect(after.x).toBeLessThan(before.x - 1);
});

test("progress survives a reload; ?seed is stripped so reload does not reset", async ({ page }) => {
  await openGame(page);
  await api(page, "g.step(120); g.save();");
  const tick = await api<number>(page, "return g.state().tick;");
  expect(page.url()).not.toContain("seed=");
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __game?: { ready: boolean } }).__game?.ready);
  expect(await api<number>(page, "return g.state().tick;")).toBeGreaterThanOrEqual(tick);
});

test("menu, credits and in-game dialogs work without browser popups", async ({ page }) => {
  page.on("dialog", () => {
    throw new Error("native alert/confirm/prompt must not be used");
  });
  await openGame(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Credits" }).click();
  await expect(page.locator(".credits li").first()).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByText("Start a new game?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".panel")).toBeHidden();
});

test("a long session keeps resources bounded", async ({ page }) => {
  await openGame(page);
  const before = await api<number>(page, "return g.diagnostics().lifetimeResources;");
  await api(page, "for (let i = 0; i < 10; i++) g.step(600);");
  const d = await api<{ lifetimeResources: number; enemies: number; errors: string[] }>(page, "return g.diagnostics();");
  expect(d.lifetimeResources).toBe(before);
  expect(d.enemies).toBeLessThanOrEqual(24);
  expect(d.errors).toEqual([]);
});
