# tools

Scripts that turn OpenStreetMap into the game's world data. Run them from the repo root.

## import-osm.mjs: OpenStreetMap extract → world tiles

```sh
node tools/import-osm.mjs data/raw/2026-11-23-inner-norrebro-osm.json data/world --tile=100
# or: npm run import-osm -- data/raw/<extract>.json data/world
```

Input: an OpenStreetMap API `map.json` (or Overpass JSON) export. Output: `data/world/` (format in `data/README.md`).
It works for any area: point it at a different extract to build a different neighbourhood.

### Getting an extract

The OpenStreetMap API returns at most 50 000 nodes per request, so fetch a larger area in pieces and merge them:

```
https://api.openstreetmap.org/api/0.6/map.json?bbox=<west>,<south>,<east>,<north>
```

Inner Nørrebro (12.541, 55.6835 → 12.566, 55.6965) was fetched as four quarters. Merge the quarters' `elements` (drop
duplicate `type`+`id`), set `bbox: [west, south, east, north]` on the merged object and save it to
`data/raw/<date>-<area>-osm.json`.

## preview.py: a top-down picture of the tiles

```sh
python3 tools/preview.py data/world docs/world-preview.png 0.6    # 0.6 pixels per metre
```

Needs Pillow (`pip install -r requirements-dev.txt`). Useful to check an import by eye.

## Prototype tools

The papercraft prototype has its own, in `prototypes/assistens-paper-map/`: `scripts/pack-world.mjs` (packs
`data/world/` into the tiles the game loads: simplified, with a margin, plus an overview) and `tools/capture.py`
(headless screenshots).
