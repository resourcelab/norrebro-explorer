# Architecture

The game is split so the logic is written once and the look can change.

```
OpenStreetMap ──► tools/import ──► data/world/*.json (tiles)
                                        │
data/landmarks/*.json ──────────────────┤
                                        ▼
                                  core/ (game state)
                     world · player · journal · routes · missions · save
                                        │  events + a read-only view of the world
                                        ▼
                         styles/<style>/ (renderer + input)
                     papercraft (three.js) · 2D illustrated · pixel
```

## Data

- **World tiles:** the area is cut into square tiles (e.g. 100 × 100 m). Each tile lists its streets (with names),
  building footprints (with height or floors when mapped), parks and lawns, water, paths, trees, and points of interest.
  Coordinates in metres from a fixed origin, so every style uses the same positions.
- **Walk grid:** per tile, where a person can walk (pavements, paths, squares, parks) and what blocks (buildings, water,
  walls). The core uses it for movement; styles never decide collision.
- **Landmarks:** `{ id, name, position, category, text: { da: { kid, adult }, en: { kid, adult } }, sources[] }`.
  Categories: history, culture, food, play, nature, everyday (library, school, station).

## Core (no graphics)

- `world`: loads tiles near the player, answers "what is here / can I walk here / which street is this".
- `player`: chosen character, position, facing, speed; moves on the walk grid.
- `journal`: which landmarks have been found; progress per category.
- `routes`: guided walks between landmarks; turn-by-turn hints in street names ("turn left onto Elmegade").
- `missions`: kid tasks (find, count, follow a route, read the map).
- `map`: the mini-map and compass data (north arrow, street labels, "you are here").
- `save`: progress in localStorage, export/import as a code.

The core runs in plain JavaScript and can be tested without a browser window.

## Style packs

A style pack implements a small interface: `load(worldView)`, `update(state, dt)`, `showLandmark(landmark)`, and turns
input (keys, touch, click-to-walk) into core commands. Papercraft is the first pack (reusing the prototype's harness);
the 2D illustrated and pixel packs come after the style choice.

## "Explore around an address" (later)

The import tool takes an area (a bounding box or a centre + radius). For the traveller version, an address is turned
into coordinates (geocoding), the area around it is imported, and generic points of interest (cafés, parks, transport)
stand in for hand-written landmarks.

## Where things are today (November 2026)

- **Done:** the import (`tools/import-osm.mjs` → `data/world/`) for inner Nørrebro, and the papercraft prototype
  (`prototypes/assistens-paper-map/`).
- **The prototype is not yet split into core + style pack.** It already keeps the layers apart in a way that maps onto
  this plan: `src/map/` and `src/plan/` (world facts, walking rules, placement; no graphics, tested in Node) become the
  seed of `core/`, while `src/pieces/` and `src/world/` (paper prints, folds, the three.js harness) become the
  papercraft style pack.
- **Next:** landmarks data, then lift `map/` into `core/` and read the world tiles directly instead of the prototype's
  own extract (`src/data/surroundings.js`).
