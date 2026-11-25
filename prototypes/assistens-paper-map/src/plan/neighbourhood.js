/**
 * Placement outside the walls: street and park trees, playground equipment, bike racks, benches and cycle routes.
 * Positions only; world/build-neighbourhood.js turns them into paper pieces.
 */
import { SURROUNDINGS } from '../data/surroundings.js';
import { toUnits } from '../map/units.js';
import { inPolygon, boundsOf } from '../map/math.js';
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
