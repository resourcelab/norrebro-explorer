/**
 * Placement outside the walls: street and park trees, playground equipment, bike racks, benches and cycle routes.
 * Positions only; world/build-neighbourhood.js turns them into paper pieces.
 */
import { SURROUNDINGS } from '../../data/surroundings.js';
import { toUnits } from '../map/units.js';
import { inPolygon, boundsOf, polylineDistance, segmentIntersection, segmentDistance } from '../map/math.js';
import { SCALE } from '../../config.js';
import { insideCemetery, wallDistance } from '../map/cemetery.js';
import { inRegion, AREAS, STREETS, buildingAt, streetDistance } from '../map/neighbourhood.js';

/**
 * Hans Tavsens Park's playground is mapped as a point (no area), at its south end. Units from the cemetery centroid;
 * the sandpit drawn round it is an ellipse of these radii.
 */
const HANS_TAVSENS_PLAYGROUND = { x: -34.9, z: 70.6, rx: 4.6, rz: 3.6 };
/** The streets cyclists ride (both directions, back and forth along each mapped stretch). */
const CYCLE_STREETS = new Set(['Nørrebrogade', 'Jagtvej', 'Kapelvej', 'Guldbergsgade']);
const STREET_TREE_KINDS = ['linden', 'linden', 'maple', 'chestnut'];
const PLAYGROUND_KIT = ['swings', 'slide', 'climber', 'seesaw'];

/** Free ground outside the walls: in the region, not in a building (with margin r), clear of the cemetery wall. */
const outsideFree = (x, z, r = 0.6) => inRegion(x, z) && !insideCemetery(x, z) && !buildingAt(x, z, r) && wallDistance(x, z) > 1.2;

/** Mapped street and park trees, thinned to 2.6 units apart. Returns [{ x, z, kind }]. */
export function planStreetTrees(rnd) {
  const trees = [];
  for (const mapped of SURROUNDINGS.trees) {
    const [x, z] = toUnits(mapped);
    if (!outsideFree(x, z) || streetDistance(x, z) < -0.2) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
    trees.push({ x, z, kind: STREET_TREE_KINDS[Math.floor(rnd() * STREET_TREE_KINDS.length)] });
  }
  return trees;
}

/** Playgrounds: every mapped play area in the region, plus Hans Tavsens Park's (a sandpit). Returns [{ pts, sandpit }]. */
export function planPlaygrounds() {
  const playgrounds = AREAS.filter((a) => a.kind === 'playground' && a.pts.some(([x, z]) => inRegion(x, z))).map((a) => ({ pts: a.pts, sandpit: false }));
  const { x, z, rx, rz } = HANS_TAVSENS_PLAYGROUND;
  const ellipse = Array.from({ length: 12 }, (_, k) => [x + Math.cos((k / 12) * 2 * Math.PI) * rx, z + Math.sin((k / 12) * 2 * Math.PI) * rz]);
  playgrounds.push({ pts: ellipse, sandpit: true });
  return playgrounds;
}

/** Up to four pieces of kit per playground (swings, slide, climbing dome, seesaw), 2.6 units apart. Returns [{ x, z, kind }]. */
export function planPlaygroundKit(playgrounds, rnd) {
  const kit = [];
  for (const pg of playgrounds) {
    const { x0, z0, x1, z1 } = boundsOf(pg.pts);
    let k = Math.floor(rnd() * PLAYGROUND_KIT.length);
    for (let tries = 0, placed = 0; tries < 60 && placed < 4; tries++) {
      const x = x0 + rnd() * (x1 - x0);
      const z = z0 + rnd() * (z1 - z0);
      if (!inPolygon(x, z, pg.pts) || !outsideFree(x, z, 0.8) || kit.some((e) => Math.hypot(e.x - x, e.z - z) < 2.6)) continue;
      kit.push({ x, z, kind: PLAYGROUND_KIT[k++ % PLAYGROUND_KIT.length] });
      placed++;
    }
  }
  return kit;
}

/** Mapped bike racks and benches on the pavements, thinned. Returns { racks: [[x, z]], benches: [[x, z]] }. */
export function planStreetFurniture() {
  const racks = [];
  const benches = [];
  for (const [mx, my, kind] of SURROUNDINGS.props) {
    const [x, z] = toUnits([mx, my]);
    if (!outsideFree(x, z, 0.4) || streetDistance(x, z) < -0.3) continue;
    if (kind === 'bikes' && racks.every((q) => Math.hypot(q[0] - x, q[1] - z) > 3.5)) racks.push([x, z]);
    if (kind === 'bench' && benches.every((q) => Math.hypot(q[0] - x, q[1] - z) > 2.4)) benches.push([x, z]);
  }
  return { racks, benches };
}

