/**
 * The cemetery's plan in world units: outline, paths, walls with their openings, gates, the chapel and the sheds.
 * Source: src/data/assistens-osm.js (OpenStreetMap). Everything here is computed once at load and then read-only.
 */
import { OSM } from '../data/assistens-osm.js';
import { toUnits } from './units.js';
import { inPolygon, polylineDistance, segmentIntersection, boundsOf, centroid, longestEdge } from './math.js';

// ---- outline ----------------------------------------------------------------------------------------------------------
export const OUTLINE = OSM.outline.map(toUnits);
/** Bounding box of the cemetery (units). */
export const BOUNDS = boundsOf(OUTLINE);
export const insideCemetery = (x, z) => inPolygon(x, z, OUTLINE);

// ---- paths ------------------------------------------------------------------------------------------------------------
// Half widths by kind, wider than life so the toy-scale walker fits them.
// Kind codes from the data: c = cycleway, f = footway, p = path, s = service; a trailing A = asphalt (a little wider).
const HALF_WIDTH = { c: 0.85, f: 0.55, p: 0.38, s: 0.45 };
const ASPHALT_EXTRA = 0.15;

export const PATHS = OSM.paths.map(([kind, pts]) => ({
  kind,
  asphalt: kind[1] === 'A',
  half: (HALF_WIDTH[kind[0]] ?? 0.45) + (kind[1] === 'A' ? ASPHALT_EXTRA : 0),
  pts: pts.map(toUnits),
}));

/** The two asphalt cycle avenues; the second is Poppelalléen (its trees become poplars, lamps line both). */
export const AVENUES = PATHS.filter((p) => p.kind === 'cA');

/** Signed distance to the nearest path edge: negative on a path. */
export function pathDistance(x, z) {
  let d = Infinity;
  for (const p of PATHS) d = Math.min(d, polylineDistance(x, z, p.pts) - p.half);
  return d;
}

// ---- walls and gates --------------------------------------------------------------------------------------------------
export const WALLS = OSM.walls.map((w) => w.map(toUnits));
/** Indices of the outer boundary wall runs: solid apart from the gates (inner walls also open along paths). */
const OUTER_WALLS = new Set([8, 9]);
/** How close the walker may come to a wall's centre line (units). */
const WALL_HALF_THICKNESS = 0.5;
const GATE_RADIUS = 1.5;

// Gates closer than 3 units are one entrance (the Nørrebros Runddel corner has two mapped gate nodes side by side).
export const GATES = [];
for (const [x, z] of OSM.gates.map(toUnits)) {
  const twin = GATES.find((q) => Math.hypot(q[0] - x, q[1] - z) < 3);
  if (twin) {
    twin[0] = (twin[0] + x) / 2;
    twin[1] = (twin[1] + z) / 2;
  } else GATES.push([x, z]);
}

// Openings [x, z, radius]: one at every gate, and one wherever a path crosses a wall.
const OPENINGS = GATES.map(([x, z]) => [x, z, GATE_RADIUS]);
for (const w of WALLS) {
  for (let i = 0; i < w.length - 1; i++) {
    for (const p of PATHS) {
      for (let j = 0; j < p.pts.length - 1; j++) {
        const q = segmentIntersection(w[i], w[i + 1], p.pts[j], p.pts[j + 1]);
        if (q) OPENINGS.push([q[0], q[1], p.half + 0.5]);
      }
    }
  }
}

const inOpening = (x, z) => OPENINGS.some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) < r);
// Inner section walls also open wherever they run along a (widened) path, so no route through the cemetery is closed.
const inInnerOpening = (x, z) => inOpening(x, z) || pathDistance(x, z) < 0.15;

/** The "is this point an opening?" test for wall number i (used both to cut wall runs and to let the walker pass). */
export const openingTestFor = (i) => (OUTER_WALLS.has(i) ? inOpening : inInnerOpening);

/** Distance to the nearest wall centre line. */
export function wallDistance(x, z) {
  let d = Infinity;
  for (const w of WALLS) d = Math.min(d, polylineDistance(x, z, w));
  return d;
}

/** True where a wall stops the walker. */
export const wallBlocks = (x, z) =>
  WALLS.some((w, i) => polylineDistance(x, z, w) < WALL_HALF_THICKNESS && !openingTestFor(i)(x, z));

// ---- sheds and service buildings --------------------------------------------------------------------------------------
// Mapped footprints, stored flat as [x0, y0, x1, y1, ...]. Booths under 5 m (1 unit) are left out: one of them stands
// in the Nørrebros Runddel gateway and would block the entrance.
export const SHEDS = OSM.smallBuildings
  .map((flat) => {
    const pts = [];
    for (let i = 0; i < flat.length; i += 2) pts.push(toUnits([flat[i], flat[i + 1]]));
    return pts;
  })
  .filter((pts) => longestEdge(pts) >= 1);

// ---- the chapel -------------------------------------------------------------------------------------------------------
export const CHAPEL = OSM.chapel.map(toUnits);
export const CHAPEL_CENTRE = centroid(CHAPEL);
/** The chapel's heading: along its long south-west wall (the 2nd and 3rd mapped corners). */
export const CHAPEL_YAW = Math.atan2(-(CHAPEL[2][1] - CHAPEL[1][1]), CHAPEL[2][0] - CHAPEL[1][0]);
