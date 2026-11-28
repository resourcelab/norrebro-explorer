/**
 * The neighbourhood's rules, applied one TILE at a time: street and park trees, playgrounds, corner signs where named
 * streets meet. Play equipment is in plan/play.js, street furniture and crossings in plan/street.js, shops in
 * plan/shops.js. Positions only; core/world.js turns them into things.
 *
 * Every rule here reads only the tile it is given (its features come with a margin, see scripts/pack-world.mjs) and the
 * sites, and draws from the tile's own random stream, so a tile plans the same whichever tiles are loaded round it.
 * A thing belongs to the tile its position falls in.
 *
 * Each function takes a planning context `t`:
 *   t.tile          the loaded tile (core/world/store.js): rect, reach, buildings, streets, areas, trees, props, index
 *   t.rnd           the tile's random stream
 *   t.inRegion      (x, z) -> inside the play area
 */
import { polylineDistance, segmentIntersection, segmentDistance, centroid } from '../map/math.js';
import { lonLatToUnits, unitsOf } from '../geo.js';
import { PLAYGROUND_POINTS } from '../../data/landmarks.js';
import { siteAt, siteEdgeDistance } from '../sites/index.js';
import { axisOf } from '../world/features.js';
import { toPavement } from './street.js';

const STREET_TREE_KINDS = ['linden', 'linden', 'maple', 'chestnut'];

const owns = ({ rect }, x, z) => x >= rect.x0 && x < rect.x1 && z >= rect.z0 && z < rect.z1;

/** True within the tile's reach: its square plus the packing margin, where it knows every building and street. */
const inReach = ({ reach }, x, z) => x >= reach.x0 && x <= reach.x1 && z >= reach.z0 && z <= reach.z1;

/**
 * Free ground outside the sites: within the tile's reach, in the play area, not in a building (with margin r), clear
 * of site walls. Outside its reach a tile can't see the ground, so nothing is put there.
 */
export const freeGround = (t, x, z, r = 0.6) => inReach(t.tile, x, z) && t.inRegion(x, z) && !siteAt(x, z) && !t.tile.index.buildingAt(x, z, r) && siteEdgeDistance(x, z) > 1.2;

/**
 * Mapped street and park trees, thinned to 2 units apart. A tree mapped on the kerb that falls on a road's drawn
 * width is moved out onto the pavement (plan/street.js toPavement). Returns [{ x, z, kind }].
 */
export function planStreetTrees(t) {
  const trees = [];
  for (const [mx, mz] of t.tile.trees) {
    const spot = toPavement(t, mx, mz, 0.6);
    if (!spot) continue;
    const [x, z] = spot;
    if (trees.some((q) => Math.hypot(q.x - x, q.z - z) < 2)) continue;
    trees.push({ x, z, kind: STREET_TREE_KINDS[Math.floor(t.rnd() * STREET_TREE_KINDS.length)] });
  }
  return trees;
}

/**
 * Playgrounds owned by this tile (their middle is in it): every mapped play area in the play area, plus the ones
 * OpenStreetMap maps as a point, drawn as a sandpit (data/landmarks.js PLAYGROUND_POINTS). Returns
 * [{ pts, axis, sandpit }] (axis: the oriented box, core/world/features.js).
 */
export function planPlaygrounds(t) {
  const out = t.tile.areas
    .filter((a) => a.kind === 'playground' && owns(t.tile, ...centroid(a.pts)) && a.pts.some(([x, z]) => t.inRegion(x, z)))
    .map((a) => ({ pts: a.pts, axis: a.axis, sandpit: false }));
  for (const p of PLAYGROUND_POINTS) {
    const [x, z] = lonLatToUnits(...p.lonLat);
    if (!owns(t.tile, x, z)) continue;
    const [rx, rz] = [unitsOf(p.rx), unitsOf(p.rz)];
    const pts = Array.from({ length: 12 }, (_, k) => [x + Math.cos((k / 12) * 2 * Math.PI) * rx, z + Math.sin((k / 12) * 2 * Math.PI) * rz]);
    out.push({ pts, axis: axisOf(pts), sandpit: true });
  }
  return out;
}

// ---- corner signs ----------------------------------------------------------------------------------------------------

const JUNCTION_SNAP = 1.0; // units: a street ending this close to another street meets it
const CORNER_CLUSTER = 6; // units: junction points closer than this are one corner
const SIGN_SPACING = 9; // units: no two signs closer than this

