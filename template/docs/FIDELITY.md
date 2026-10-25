# Fidelity tracker — {{GAME_NAME}} vs {{REFERENCE_GAME}}

A working comparison, not a claim of a 1:1 recreation. Keep **observed** facts (measured in the
reference build, or from a dated primary source) separate from **authored** values (our guesses
and design choices). Never present an authored number as the original's.

Reference build examined: _(platform, version/patch, date)_ · Sources: see §3.

## 1. Systems

| Reference behaviour | Evidence (observed / source + date) | Delivered here | Gap / next step |
| --- | --- | --- | --- |
| _e.g. creeps spawn every 30 s per lane_ | _observed in patch 7.36, 2026-10-20, timed 5 waves_ | _waves every 600 ticks (authored)_ | _lane pathing not yet_ |

## 2. Numbers

| Value | Reference (observed) | Ours | Status |
| --- | --- | --- | --- |
| _hero base move speed_ | _unknown_ | _4 tiles/s_ | authored |

Status is one of: `observed` (measured, matches), `adapted` (measured, deliberately changed),
`authored` (no measurement: our design value), `unknown`.

## 3. Sources

| Source | What it supports | Date checked | Reliability notes |
| --- | --- | --- | --- |
| | | | _wikis often describe older patches_ |

## 4. Visual fidelity

See [ART_DIRECTION.md](ART_DIRECTION.md) §1 for the measured reference table and the
evidence reviews in [evidence/](evidence/).
