# Third-party material and data licences

The project's own code is MIT licensed (see `LICENSE`). It also contains or is built from the following.

## Map data: OpenStreetMap (ODbL 1.0)

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). It is in:

- `data/raw/` (the downloaded extract) and `data/world/` (the tiles made from it)
- `prototypes/assistens-paper-map/src/data/assistens-osm.js` and `surroundings.js`
- the built pages in `prototypes/*/dist/`, which carry the data inside them

The ODbL asks that you credit OpenStreetMap wherever the map is shown (the prototype prints
"Layout © OpenStreetMap contributors" in the corner) and share changes to the *data* itself under the same licence.
The MIT licence covers the code only, not the data.

## papercraft (MIT)

`prototypes/assistens-paper-map/vendor/papercraft/` is copied from [xikhar/papercraft](https://github.com/xikhar/papercraft)
(© 2026 Shikhar, MIT; see the `LICENSE` and `README.md` in that folder, including the one local change).

## three.js (MIT)

[three.js](https://threejs.org) © three.js authors, MIT. Installed from npm, and bundled into the built pages.

## Texts

Short descriptions of people buried at Assistens Kirkegård (`src/data/notable-graves.js`) are written for this
project from public facts (names, dates, professions).
