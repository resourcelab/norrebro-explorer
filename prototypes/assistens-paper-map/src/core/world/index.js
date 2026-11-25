/**
 * A spatial index over map features (buildings, streets, water), so every "what is here?" question looks at a handful
 * of nearby features, never at all of them. The same index serves the walker's collision, the planning of each tile,
 * the "which street am I on?" lookup and the wayfinding plan; only what is put in it differs.
 *
 *   const idx = createSpatialIndex();
 *   idx.add(feature); idx.remove(feature);           // features from core/world/features.js (world units)
 *   idx.buildingAt(x, z, pad)                       // the building at (x, z) or within pad of it, else null
 *   idx.streetDistance(x, z)                        // signed distance to the nearest street edge (negative: on it)
 *   idx.nearestStreet(x, z, reach, named)           // { street, d } within reach, or null
 *   idx.inWater(x, z)
 *
 * Streets are indexed by segment, so a long street costs nothing where it doesn't pass.
 */
import { inPolygon, polylineDistance, segmentDistance } from '../map/math.js';

const CELL = 8; // units (40 m)
/** How far streetDistance looks (units). Beyond it the answer is "at least this far". */
export const STREET_REACH = 10;

export function createSpatialIndex({ cell = CELL } = {}) {
  const cells = new Map(); // "i,j" -> Set of entries
  const entriesOf = new Map(); // feature -> its entries (for remove)
  const key = (i, j) => i + ',' + j;
  const put = (entry, [x0, z0, x1, z1]) => {
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) {
      for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const k = key(i, j);
        if (!cells.has(k)) cells.set(k, new Set());
        cells.get(k).add(entry);
        entry.cells.push(k);
      }
    }
  };
  /** Every entry in the cells a box touches (each once). */
  function around(x0, z0, x1, z1) {
    const out = new Set();
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) {
      for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        for (const e of cells.get(key(i, j)) ?? []) out.add(e);
      }
    }
    return out;
  }

  function add(f) {
    if (entriesOf.has(f)) return;
    const entries = [];
    if (f.type === 'street') {
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, az] = f.pts[i];
        const [bx, bz] = f.pts[i + 1];
        const e = { f, i, cells: [] };
        put(e, [Math.min(ax, bx) - f.half, Math.min(az, bz) - f.half, Math.max(ax, bx) + f.half, Math.max(az, bz) + f.half]);
        entries.push(e);
      }
    } else {
      const e = { f, cells: [] };
      put(e, f.box);
      entries.push(e);
    }
    entriesOf.set(f, entries);
  }

  function remove(f) {
    for (const e of entriesOf.get(f) ?? []) for (const k of e.cells) cells.get(k)?.delete(e);
    entriesOf.delete(f);
  }

  function buildingAt(x, z, pad = 0) {
    for (const { f } of around(x - pad, z - pad, x + pad, z + pad)) {
      if (f.type !== 'building') continue;
      const [x0, z0, x1, z1] = f.box;
      if (x < x0 - pad || x > x1 + pad || z < z0 - pad || z > z1 + pad) continue;
      if (inPolygon(x, z, f.pts)) return f;
      if (pad > 0 && polylineDistance(x, z, [...f.pts, f.pts[0]]) < pad) return f;
    }
    return null;
  }

  function nearestStreet(x, z, reach = STREET_REACH, named = false) {
    let best = null;
    let bestD = reach;
    for (const e of around(x - reach, z - reach, x + reach, z + reach)) {
      const s = e.f;
      if (s.type !== 'street' || (named && !s.name)) continue;
      const d = segmentDistance(x, z, s.pts[e.i], s.pts[e.i + 1]) - s.half;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best ? { street: best, d: bestD } : null;
  }

  return {
    add,
    remove,
    buildingAt,
    nearestStreet,
    streetDistance: (x, z) => nearestStreet(x, z)?.d ?? STREET_REACH,
    inWater(x, z) {
      for (const { f } of around(x, z, x, z)) if (f.type === 'area' && f.kind === 'water' && inPolygon(x, z, f.pts)) return true;
      return false;
    },
    /** Every street with a segment in the box (each once). */
    streetsIn(x0, z0, x1, z1) {
      const out = new Set();
      for (const { f } of around(x0, z0, x1, z1)) if (f.type === 'street') out.add(f);
      return [...out];
    },
    get size() { return entriesOf.size; },
  };
}
