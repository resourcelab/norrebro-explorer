# data

Generated map data. Don't edit these files by hand: change the tool in `tools/` and regenerate.

Map data © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) (see `NOTICE.md`).

## raw/

OpenStreetMap extracts as downloaded, named by date and area, e.g. `2026-11-23-inner-norrebro-osm.json`: the
OpenStreetMap API's `map.json` for bbox 12.541, 55.6835, 12.566, 55.6965 (lon/lat), fetched as four quarters and merged.

## world/

The area cut into square tiles by `tools/import-osm.mjs`. Format `norrebro-explorer/world@1`:

| File | Contents |
|---|---|
| `manifest.json` | origin (the area's north-west corner, lon/lat), bbox, tile size (100 m), grid size, tile list, counts, source and licence |
| `streets.json` | street name → the tiles it runs through (for routes and "which street is this?") |
| `tiles/<i>_<j>.json` | every feature touching tile column i, row j |

Coordinates are metres from the origin, **x east and z south**. Each tile has its `i`, `j` and:

- `streets`: `{ id, name, kind, width, surface, pts }` (width in metres, estimated from the street type when not mapped)
- `buildings`: `{ id, pts, levels, kind, name }`
- `areas`: `{ id, kind, name, pts }`: park, grass, garden, wood, scrub, pitch, playground, cemetery, square, parking,
  schoolyard, flowerbed, water
- `barriers`: walls, fences, hedges as `{ id, kind, pts }`
- `trees`: `[x, z]`
- `props`: `[x, z, kind]`: bench, bikes, lamp, bin, picnic, tap
- `pois`: `{ id, x, z, name, category, tags }`: named shops, cafés, schools, sights and so on

A feature that crosses a tile edge is listed in every tile it touches, with the same `id`; de-duplicate by `id`.

Besides the outlines, the importer keeps what the game places for children: areas carry `sport` (pitches) and `of`
(a schoolyard's school, kindergarten or childcare); props include playground equipment (`play:swing`,
`play:slide`...), crossings (`crossing:zebra`, `crossing:traffic_signals`...), `signals` and `bus-stop`, and props
mapped as a strip (a bike-parking row, a swing frame) carry their direction and length: `[x, z, kind, angle, length]`.
Barriers (fences, hedges, walls) are lines.

The game doesn't load these directly: `prototypes/assistens-paper-map/scripts/pack-world.mjs` packs them (simplified,
re-tiled with a margin, plus an overview of the whole area) into what the browser fetches. The game's coordinates are
this same frame (see the prototype's `src/core/geo.js`).

## landmarks/ (planned)

Hand-written, fact-checked landmark texts in Danish and English. Format in `docs/architecture.md`.
