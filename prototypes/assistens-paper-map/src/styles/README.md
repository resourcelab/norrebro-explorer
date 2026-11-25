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
2. List it in `src/styles/index.js`.
3. Open the page with `?style=<name>`.

Use only what the game hands you and the map modules in `src/core/map/` (read-only). Don't import another style.

## The interface

```js
export function createMyStyle(game) {
  return {
    name: 'my-style',

    // Draw the world once. game.things is every thing on the map (see below); nearIds is a Set of the ids that are
    // near the walker now. Build what you need now, or later when things come near.
    build(nearIds) {},

    // Run the frame loop. Every frame: call step(dt) (dt in seconds) BEFORE drawing, then draw game.state.
    // Set game.state.view.yaw (degrees) to your camera's turn so the compass on the minimap points true (0 if north is up).
    start(step) {},

    // Things came near or went far: { came: [ids], went: [ids] }. Show detail when near; simplify or hide when far.
    near(changes) {},

    // The zoom changed: 'walk' (about ZOOMS.walk.across units across the screen) or 'map' (ZOOMS.map.across).
    // opts.instant: no easing.
    zoom(mode, opts) {},
  };
}
```

### What the game gives you

- `game.things`: the world as plain data, built once (`src/core/world.js` lists every kind and its fields). Each
  thing is `{ id, kind, x, z, ... }`: a `tree` has `species` and `size`, a `block` its footprint `pts` and `levels`,
  a `church` its footprint and `tower`, a `corner-sign` its `names`, and so on. Coordinates are world units
  (1 unit = 5 m), x east and z south. Things marked `always` are landmarks: keep them visible at any distance.
- `game.state`, updated every step:
  - `hero`: `{ x, z, heading, speed, maxSpeed }`. Heading is in radians; 0 faces south (+z) and π/2 faces east.
  - `riders`: the cyclists, `[{ id, x, z, dx, dz }]`.
  - `zoom`: `'walk'` or `'map'`.
  - `place` and `street`: where the walker is.
- `game.plan`: placement details a style may want for decoration, such as `plan.plots` for grave beds or
  `plan.playgrounds` for sandpits.
- `src/core/map/*`: the map in world units, for drawing the ground: `STREETS`, `AREAS`, `BUILDINGS`, `CONTEXT`,
  `OUTLINE`, `PATHS` and so on.
- `game.place(x, z)` and `game.reset()`: for review tools; the papercraft style wires them to its capture hooks.
- `config.js` `TOY`: the toy-scale rules (true building heights, wider streets, taller landmarks, people and props
  larger than life). Honour them, so every style reads the same way and wayfinding works the same.

### What the game does for you

Input (keyboard: arrows or WASD, Shift to run, Z to zoom), walking and collision, the cyclists, near and far, and the
place and street lookups. The overlays in `src/ui/` (minimap, compass, home marker, place label, street sign, zoom
button) read `game.state` and sit on top of any style.

Check a new style with `npm test` (the core) and by opening it in the browser: walk around, press Z, and watch the
minimap.
