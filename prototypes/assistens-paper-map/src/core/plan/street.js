/**
 * Street furniture and road markings, planned per tile (see plan/neighbourhood.js for the context `t`), all from what
 * OpenStreetMap maps where it maps it:
 *
 *   benches, bike racks, bins, picnic tables, drinking taps, street lamps, bus stops
 *   zebra crossings, and traffic lights at the ones with signals
 *
 * Streets are drawn wider than mapped (TOY.streetWiden), so something mapped on the kerb can fall on the drawn
 * carriageway. Such a thing is moved straight out onto the pavement (toPavement) rather than dropped; only if there is
 * no room within reach is it left out.
 */
import { SCALE } from '../../config.js';
import { segmentDistance } from '../map/math.js';
import { freeGround } from './neighbourhood.js';

/** Streets cars drive on: nothing stands on their drawn width. Footways, cycleways and squares are walkable ground. */
export const ROADS = new Set(['primary', 'secondary', 'tertiary', 'tertiary_link', 'residential', 'living_street', 'unclassified', 'service', 'busway']);
const KERB = 0.25; // units out from the drawn road edge that a moved thing stands
const MOVE_REACH = 2.5; // units: further than this from where it was mapped, a thing is dropped instead
/** How close two of the same kind may stand (units): benches in a row, racks along a wall. */
const SPACING = { bench: 0.9, bikes: 0.9, bin: 1.5, picnic: 1.6, tap: 1.5, lamp: 2, 'bus-stop': 4 };

/** True when (x, z) is on a road's drawn width (a spatial index's view: no planning context needed). */
export function onRoad(index, x, z) {
  for (const s of index.streetsIn(x - 3, z - 3, x + 3, z + 3)) {
    if (!ROADS.has(s.kind)) continue;
    for (let i = 0; i < s.pts.length - 1; i++) if (segmentDistance(x, z, s.pts[i], s.pts[i + 1]) - s.half < -0.15) return true;
  }
  return false;
}

/** The nearest road segment at (x, z), with the distance from its drawn edge (negative: on it). */
function roadAt(t, x, z, reach = 4) {
  let best = null;
  for (const s of t.tile.index.streetsIn(x - reach, z - reach, x + reach, z + reach)) {
    if (!ROADS.has(s.kind)) continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const d = segmentDistance(x, z, s.pts[i], s.pts[i + 1]) - s.half;
      if (!best || d < best.d) best = { s, i, d };
    }
  }
  return best;
}

/**
 * (x, z), or the nearest pavement spot to it if it lies on a road's drawn width: straight out from the road, to the
 * side it was mapped on. Returns [x, z] or null when there is no free ground close enough.
 */
export function toPavement(t, x, z, room = 0.3) {
  let [px, pz] = [x, z];
  for (let pass = 0; pass < 3; pass++) {
    const road = roadAt(t, px, pz);
    if (!road || road.d >= KERB * 0.6) break;
    const [a, b] = [road.s.pts[road.i], road.s.pts[road.i + 1]];
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const L = Math.hypot(dx, dz) || 1;
    let [nx, nz] = [-dz / L, dx / L];
    if ((px - a[0]) * nx + (pz - a[1]) * nz < 0) [nx, nz] = [-nx, -nz]; // the side it was mapped on
    const push = KERB - road.d;
    [px, pz] = [px + nx * push, pz + nz * push];
  }
  if (Math.hypot(px - x, pz - z) > MOVE_REACH) return null;
  const road = roadAt(t, px, pz);
  if (road && road.d < KERB * 0.5) return null; // a narrow island between two roads
  return freeGround(t, px, pz, room) ? [px, pz] : null;
}

/**
 * Mapped street furniture: { benches, racks, bins, picnics, taps, lamps, busStops }, each [{ x, z, yaw? }].
 * A bike-parking strip mapped as an area gets a rack every 2.5 m along it.
 */
