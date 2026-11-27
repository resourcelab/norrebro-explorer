# Styles

A style is how the game looks. The game itself (the map, where everything stands, walking, collision, near and far,
where you are) lives in `src/core/` and knows nothing about drawing. Every style draws the same game, so you can switch
with `?style=<name>` and compare them on the same Nørrebro.

| Style | Folder | Look |
|---|---|---|
| `papercraft` (default) | `papercraft/` | a pop-up paper diorama in 3D (three.js and the vendored papercraft kit) |
| `flat` | `flat/` | a clean top-down map on a 2D canvas |

## Adding a style

1. Make `src/styles/<name>/index.js` exporting a factory `create<Name>Style(game)` that returns the object below.
2. Make `src/styles/<name>/kinds.js` exporting `DRAWS`, the set of kinds you draw in your own way.
3. List the style in `src/styles/index.js`.
4. Open the page with `?style=<name>`. `npm test` checks your `DRAWS` covers every kind in `src/core/kinds.js`.

Draw any kind you don't know by its `category` (every thing has one: building, landmark, barrier, tree, monument,
prop, animal, sign, place), so a new kind never breaks your style, it only looks plainer until you learn it.

Use only what the game hands you (`game.map` for the ground, `game.things` for what stands on it). Don't import another
style, and don't reach into `src/core/` for map data: it comes and goes with the tiles.

## The interface

```js
export function createMyStyle(game) {
  return {
    name: 'my-style',

    // Optional: tiles to load before build() and never drop, as { x0, z0, x1, z1 } in units. Pin only if you must
    // draw a fixed area at once (papercraft pins the play area: its ground is printed as one sheet). Without pins,
    // tiles stream round the walker.
    pins: null,

    // Draw the world. game.things is every thing present now (see below); nearIds is a Set of the ids that are near
    // the walker now. Build what you need now, or later when things come near.
    build(nearIds) {},

    // Tiles loaded or dropped: things arrived (plain things, as in game.things) or left for good (ids). Free what you
    // built for removed things. A thing that arrives is far until near() says it came near.
    add(things) {},
    remove(ids) {},

    // Run the frame loop. Every frame: call step(dt) (dt in seconds) BEFORE drawing, then draw game.state.
    // Set game.state.view.yaw (degrees) to your camera's turn so the compass on the minimap points true (0 if north is up).
    start(step) {},

    // Things came near or went far: { came: [ids], went: [ids] }. Show detail when near; simplify or hide when far.
    near(changes) {},

    // The zoom changed: 'street', 'neighbourhood' or 'map' (about ZOOMS[mode].across units across the screen, see
    // config.js). The game starts in game.state.zoom. opts.instant: no easing.
    zoom(mode, opts) {},

    // Optional, for the page: a credit line for your art, and the controls hint.
    credit: '', hint: '',

    // For review captures (tools/capture.py): ready() once you can draw, step(sec) to run the game and draw on a fixed
    // clock, restart() back to the start.
    capture: { ready() {}, step(sec) {}, restart() {} },
  };
}
```

### What the game gives you

- `game.things`: the things present now, as plain data (`src/core/world.js` lists every kind and its fields). Each
  thing is `{ id, kind, x, z, tile, ... }`: a `tree` has `species` and `size`, a `block` its footprint `pts` and
  `levels`, a `church` its footprint and `tower`, a `corner-sign` its `names`, and so on. Coordinates are world units
  (1 unit = 5 m) in the world frame (`src/core/geo.js`), x east and z south. Things marked `always` are landmarks:
  keep them visible at any distance. The list changes as tiles load and unload (`add`, `remove`).
- `game.state`, updated every step:
  - `hero`: `{ x, z, heading, speed, maxSpeed }`. Heading is in radians; 0 faces south (+z) and π/2 faces east.
  - `riders`: the cyclists, `[{ id, x, z, dx, dz }]`.
  - `zoom`: `'street'`, `'neighbourhood'` or `'map'`.
  - `place` and `street`: where the walker is.
- `game.map`, for drawing the ground (read-only, units):
  - `region` (the play area) and `bounds` (the whole imported area)
  - `overview`: `{ streets, areas, buildings }` for the whole area, simplified: far views, map views, minimaps
  - `features('streets' | 'areas' | 'buildings')`: the loaded tiles' outlines, each once; `tiles()` the loaded tiles
    (each has `rect` and `plan`, e.g. `plan.playgrounds` for sandpits); `onTiles(fn)` when they change
  - `sites`, each with `ground`: plain layers like the tiles' (`areas` [{ kind, pts }], `paths` [{ kind, surface,
    half, pts }]), so you draw a site without knowing which it is; and `sitePlans` (e.g. `sitePlans.assistens.plots` for grave
    beds); `landmarks`; `blocks(x, z)`, the map's own "can't stand here"
- `game.place(x, z)`, `game.goTo(x, z)` (loads the tiles there first) and `game.reset()`: for review tools; the
  papercraft style wires them to its capture hooks.
- `config.js` `TOY`: the toy-scale rules, in metres as drawn: `TOY.heights` (walker 3.5 m, bench 1.8 m, a tree 18 m...),
  `TOY.storey` and `TOY.groundFloor` for buildings, `TOY.streetWiden`, `TOY.landmark`. Honour them, so every style keeps
  the same proportions and the walker always fits under a shop sign. A thing's own `size` (trees, graves) is a
  variation round its kind's height.

### What the game does for you

Input (keyboard: arrows or WASD, Shift to run, Z to zoom), walking and collision, the cyclists, near and far, loading
and dropping tiles as the walker moves, and the place and street lookups. The overlays in `src/ui/` (minimap, compass, home marker, place label, street sign, zoom
button) read `game.state` and sit on top of any style.

Check a new style with `npm test` (the core) and by opening it in the browser: walk around, press Z, and watch the
minimap.
