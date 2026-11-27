/**
 * The printed ground sheet everything stands on, painted once into one big texture by the harness's printGround.
 * Layers, bottom to top: the neighbourhood (parks, streets, flat roofs, street names), then each site from its ground
 * layers (Assistens: lawn, plot beds, fallen leaves, paths, the chapel forecourt). Each layer lives in its own module.
 *
 * The sheet covers the play area and a ring of the overview round it, so the style pins the play area's tiles
 * (index.js): they are all loaded before the sheet is printed. Printing the ground tile by tile, so it too can stream,
 * is the next step before the map grows much bigger.
 *
 * Every layer function gets the same drawing context `k` from printGround:
 *   g        a 2D canvas context; X(x), Z(z) turn world units into canvas pixels, ppu = pixels per unit
 *   rnd      the print's seeded random stream (use it, not Math.random, so the ground is the same every load)
 *   torn(pts, fill, edge?)       a torn-paper polygon      bandOf(pts, half)  a polyline thickened into a polygon
 *   line(pts, half, colour)      a soft stroke             washes(colours)    watercolour washes over the clip
 *   drifts(fn, { n })            scattered marks (leaves, grass) placed by drift noise
 */
import { printNeighbourhoodGround } from './ground-neighbourhood.js';
import { printSiteGround } from './ground-site.js';

/** Ground print resolution: pixels per world unit. 14 keeps the ~240 × 255-unit sheet under 3600 px (GPU texture limits). */
const PIXELS_PER_UNIT = 14;

/** @param map game.map */
export function printGround(H, map) {
  H.printGround((k) => {
    printNeighbourhoodGround(k, map);
    for (const site of map.sites) printSiteGround(k, site, map.sitePlans[site.id]);
  }, { ppu: PIXELS_PER_UNIT });
}
