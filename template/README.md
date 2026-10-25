# {{GAME_NAME}}

A personal, offline-capable browser remake study of **{{REFERENCE_GAME}}**, generated with
[webgamedev-bootstrap](https://github.com/karmiphuc/webgamedev-bootstrap).
Not affiliated with or endorsed by the original game's creators. See [CREDITS.md](CREDITS.md).

## Play

```sh
npm ci
npm run dev            # http://localhost:5173/?new
```

Tap or click to move. Space pauses. Menu → Export save keeps a backup of your progress.

## Develop

```sh
npm run check          # the gate before every commit
npm run check:full     # + soak + browser tests (run before merging)
npm run evidence       # screenshots for visual review
```

Agents and contributors: start with [AGENTS.md](AGENTS.md).
Design: [brief](docs/GAME_BRIEF.md) · [fidelity](docs/FIDELITY.md) · [art direction](docs/ART_DIRECTION.md) ·
[assets](docs/ASSETS.md) · [testing](docs/TESTING.md) · [architecture](docs/ARCHITECTURE.md)