/** Street stretches cyclists ride along: [{ name, pts }]. */
export function planCycleRoutes() {
  return STREETS.filter((s) => CYCLE_STREETS.has(s.name) && s.pts.length >= 2).map((s) => ({ name: s.name, pts: s.pts }));
}

// ---- wayfinding: corner signs, fingerposts ---------------------------------------------------------------------------

const JUNCTION_SNAP = 1.0; // units: a street ending this close to another street meets it
const CORNER_CLUSTER = 6; // units: junction points closer than this are one corner
const SIGN_SPACING = 9; // units: no two signs closer than this

/** Where named streets meet: [{ x, z, names: Set }]. T-junctions (one street ends on another) and crossings. */
function namedJunctions() {
  const named = STREETS.filter((s) => s.name);
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
  // merge hits into corners
  const corners = [];
  for (const h of hits) {
    const c = corners.find((k) => Math.hypot(k.x - h.x, k.z - h.z) < CORNER_CLUSTER);
    if (c) { for (const n of h.names) c.names.add(n); c.streets.push(...h.streets); } else corners.push({ ...h, streets: [...h.streets] });
  }
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
 * A sign at each corner where named streets meet: on the pavement in the corner nearest the camera (south) that is
 * clear of buildings, naming up to two of the streets. Returns [{ x, z, names: string[] }].
 */
export function planCornerSigns() {
  const signs = [];
  for (const c of namedJunctions()) {
    if (!inRegion(c.x, c.z) || insideCemetery(c.x, c.z)) continue;
    const [sa, sb] = c.streets;
    const a = directionNear(sa, c.x, c.z);
    const b = directionNear(sb, c.x, c.z);
    const sin = Math.abs(a[0] * b[1] - a[1] * b[0]);
    if (sin < 0.3) continue; // nearly parallel: a fork, not a corner
    const t = (sa.half + 0.8) / sin;
    const s = (sb.half + 0.8) / sin;
    const options = [];
    for (const i of [-1, 1]) for (const j of [-1, 1]) options.push([c.x + b[0] * s * i + a[0] * t * j, c.z + b[1] * s * i + a[1] * t * j]);
    options.sort((p, q) => q[1] - p[1]); // the corner nearest the camera first
    const spot = options.find(([x, z]) => outsideFree(x, z, 0.3) && streetDistance(x, z) > -0.1);
    if (!spot || signs.some((g) => Math.hypot(g.x - spot[0], g.z - spot[1]) < SIGN_SPACING)) continue;
    signs.push({ x: spot[0], z: spot[1], names: [...c.names].slice(0, 2) });
  }
  return signs;
}

/** The nearest free pavement spot to (x, z), searching outward; null if none within `reach` units. */
function freeSpotNear(x, z, reach = 12) {
  for (let r = 0; r <= reach; r += 0.5) {
    for (let k = 0; k < 16; k++) {
      const px = x + Math.cos((k / 16) * 2 * Math.PI) * r;
      const pz = z + Math.sin((k / 16) * 2 * Math.PI) * r;
      if (outsideFree(px, pz, 0.4) && streetDistance(px, pz) > 0 && streetDistance(px, pz) < 1.5) return [px, pz];
    }
  }
  return null;
}

/**
 * Fingerposts to the far places: one by the cemetery gate nearest the start, pointing to all of them, and one at the
 * edge of the walkable area nearest each place. Returns [{ x, z, arms: [{ name, dx, metres }] }].
 */
export function planFingerposts(far, start) {
  const posts = [];
  const armsFrom = (x, z, places) => places.map((f) => {
    const [tx, tz] = f.pointFrom(x, z);
    return { name: f.name, dx: tx - x, metres: Math.round((Math.hypot(tx - x, tz - z) / SCALE) / 50) * 50 };
  });
  const startSpot = freeSpotNear(start[0], start[1], 40);
  if (startSpot) posts.push({ x: startSpot[0], z: startSpot[1], arms: armsFrom(...startSpot, far) });
  for (const f of far) {
    const [tx, tz] = f.pointFrom(start[0], start[1]);
    // walk from the start toward the place and stop at the edge of the walkable area
    const L = Math.hypot(tx - start[0], tz - start[1]);
    let edge = start;
    for (let d = 0; d < L; d += 1) {
      const x = start[0] + ((tx - start[0]) * d) / L;
      const z = start[1] + ((tz - start[1]) * d) / L;
      if (!inRegion(x, z)) break;
      edge = [x, z];
    }
    const spot = freeSpotNear(edge[0] - Math.sign(tx - start[0]) * 6, edge[1] - Math.sign(tz - start[1]) * 6, 20);
    if (spot && posts.every((p) => Math.hypot(p.x - spot[0], p.z - spot[1]) > 20)) posts.push({ x: spot[0], z: spot[1], arms: armsFrom(...spot, [f]) });
  }
  return posts;
}
