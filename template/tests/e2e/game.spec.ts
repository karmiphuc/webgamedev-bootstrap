// Game-owned browser tests: this game's UI and input. Change freely.
import { expect, test } from "@playwright/test";
import { api, openGame } from "./helpers";

test("HUD shows the world code and sits above the game view", async ({ page }) => {
  await openGame(page);
  await expect(page.locator(".hud-stats")).toContainText("World TESTAA");
  const view = (await page.getByTestId("game-view").boundingBox())!;
  const hud = (await page.locator(".hud-bar").boundingBox())!;
  const stage = (await page.locator("#stage").boundingBox())!;
  expect(view.y).toBeGreaterThanOrEqual(hud.y + hud.height - 0.5);
  expect(view.y + view.height).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
});

test("tapping the map moves the hero (input -> command -> state)", async ({ page }) => {
  await openGame(page);
  const before = await api<{ x: number; y: number }>(page, "return g.state().hero;");
  const target = await api<{ x: number; y: number }>(page, `return g.toScreen(3, ${before.y});`);
  await page.mouse.click(target.x, target.y);
  await api(page, "g.step(60);");
  const after = await api<{ x: number; y: number }>(page, "return g.state().hero;");
  expect(after.x).toBeLessThan(before.x - 1);
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
