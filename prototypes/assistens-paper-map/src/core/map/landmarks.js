/**
 * Landmarks in world units (from src/data/landmarks.js): churches on their footprints with the spot for the tower,
 * flags, and the far places beyond the walkable area. Landmarks stand wherever you are, so they are made from the
 * world's overview (which carries the landmark footprints in full), never from a tile that may not be loaded.
 */
import { LANDMARKS } from '../../data/landmarks.js';
import { lonLatToUnits } from '../geo.js';
import { centroid, segmentDistance } from './math.js';

/** Building ids drawn as landmarks (churches) instead of ordinary blocks. */
export const LANDMARK_BUILDINGS = new Set(LANDMARKS.filter((l) => l.building).map((l) => l.building));

/**
 * The tower goes at one end of the church's long axis: the end nearer a street (towers face the street). The ends are
 * the footprint's two points furthest apart; the tower stands just inside the chosen one.
 */
function towerSpot(pts, streetDistance) {
  let a = pts[0];
  let b = pts[1];
  let best = 0;
  for (const p of pts) for (const q of pts) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > best) { best = d; a = p; b = q; } }
  const c = centroid(pts);
  const inward = (p) => [p[0] + (c[0] - p[0]) * 0.22, p[1] + (c[1] - p[1]) * 0.22];
  const [ta, tb] = [inward(a), inward(b)];
  return streetDistance(...ta) <= streetDistance(...tb) ? ta : tb;
}

/** Nearest point on a polygon's edge to (x, z). */
function nearestOnRing(x, z, ring) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const d = segmentDistance(x, z, a, b);
    if (d < bestD) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      bestD = d;
      best = [a[0] + dx * t, a[1] + dz * t];
    }
  }
  return best;
}

/**
 * @param overview the world's overview (core/world/features.js prepareOverview)
 * @param overviewIndex a spatial index over the overview's streets (for which end of a church faces the street)
 * @returns {{ churches, flags, far, named }}
 *   churches [{ id, name, building, pts, centre, tower }]   flags [{ id, name, color, at }]
 *   far      [{ id, name, en, pointFrom(x, z) }]           named [{ name, x, z, kind }] for the minimap and labels
 */
export function createLandmarks(overview, overviewIndex) {
  const churches = LANDMARKS.filter((l) => l.kind === 'church').map((l) => {
    const pts = overview.landmarks[l.building];
    if (!pts) throw new Error(`landmark ${l.id}: building ${l.building} is not in the world overview (run npm run pack-world)`);
    return { ...l, pts, centre: centroid(pts), tower: towerSpot(pts, overviewIndex.streetDistance) };
  });
  const flags = LANDMARKS.filter((l) => l.kind === 'flag').map((l) => ({ ...l, at: lonLatToUnits(...l.lonLat) }));
  const far = LANDMARKS.filter((l) => l.kind === 'far').map((l) => {
    if (l.water) {
      const lake = overview.areas.find((a) => a.kind === 'water' && a.name === l.water);
      if (!lake) throw new Error(`landmark ${l.id}: no lake named ${l.water} in the world overview`);
      return { ...l, pts: lake.pts, pointFrom: (x, z) => nearestOnRing(x, z, lake.pts) };
    }
    const at = lonLatToUnits(...l.lonLat);
    return { ...l, at, pointFrom: () => at };
  });
  const named = [
    ...churches.map((c) => ({ name: c.name, x: c.centre[0], z: c.centre[1], kind: 'church' })),
    ...flags.map((f) => ({ name: f.name, x: f.at[0], z: f.at[1], kind: 'flag' })),
  ];
  return { churches, flags, far, named };
}
