// LOCKED (see docs/CHARTER.md): kernel behaviour. Changing this file needs the owner-approved label.
import { describe, expect, it } from "vitest";
import { hashState, stableStringify } from "../../src/core/hash";
import { Lifetime, Samples } from "../../src/core/lifetime";
import { FixedLoop } from "../../src/core/loop";
import { SEED_LIMIT, codeToSeed, makeRng, normalizeSeed, seedToCode } from "../../src/core/rng";

describe("rng", () => {
  it("replays the same sequence from the same seed and continues after JSON round-trip", () => {
    const a = { seed: 42 };
    const b = { seed: 42 };
    const ra = makeRng(a);
    const rb = makeRng(b);
    const first = Array.from({ length: 5 }, () => ra.next());
    expect(Array.from({ length: 5 }, () => rb.next())).toEqual(first);
    // Saving mid-sequence and restoring continues identically.
    const restored = makeRng(JSON.parse(JSON.stringify(a)));
    expect(restored.next()).toBe(ra.next());
  });

  it("keeps int() within inclusive bounds", () => {
    const r = makeRng({ seed: 7 });
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
    }
  });

  it("round-trips world codes", () => {
    for (const seed of [0, 1, 123456, SEED_LIMIT - 1]) expect(codeToSeed(seedToCode(seed))).toBe(seed);
    expect(normalizeSeed(SEED_LIMIT + 5)).toBe(5);
    expect(codeToSeed("bad")).toBeNull();
  });
});

describe("fixed loop", () => {
  const make = (max = 4) => {
    let ticks = 0;
    const loop = new FixedLoop({ tickHz: 20, maxStepsPerFrame: max, step: () => ticks++, render: () => {} });
    return { loop, ticks: () => ticks };
  };

  it("runs one tick per 50 ms and keeps the remainder as alpha", () => {
    const { loop, ticks } = make();
    loop.advance(125);
    expect(ticks()).toBe(2);
    expect(loop.alpha).toBeCloseTo(0.5);
  });

  it("caps catch-up work after a stall and drops the surplus", () => {
    const { loop, ticks } = make(4);
    loop.advance(10_000);
    expect(ticks()).toBe(4);
    expect(loop.stats.droppedMs).toBeGreaterThan(9000);
    loop.advance(50);
    expect(ticks()).toBe(5);
  });

  it("does not advance while paused", () => {
    const { loop, ticks } = make();
    loop.paused = true;
    loop.advance(1000);
    expect(ticks()).toBe(0);
  });
});

describe("lifetime", () => {
  it("disposes in reverse order exactly once, including after close", () => {
    const life = new Lifetime();
    const order: number[] = [];
    life.own(() => order.push(1));
    life.child().own(() => order.push(2));
    life.dispose();
    life.dispose();
    expect(order).toEqual([2, 1]);
    life.own(() => order.push(3)); // owned after close: released immediately
    expect(order).toEqual([2, 1, 3]);
    expect(life.count).toBe(0);
  });

  it("keeps percentile samples bounded", () => {
    const s = new Samples(10);
    for (let i = 1; i <= 100; i++) s.add(i);
    expect(s.summary().count).toBe(10);
    expect(s.summary().max).toBe(100);
  });
});

describe("hash", () => {
  it("ignores key order and rejects non-finite numbers", () => {
    expect(hashState({ a: 1, b: [2, 3] })).toBe(hashState({ b: [2, 3], a: 1 }));
    expect(() => stableStringify({ hp: NaN })).toThrow(/non-finite/);
  });
});
