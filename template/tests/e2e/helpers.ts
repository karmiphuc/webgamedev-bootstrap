import { expect, type Page } from "@playwright/test";

export interface GameApi {
  ready: boolean;
  version: string;
  commit: string;
  state(): { tick: number; phase: string; hero: { x: number; y: number; hp: number }; enemies: unknown[]; worldCode: string };
  hash(): string;
  step(n?: number): string;
  command(cmd: unknown): string | null;
  pause(paused?: boolean): void;
  render(): void;
  toScreen(x: number, y: number): { x: number; y: number };
  save(): string | null;
  diagnostics(): {
    renderer: Record<string, number | string | boolean>;
    frameMs: { p50: number; p95: number; count: number };
    tickMicros: { p50: number; p95: number };
    lifetimeResources: number;
    enemies: number;
    errors: string[];
  };
}

/** Collects page errors, console errors and failed/4xx requests. */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  return problems;
}

/** Opens a fresh, paused game in a fixed world so tests are deterministic. */
export async function openGame(page: Page, query = "seed=TESTAA&paused"): Promise<void> {
  await page.goto(`./?${query}`);
  await page.waitForFunction(() => (window as unknown as { __game?: GameApi }).__game?.ready === true);
}

/** Run a snippet against window.__game (bound as `g`) and return its result. */
export async function api<T>(page: Page, body: string): Promise<T> {
  return page.evaluate(`(() => { const g = window.__game; ${body} })()`) as Promise<T>;
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}