export function planStreetFurniture(t) {
  const out = { bench: [], bikes: [], bin: [], picnic: [], tap: [], lamp: [], 'bus-stop': [] };
  const place = (kind, x, z, yaw) => {
    if (!out[kind]) return; // (a tile's props are its own: each is mapped in one tile only)
    const spot = toPavement(t, x, z, kind === 'bus-stop' ? 0.5 : 0.3);
    if (!spot || out[kind].some((q) => Math.hypot(q.x - spot[0], q.z - spot[1]) < SPACING[kind])) return;
    out[kind].push({ x: spot[0], z: spot[1], yaw: yaw ?? streetYaw(t, ...spot) });
  };
  for (const [x, z, kind, angle, length] of t.tile.props) {
    if (kind === 'bikes' && length > 3 * SCALE) {
      const n = Math.max(2, Math.round(length / (2.5 * SCALE)));
      for (let k = 0; k < n; k++) {
        const s = (k - (n - 1) / 2) * (length / n);
        place('bikes', x + Math.cos(angle) * s, z + Math.sin(angle) * s, Math.atan2(-Math.sin(angle), Math.cos(angle)));
      }
    } else if (kind === 'bus-stop') place('bus-stop', x, z);
    else place(kind, x, z, angle === undefined ? undefined : Math.atan2(-Math.sin(angle), Math.cos(angle)));
  }
  return { benches: out.bench, racks: out.bikes, bins: out.bin, picnics: out.picnic, taps: out.tap, lamps: out.lamp, busStops: out['bus-stop'] };
}

/** A card's facing beside the nearest road: its face along the road, toward the camera (south). 0 if no road. */
function streetYaw(t, x, z) {
  const road = roadAt(t, x, z, 6);
  if (!road) return 0;
  const [a, b] = [road.s.pts[road.i], road.s.pts[road.i + 1]];
  let [nx, nz] = [-(b[1] - a[1]), b[0] - a[0]];
  if (nz < 0) [nx, nz] = [-nx, -nz];
  return Math.max(-1.2, Math.min(1.2, Math.atan2(nx, nz)));
}

/**
 * Crossings mapped on roads: [{ x, z, angle, length, signals, lights: [[x, z], [x, z]] }]. angle runs ACROSS the road
 * (the way you walk), length is the drawn road's width; lights are the kerb spots for traffic lights when it has
 * signals. A crossing belongs to the tile it is mapped in.
 */
export function planCrossings(t) {
  const out = [];
  for (const [x, z, kind] of t.tile.props) {
    if (!kind.startsWith('crossing:') || kind === 'crossing:no') continue;
    if (x < t.tile.rect.x0 || x >= t.tile.rect.x1 || z < t.tile.rect.z0 || z >= t.tile.rect.z1 || !t.inRegion(x, z)) continue;
    const road = roadAt(t, x, z, 2);
    if (!road || road.d > 0.2) continue; // a crossing of a cycle path or footway: nothing to paint at this scale
    const [a, b] = [road.s.pts[road.i], road.s.pts[road.i + 1]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [ux, uz] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    // slide the crossing onto the road's centre line, across it
    const s = (x - a[0]) * ux + (z - a[1]) * uz;
    const [cx, cz] = [a[0] + ux * s, a[1] + uz * s];
    const [nx, nz] = [-uz, ux];
    const half = road.s.half;
    if (out.some((c) => Math.hypot(c.x - cx, c.z - cz) < half * 2.2)) continue; // the other half of a mapped pair
    const signals = kind === 'crossing:traffic_signals';
    const lights = signals ? [-1, 1].map((k) => toPavement(t, cx + nx * k * (half + 0.3), cz + nz * k * (half + 0.3), 0.1)).filter(Boolean) : [];
    out.push({ x: cx, z: cz, angle: Math.atan2(nz, nx), length: half * 2, along: Math.atan2(uz, ux), signals, lights });
  }
  return out;
}
