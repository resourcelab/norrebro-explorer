/**
 * The neighbourhood round the cemetery walls in world units: the play region, streets, areas (parks, playgrounds,
 * pitches, squares, water) and building footprints, plus fast "what is here?" lookups.
 * Source: src/data/surroundings.js (generated from the project's OpenStreetMap world tiles).
 */
import { SURROUNDINGS } from '../data/surroundings.js';
import { SCALE } from '../config.js';
import { toUnits } from './units.js';
import { inPolygon, polylineDistance, signedArea, boundsOf } from './math.js';
import { OUTLINE } from './cemetery.js';

/** Margin (units) kept between the edge of the extracted data and the edge of the play region. */
const REGION_MARGIN = 4;

/** The play area: the cemetery and the streets, blocks and parks round it (world units). */
export const REGION = (() => {
  const [x0, z0, x1, z1] = SURROUNDINGS.region.map((v) => v * SCALE);
  return { x0: x0 + REGION_MARGIN, z0: z0 + REGION_MARGIN, x1: x1 - REGION_MARGIN, z1: z1 - REGION_MARGIN };
})();
export const inRegion = (x, z) => x > REGION.x0 && x < REGION.x1 && z > REGION.z0 && z < REGION.z1;

/** Streets and footways: { name, kind, width (m), pts, half (half width in units) }. */
export const STREETS = SURROUNDINGS.streets.map((s) => ({ ...s, pts: s.pts.map(toUnits), half: (s.width * SCALE) / 2 }));
/** Areas: { kind, name, pts }. Kinds: park, grass, garden, pitch, playground, square, schoolyard, parking, flowerbed, water. */
export const AREAS = SURROUNDINGS.areas.map((a) => ({ ...a, pts: a.pts.map(toUnits) }));

/** Signed distance to the nearest street edge: negative on a street. */
export function streetDistance(x, z) {
  let d = Infinity;
  for (const s of STREETS) d = Math.min(d, polylineDistance(x, z, s.pts) - s.half);
  return d;
}

export const inWater = (x, z) => AREAS.some((a) => a.kind === 'water' && inPolygon(x, z, a.pts));

// ---- buildings --------------------------------------------------------------------------------------------------------
/** Blocks this close to the cemetery outline (units, ~55 m) stand up in 3D; the rest are printed flat as roofs. */
const RAISE_WITHIN = 11;
/** Smallest footprint that stands up (units², 4 = 100 m²); smaller ones are sheds and booths. */
const MIN_RAISED_AREA = 4;
/** Untagged ("yes") buildings need this much floor (units², 250 m²) or a mapped storey count to stand up. */
const MIN_UNTAGGED_AREA = 10;
/** Building kinds that never stand up: outbuildings and structures without walls worth folding. */
const NEVER_RAISED = new Set(['garage', 'garages', 'shed', 'kiosk', 'roof', 'carport', 'service', 'toilets']);
/** Footprints with more corners than this are printed flat (prism folds of very ragged outlines look messy). */
const MAX_RAISED_CORNERS = 40;

/**
 * Buildings outside the walls: { id, kind, levels, name, pts, area, raised, box }.
 * pts are wound with negative signed area, so the shape lies behind its first edge (what prismFold expects).
 */
export const BUILDINGS = SURROUNDINGS.buildings
  .map((b) => {
    let pts = b.pts.map(toUnits);
    if (signedArea(pts) > 0) pts = pts.slice().reverse();
    const inside = pts.every(([x, z]) => inPolygon(x, z, OUTLINE));
    const near = Math.min(...pts.map(([x, z]) => polylineDistance(x, z, OUTLINE))) < RAISE_WITHIN;
    const area = Math.abs(signedArea(pts));
    const bigEnough = area >= MIN_RAISED_AREA && (b.kind !== 'yes' || b.levels || area >= MIN_UNTAGGED_AREA);
    const raised = near && !inside && bigEnough && !NEVER_RAISED.has(b.kind) && pts.length <= MAX_RAISED_CORNERS;
    const { x0, z0, x1, z1 } = boundsOf(pts);
    return { ...b, pts, area, raised, inside, box: [x0, z0, x1, z1] };
  })
  .filter((b) => !b.inside); // the cemetery's own buildings come from assistens-osm.js

// A coarse grid of building lists, so "is this point inside a building?" checks a handful of footprints, not 600.
const CELL = 8;
const cellKey = (i, j) => i + ',' + j;
const grid = new Map();
for (const b of BUILDINGS) {
  for (let i = Math.floor(b.box[0] / CELL); i <= Math.floor(b.box[2] / CELL); i++) {
    for (let j = Math.floor(b.box[1] / CELL); j <= Math.floor(b.box[3] / CELL); j++) {
      const k = cellKey(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(b);
    }
  }
}

/** The building at (x, z), or within `pad` units of it, else null. */
export function buildingAt(x, z, pad = 0) {
  // check every cell the padded point can touch (pad is always far smaller than a cell)
  const seen = new Set();
  for (let i = Math.floor((x - pad) / CELL); i <= Math.floor((x + pad) / CELL); i++) {
    for (let j = Math.floor((z - pad) / CELL); j <= Math.floor((z + pad) / CELL); j++) {
      for (const b of grid.get(cellKey(i, j)) ?? []) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (x < b.box[0] - pad || x > b.box[2] + pad || z < b.box[1] - pad || z > b.box[3] + pad) continue;
        if (inPolygon(x, z, b.pts)) return b;
        if (pad > 0 && polylineDistance(x, z, [...b.pts, b.pts[0]]) < pad) return b;
      }
    }
  }
  return null;
}
