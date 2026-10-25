# 0001: Bootstrap stack and boundaries

Date: the bootstrap date of this game · Status: adopted

## Context
Personal browser remakes of existing games, played offline on desktop/iPad/phone, built
largely by coding agents. Earlier projects showed the same failure classes repeatedly:
renderer code owning game rules, wall-clock time in rules, saves breaking on shape changes,
mixed art styles and fractional scaling, unprovenanced assets, unbounded collections,
and browser tests that did not test the shipped artifact.

## Decision
TypeScript + Vite; a pure deterministic simulation (seeded RNG in state, fixed 20 Hz tick,
commands in, events out); plain-JSON state with versioned migrations; a swappable renderer
behind a small contract; data tables with a validator; a provenance register gated by an
asset policy; Vitest for rules/determinism/soak; Playwright against the built artifact on
three viewports; human review of captured visual evidence.

## Alternatives considered
- Godot/Unity web export: strong editors, but heavier web builds, weaker DOM UI, and less
  direct control of browser lifecycle; agents iterate faster on plain TS. Their asset stores
  remain good *sources* (see docs/ASSETS.md).
- Shared npm runtime library across games: one upgrade could break every old game; the
  kernel is copied instead; `bootstrap.mjs` re-run syncs fixes safely (never touching game-owned files).
- Full ECS / workers / pooling from day one: adopt only after a measured bottleneck.

## Consequences
Rules are testable in milliseconds without a browser. Renderer choice is reversible. Every
save-shape change costs a migration and a fixture. Visual quality still needs human review.
