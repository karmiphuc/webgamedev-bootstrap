# Game brief — {{GAME_NAME}}

Reference game: **{{REFERENCE_GAME}}** · Renderer: `{{RENDERER}}` · Asset policy: `{{ASSET_POLICY}}`

Fill this in BEFORE building features, and keep it short. Agents read it first.

## 1. Intent

- **What I want to feel:** _(one sentence, e.g. "the 20-minute lane-push-and-gank loop of a MOBA, solo vs bots, offline")_
- **Personal flavour:** _(what deliberately differs from the reference: hybrid of A × B, removed grind, faster matches…)_
- **Target devices:** _(desktop browser / iPad / phone; touch or mouse; offline?)_
- **Session length:** _(e.g. 15–25 min matches; or long-running sim you leave open)_

## 2. Core loop

_(3–6 steps the player repeats; e.g. farm creeps → buy item → fight at objective → push → repeat)_

1.
2.
3.

## 3. Scope ladder

Build in this order; each rung must be playable and pass `npm run check:full` before the next.

| Rung | Playable result | Status |
| --- | --- | --- |
| 0 | Template runs with placeholder art | done |
| 1 | Core verb feels right (move/attack/build…) with one unit type | |
| 2 | Core loop closes once (start → goal → win/lose → restart) | |
| 3 | Persistence + progression across sessions | |
| 4 | Content breadth (units/items/maps from data tables) | |
| 5 | Polish: art pass, audio, juice, tutorial | |

## 4. Out of scope (for now)

_(multiplayer, accounts, backend, mod support, …: listing these prevents creep)_

## 5. Open questions

| Question | Why it matters | How to resolve |
| --- | --- | --- |
| | | |
