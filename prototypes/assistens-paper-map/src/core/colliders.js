/**
 * Collision: may the walker stand at (x, z)? The map's rules (core/map/walk.js: buildings, water, walls, hedges, the
 * edge of the play area) plus a circle round every solid thing (trees, graves, benches...), looked up in a grid.
 */
import { blocksWalker } from './map/walk.js';

const CELL = 4; // units

/** @param things from core/world.js; @param radius the walker's own radius (units) */
export function createColliders(things, radius) {
  const grid = new Map();
  const key = (i, j) => i + ',' + j;
  for (const t of things) {
    if (!t.solid) continue;
    const r = t.solid + radius;
    for (let i = Math.floor((t.x - r) / CELL); i <= Math.floor((t.x + r) / CELL); i++) {
      for (let j = Math.floor((t.z - r) / CELL); j <= Math.floor((t.z + r) / CELL); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(t);
      }
    }
  }

  /** The solid thing the walker would touch at (x, z), or null. */
  function solidAt(x, z) {
    for (const t of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
      if (Math.hypot(t.x - x, t.z - z) < t.solid + radius) return t;
    }
    return null;
  }

  return {
    solidAt,
    /** True where the walker cannot stand. */
    blocked: (x, z) => blocksWalker(x, z) || solidAt(x, z) !== null,
  };
}
