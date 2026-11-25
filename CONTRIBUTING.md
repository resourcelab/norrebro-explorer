# Contributing

Thanks for helping. This is a small project, so the rules are short.

## Set up

```sh
npm install
npm run check      # lint + tests + build: run this before every commit (CI runs the same)
```

Optional, for the Python tools (world preview, data extraction, review screenshots):

```sh
pip install -r requirements-dev.txt
playwright install chromium
```

## Working on the prototype

```sh
cd prototypes/assistens-paper-map
npm run dev        # http://localhost:5173/src/ (ES modules need a local server)
npm test           # map and walking-rule tests (Node, no browser)
npm run build      # dist/assistens-kirkegaard-paper-walk.html
npm run capture    # headless screenshots into docs/frames/ (needs Playwright)
```

Commit the rebuilt `dist/` page together with the source change, so the double-click copy stays current.

## Code conventions

- **Plain JavaScript ES modules**, no framework and no TypeScript. Formatting: 2 spaces, single quotes, semicolons,
  lines up to ~120 characters (see `.editorconfig`). ESLint must pass with no warnings.
- **Every file starts with a comment** saying what it is for and how it fits in. Comment the *why* (a constant's
  meaning, a workaround, a unit), not what the next line obviously does.
- **Name the numbers.** Distances, sizes and counts that mean something go in a named constant with a comment giving
  the unit, e.g. `const BUILDING_CLEARANCE = 0.3; // units`.
- **Coordinates:** points are `[x, z]`, x east and z **south**, so z grows down the screen like image rows and three.js
  ground. Data files store metres; the prototype's world uses units of 5 m (`SCALE` in `src/config.js`).
- **Seeded randomness only** (`P2.rng(seed)` or the plan's `rnd`), never `Math.random`, so the world is the same on
  every load.
- **Layers:** `data/` holds no logic, `map/` holds no randomness, `plan/` decides positions only, `pieces/` decide looks
  only, and `world/` puts them together. Keep new code on the right layer.
- **Generated files** (`src/data/surroundings.js`, `data/world/`, `dist/`) are never edited by hand: change the tool and
  regenerate.

## Map data

Map data comes from OpenStreetMap (ODbL). Don't paste data from other maps (Google Maps, Apple Maps, etc.): their
licences don't allow it. If something is wrong on the map, the best fix is to correct it in OpenStreetMap itself and
re-import.

## Landmark texts

Facts about places and people need a source (a link in the landmark's `sources`). Keep kid texts short and concrete.
