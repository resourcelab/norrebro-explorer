/**
 * Landmarks in world units (from src/data/landmarks.js): churches on their footprints with the spot for the tower,
 * flags, and the far places beyond the walkable area.
 */
import { LANDMARKS } from '../../data/landmarks.js';
import { toUnits } from './units.js';
import { centroid, segmentDistance } from './math.js';
import { BUILDINGS, CONTEXT, streetDistance } from './neighbourhood.js';

/**
 * The tower goes at one end of the church's long axis: the end nearer a street (towers face the street). The ends are
 * the footprint's two points furthest apart; the tower stands just inside the chosen one.
 */
function towerSpot(pts) {
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

export const CHURCHES = LANDMARKS.filter((l) => l.kind === 'church').map((l) => {
  const b = BUILDINGS.find((x) => x.id === l.building);
  if (!b) throw new Error(`landmark ${l.id}: building ${l.building} is not in surroundings.js`);
  return { ...l, pts: b.pts, centre: centroid(b.pts), tower: towerSpot(b.pts) };
});

export const FLAGS = LANDMARKS.filter((l) => l.kind === 'flag').map((l) => ({ ...l, at: toUnits(l.at) }));

/** Far places: { id, name, en, pointFrom(x, z) } - the point to aim at from (x, z). */
export const FAR = LANDMARKS.filter((l) => l.kind === 'far').map((l) => {
  if (l.water) {
    const lake = CONTEXT.areas.find((a) => a.kind === 'water' && a.name === l.water);
    if (!lake) throw new Error(`landmark ${l.id}: no lake named ${l.water} in the context data`);
    return { ...l, pts: lake.pts, pointFrom: (x, z) => nearestOnRing(x, z, lake.pts) };
  }
  const at = toUnits(l.at);
  return { ...l, at, pointFrom: () => at };
});

/** Everything with a name to show on the minimap and as "you are near" labels: [{ name, x, z, kind }]. */
export const NAMED_PLACES = [
  ...CHURCHES.map((c) => ({ name: c.name, x: c.centre[0], z: c.centre[1], kind: 'church' })),
  ...FLAGS.map((f) => ({ name: f.name, x: f.at[0], z: f.at[1], kind: 'flag' })),
];
