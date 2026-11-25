/**
 * Collision: may the walker stand at (x, z)? The map's rules (core/map/walk.js: buildings, water, site walls and
 * hedges, the edge of the play area and of what is loaded) plus a circle round every solid thing (trees, graves,
 * benches...), looked up in a grid. Things come and go with their tiles, so the grid takes adds and removes.
 */
const CELL = 4; // units

/** @param mapBlocks (x, z) -> true where the map stops the walker; @param radius the walker's own radius (units) */
export function createColliders(mapBlocks, radius) {
  const grid = new Map();
  const key = (i, j) => i + ',' + j;
  const cellsOf = (t) => {
    const r = t.solid + radius;
    const out = [];
    for (let i = Math.floor((t.x - r) / CELL); i <= Math.floor((t.x + r) / CELL); i++) {
      for (let j = Math.floor((t.z - r) / CELL); j <= Math.floor((t.z + r) / CELL); j++) out.push(key(i, j));
    }
    return out;
  };

  /** The solid thing the walker would touch at (x, z), or null. */
  function solidAt(x, z) {
    for (const t of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
      if (Math.hypot(t.x - x, t.z - z) < t.solid + radius) return t;
    }
    return null;
  }

  return {
    solidAt,
    add(things) {
      for (const t of things) {
        if (!t.solid) continue;
        for (const k of cellsOf(t)) {
          if (!grid.has(k)) grid.set(k, new Set());
          grid.get(k).add(t);
        }
      }
    },
    remove(things) {
      for (const t of things) if (t.solid) for (const k of cellsOf(t)) grid.get(k)?.delete(t);
    },
    /** True where the walker cannot stand. */
    blocked: (x, z) => mapBlocks(x, z) || solidAt(x, z) !== null,
  };
}
