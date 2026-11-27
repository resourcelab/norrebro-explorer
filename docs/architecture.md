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

- **Done:** the import (`tools/import-osm.mjs` → `data/world/`) for inner Nørrebro, and the prototype
  (`prototypes/assistens-paper-map/`), now split into a game core and swappable styles:
  - `src/core/` is the game with no graphics: the map, the placement plan, the world as a list of plain things
    (`world.js`), input, walking and collision, near/far, the cyclists, and "where am I". It is tested in Node, and a
    test fails if it ever imports a style or three.js.
  - `src/styles/<name>/` draws the game. A style implements four calls (`build`, `start`, `near`, `zoom`; see
    `src/styles/README.md`). Two exist: `papercraft` (the 3D paper diorama, with the papercraft harness in "drive"
    mode so the core moves the walker) and `flat` (a 2D top-down map), switched with `?style=`.
  - `src/ui/` holds the overlays (minimap, compass, labels, street sign, zoom button), which read the game state and
    work over any style.
  - **One coordinate frame:** metres from the imported area's north-west corner (x east, z south), the frame of
    `data/world/`. `src/core/geo.js` is the only code that knows longitude and latitude; a test checks no other file
    projects.
  - **The core reads the world tiles.** `scripts/pack-world.mjs` packs `data/world/` into what the game loads (100 m
    tiles with a 30 m margin, simplified, plus an overview of the whole area). `core/world/store.js` loads the tiles
    within 400 m of the walker and drops those beyond ~520 m; each tile is planned on its own with its own seed (the
    same answer whatever else is loaded); a spatial index answers "what is here?" for collision and planning.
    Assistens Kirkegård is a **site**: a hand-kept, more detailed plan laid over the tiles it covers.
  - **Styles are apart from papercraft.** Every thing has a category (`core/kinds.js`), so a style draws kinds it
    doesn't know plainly instead of breaking; each style lists the kinds it draws itself (`kinds.js`), checked by a
    test. Sites hand styles plain ground layers. The page's credit and hint, and the review capture hook, come from the
    style.
  - **Toy scale against true buildings:** built things at true height (5 m shop floor, 3 m storeys), people and what
    they use at 2× life (walker 3.5 m), in metres in `config.js` `TOY`; three zooms (street, blocks, map).
  - **Shopfronts:** named shops, cafés, schools from OpenStreetMap stand on their block's street facade
    (`core/plan/shops.js`), and "where am I" names them.
- **Next:** print the papercraft ground tile by tile (it is still one sheet for the play area, so papercraft pins those
  tiles), then grow the play area chunk by chunk (`PLAY_AREA` in `config.js`). Landmark texts. When a second app needs
  the core, it moves from the prototype to the repo root (`core/`, `styles/`) unchanged.
