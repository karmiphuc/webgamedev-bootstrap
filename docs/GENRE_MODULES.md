# Genre modules: what each kind of clone needs on top of the template

These are design checklists, not code: each game implements them as data tables + sim rules,
following the template's boundaries. Each section lists the systems, the state they add, the
tests that matter and the traps seen in practice.

## MOBA (Dota × MLBB style, solo vs bots, offline)

Preset: `three` (angled camera) or `canvas` (top-down). Phones: virtual joystick + ability buttons.

| System | Data / state | Notes |
| --- | --- | --- |
| Map | lanes as waypoint polylines, jungle camp spawns, base/tower positions, walkable grid | author as data; validate every waypoint is reachable |
| Minion waves | wave timer, composition per wave index, per-lane spawn | deterministic timers in ticks |
| Towers / base | hp, range, target priority (minions first; switch to a hero that attacks a hero in range), protection rules | the switch rule is the most noticeable fidelity detail |
| Heroes | stats per level, ability rows (cooldown, cost, targeting: unit / point / direction / self, cast time, effects) | abilities as data + a small effect interpreter |
| Economy | gold/xp share radius, last-hit bounty, passive gold, item shop rows with recipes | Dota: last hits + denies; MLBB: simpler, faster gold |
| Respawn | timer by level, buyback (Dota) | |
| Vision | fog of war on a coarse grid, recomputed at a bounded rate | sim-side so bots respect it |
| Bots | utility AI: farm / push / fight / retreat thresholds, lane assignment | bot vs bot full matches are the soak and balance test |
| Camera | follow camera with edge/drag pan, minimap tap-to-move | the template's whole-field camera is only a start |

Tests: bot-vs-bot match on N seeds finishes within a time range; mirrored teams win ~50% across
seeds; tower target-switch rule; no unbounded entity growth across a full match; ability data validator.

## ARPG (Diablo II style, Emberfall)

Click-to-move with path smoothing; 8/16 facings; skill trees as data; loot tables with affix
rolls (seeded); inventory grid; area transitions with persistent world state; companions.
Tests: pathfinding never cuts corners or stalls; drop tables respect weights over many seeds;
save carries inventory/affixes; animation contact frame = damage tick.
Traps (from Emberfall): animation discontinuities between actions, bow/weapon grip, idle flicker,
foot sliding. Bake sprites from rigs with fixed camera/light/origin.

## Tactical mercenary campaign (Battle Brothers style, Ashen)

World map with parties and contracts; turn-based or simultaneous battles on a grid; perks and
backgrounds; injuries; equipment layers on portraits. Keep combat headless so whole battles run in
tests and in a worker. Tests: headless battle outcomes are deterministic; balance probes over many
seeds; save validation. Traps: fixtures drifting with balance changes (prefer ranges/invariants).

## Autonomous village / management sim (Dungeon Village / Kairosoft style, Wayfarer)

Agents with needs and utility-scored decisions on a schedule (not every frame); buildings as data;
economy loop; seeded events; bot player for 30-month soaks with star/rank gates.
Tests: bot reaches milestone within range; every event ends and cleans up; per-step cost budget.
Traps: per-frame pathfinding or radial scans; derived totals written directly into state.

## Crew / ship sim (Pixel Piracy style, Pirate Crew)

Station tasks with reservations; navigation graph rebuilt on layout changes; boarding; loot.
Tests: reservation released on death/move; reward applied once on reload/retry; hidden tab does not
advance needs. Traps: renderer-owned positions; unbounded task queues; scene restart doubling listeners.

## Shared building blocks to add when a genre needs them

| Block | Put it in | Rule |
| --- | --- | --- |
| A* / flow-field pathfinding | `src/sim/path.ts` | typed arrays, bounded expansions per tick, cache by grid revision |
| Spatial hash | `src/sim/spatial.ts` | only after a measured scan bottleneck |
| Ability/effect interpreter | `src/sim/effects.ts` + `src/content/abilities.ts` | effects are data; validator checks every effect key is implemented |
| Utility AI | `src/sim/ai.ts` | decisions at a fixed lower rate (e.g. 4 Hz), seeded tie-breaks |
| Bot player | `tests/sim/bot.ts` | uses only public `Command`s, like a player |
