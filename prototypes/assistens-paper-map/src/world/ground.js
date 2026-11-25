/**
 * The printed ground sheet everything stands on, painted once into one big texture by the harness's printGround.
 * Layers, bottom to top: the neighbourhood (parks, streets, flat roofs, street names), then the cemetery (lawn,
 * plot beds, fallen leaves, paths, the chapel forecourt). Each layer lives in its own module.
 *
 * Every layer function gets the same drawing context `k` from printGround:
 *   g        a 2D canvas context; X(x), Z(z) turn world units into canvas pixels, ppu = pixels per unit
 *   rnd      the print's seeded random stream (use it, not Math.random, so the ground is the same every load)
 *   torn(pts, fill, edge?)       a torn-paper polygon      bandOf(pts, half)  a polyline thickened into a polygon
 *   line(pts, half, colour)      a soft stroke             washes(colours)    watercolour washes over the clip
 *   drifts(fn, { n })            scattered marks (leaves, grass) placed by drift noise
 */
import { printNeighbourhoodGround } from './ground-neighbourhood.js';
import { printCemeteryGround } from './ground-cemetery.js';

/** Ground print resolution: pixels per world unit. 16 keeps the ~180 × 180-unit sheet near 2900 px (GPU texture limits). */
const PIXELS_PER_UNIT = 16;

export function printGround(H, plan) {
  H.printGround((k) => {
    printNeighbourhoodGround(k, plan);
    printCemeteryGround(k, plan);
  }, { ppu: PIXELS_PER_UNIT });
}