/** Where named streets meet: [{ x, z, names: Set, streets }]. T-junctions (one street ends on another) and crossings. */
export function namedJunctions(streets) {
  const named = streets.filter((s) => s.name);
  const hits = [];
  const add = (x, z, a, b, sa, sb) => hits.push({ x, z, names: new Set([a, b]), streets: [sa, sb] });
  for (let i = 0; i < named.length; i++) {
    const A = named[i];
    for (let j = i + 1; j < named.length; j++) {
      const B = named[j];
      if (A.name === B.name) continue;
      for (const [P, Q] of [[A, B], [B, A]]) {
        for (const end of [P.pts[0], P.pts[P.pts.length - 1]]) {
          if (polylineDistance(end[0], end[1], Q.pts) < JUNCTION_SNAP) add(end[0], end[1], P.name, Q.name, P, Q);
        }
      }
      for (let a = 0; a < A.pts.length - 1; a++) {
        for (let b = 0; b < B.pts.length - 1; b++) {
          const q = segmentIntersection(A.pts[a], A.pts[a + 1], B.pts[b], B.pts[b + 1]);
          if (q) add(q[0], q[1], A.name, B.name, A, B);
        }
      }
    }
  }
  // merge hits into corners, in a fixed order (west to east), so neighbouring tiles that both see a corner on their
  // shared edge find the same corner at the same spot, and exactly one of them owns it
  hits.sort((p, q) => p.x - q.x || p.z - q.z);
  const corners = [];
  for (const h of hits) {
    const c = corners.find((k) => Math.hypot(k.x0 - h.x, k.z0 - h.z) < CORNER_CLUSTER);
    if (c) { for (const n of h.names) c.names.add(n); c.streets.push(...h.streets); c.n++; c.sx += h.x; c.sz += h.z; } else corners.push({ ...h, x0: h.x, z0: h.z, n: 1, sx: h.x, sz: h.z, streets: [...h.streets] });
  }
  for (const c of corners) { c.x = c.sx / c.n; c.z = c.sz / c.n; }
  return corners;
}

/** Unit direction of a street near (x, z). */
function directionNear(street, x, z) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < street.pts.length - 1; i++) {
    const d = segmentDistance(x, z, street.pts[i], street.pts[i + 1]);
    if (d < bestD) { bestD = d; best = [street.pts[i], street.pts[i + 1]]; }
  }
  const [[ax, az], [bx, bz]] = best;
  const L = Math.hypot(bx - ax, bz - az) || 1;
  return [(bx - ax) / L, (bz - az) / L];
}

/**
 * A sign at each corner in this tile where named streets meet: on the pavement in the corner nearest the camera
 * (south) that is clear of buildings, naming up to two of the streets. Returns [{ x, z, names: string[] }].
 */
export function planCornerSigns(t) {
  // every corner the tile can see (its own and its neighbours' within reach), in a fixed order, spaced out; then only
  // its own are kept. Neighbouring tiles see the same corners round their shared edge, so they space them the same way.
  const signs = [];
  for (const c of namedJunctions(t.tile.streets)) {
    if (!inReach(t.tile, c.x, c.z) || !t.inRegion(c.x, c.z) || siteAt(c.x, c.z)) continue;
    const [sa, sb] = c.streets;
    const a = directionNear(sa, c.x, c.z);
    const b = directionNear(sb, c.x, c.z);
    const sin = Math.abs(a[0] * b[1] - a[1] * b[0]);
    if (sin < 0.3) continue; // nearly parallel: a fork, not a corner
    const ta = (sa.half + 0.8) / sin;
    const tb = (sb.half + 0.8) / sin;
    const options = [];
    for (const i of [-1, 1]) for (const j of [-1, 1]) options.push([c.x + b[0] * tb * i + a[0] * ta * j, c.z + b[1] * tb * i + a[1] * ta * j]);
    options.sort((p, q) => q[1] - p[1]); // the corner nearest the camera first
    const spot = options.find(([x, z]) => freeGround(t, x, z, 0.3) && t.tile.index.streetDistance(x, z) > -0.1);
    if (!spot || signs.some((g) => Math.hypot(g.x - spot[0], g.z - spot[1]) < SIGN_SPACING)) continue;
    signs.push({ x: spot[0], z: spot[1], names: [...c.names].sort().slice(0, 2), own: owns(t.tile, c.x, c.z) });
  }
  return signs.filter((g) => g.own).map(({ own: _own, ...g }) => g);
}
