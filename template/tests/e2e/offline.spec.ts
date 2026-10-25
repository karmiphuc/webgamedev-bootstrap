// The built game must keep working with no network (personal offline play).
import { expect, test } from "@playwright/test";
import { api, openGame } from "./helpers";

test("installs the offline cache and boots with the network off", async ({ page, context }) => {
  await openGame(page);
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === "activated");
  await page.reload(); // now controlled by the worker
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const release = await (await page.request.get("release.json")).json();
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain(release.cache);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __game?: { ready: boolean } }).__game?.ready === true);
  expect(await api<string>(page, "return g.state().phase;")).toBe("play");
  await context.setOffline(false);
});
