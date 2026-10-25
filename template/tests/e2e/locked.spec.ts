// LOCKED (see docs/CHARTER.md). The generic browser contract every game keeps,
// tested against the BUILT game on desktop, tablet and phone:
//   - boots with no errors, failed requests or native dialogs
//   - the game view (data-testid="game-view") fits the screen; no sideways scroll
//   - the browser runs exactly the same simulation as Node (state hash)
//   - progress survives a reload; ?seed is stripped from the URL
//   - long sessions keep owned resources bounded
//   - (desktop) works offline after the first visit
// It relies only on window.__game (ready, step, hash, state().tick, save,
// diagnostics) and src/sim/testkit.ts.
import { expect, test } from "@playwright/test";
import { hashState } from "../../src/core/hash";
import { codeToSeed } from "../../src/core/rng";
import { advance, createGame } from "../../src/sim/testkit";
import { api, expectNoHorizontalOverflow, openGame, watchProblems } from "./helpers";

test("boots cleanly and the game view fits the screen", async ({ page }) => {
  const problems = watchProblems(page);
  page.on("dialog", (d) => problems.push(`native dialog: ${d.type()} ${d.message()}`));
  await openGame(page);
  await api(page, "g.step(600);");
  const view = page.getByTestId("game-view");
  await expect(view).toBeVisible();
  const box = (await view.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.y).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
  await expectNoHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test("browser simulation matches the Node simulation tick for tick", async ({ page }) => {
  await openGame(page);
  const browserHash = await api<string>(page, "return g.step(400);");
  const s = createGame(codeToSeed("TESTAA")!);
  advance(s, 400);
  expect(browserHash).toBe(hashState(s));
});

test("progress survives a reload and ?seed is stripped", async ({ page }) => {
  await openGame(page);
  await api(page, "g.step(120); g.save();");
  const tick = await api<number>(page, "return g.state().tick;");
  expect(page.url()).not.toContain("seed=");
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __game?: { ready: boolean } }).__game?.ready === true);
  expect(await api<number>(page, "return g.state().tick;")).toBeGreaterThanOrEqual(tick);
});

test("a long session keeps owned resources bounded and error-free", async ({ page }) => {
  await openGame(page);
  const before = await api<number>(page, "return g.diagnostics().lifetimeResources;");
  await api(page, "for (let i = 0; i < 10; i++) g.step(600);");
  const d = await api<{ lifetimeResources: number; errors: string[] }>(page, "return g.diagnostics();");
  expect(d.lifetimeResources).toBe(before);
  expect(d.errors).toEqual([]);
});

test("installs the offline cache and boots with the network off", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "offline is checked once, on desktop");
  await openGame(page);
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === "activated");
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const release = await (await page.request.get("release.json")).json();
  expect(await page.evaluate(() => caches.keys())).toContain(release.cache);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __game?: { ready: boolean } }).__game?.ready === true);
  expect(await api<number>(page, "return g.state().tick;")).toBeGreaterThanOrEqual(0);
  await context.setOffline(false);
});
