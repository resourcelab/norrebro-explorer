/**
 * Placement inside the walls: notable graves, trees, grave plots, benches and lamp posts.
 * Positions only; world/build-cemetery.js turns them into paper pieces.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { OSM } from '../data/assistens-osm.js';
import { toUnits } from '../map/units.js';
import { inPolygon, polylineDistance, besideSegment } from '../map/math.js';
import { OUTLINE, BOUNDS, insideCemetery, AVENUES, pathDistance, wallDistance } from '../map/cemetery.js';

/** Broadleaf mix for trees that are not on Poppelalléen (linden is the cemetery's commonest). */
const TREE_MIX = ['linden', 'linden', 'linden', 'chestnut', 'maple', 'beech', 'yew'];

/** Notable graves at their mapped positions: [{ x, z, name }]. */
export function planNotableGraves(keep) {
  const notable = OSM.tombs.map(([x, y, name]) => {
    const [ux, uz] = toUnits([x, y]);
    return { x: ux, z: uz, name };
  });
  for (const n of notable) keep.add(n.x, n.z, 1.3);
  return notable;
}

/**
 * Trees: the ~377 mapped trees (the Poppelalléen line becomes poplars), thinned so crowns don't stack, then filler
 * trees in the parts of the cemetery where nothing is mapped. Returns [{ x, z, kind }].
 */
export function planTrees(keep, rnd) {
  const poplarAvenue = AVENUES[1].pts;
  const trees = [];
  const tooClose = (x, z, r) => trees.some((t) => Math.hypot(t.x - x, t.z - z) < r);
  const grown = OUTLINE.map(([px, pz]) => [px * 1.04, pz * 1.04]); // the outline, a little larger: trees on the wall line

  for (const mapped of OSM.trees) {
    let [x, z] = toUnits(mapped);
    // the paths are drawn wider than life, so step avenue trees out onto the verge (gradient ascent on path distance)
    for (let it = 0; it < 6 && pathDistance(x, z) < 0.35; it++) {
      const e = 0.08;
      const gx = pathDistance(x + e, z) - pathDistance(x - e, z);
      const gz = pathDistance(x, z + e) - pathDistance(x, z - e);
      const n = Math.hypot(gx, gz) || 1;
      const step = 0.4 - pathDistance(x, z);
      x += (gx / n) * step;
      z += (gz / n) * step;
    }
    if (!insideCemetery(x, z) && !inPolygon(x, z, grown)) continue;
    const poplar = polylineDistance(x, z, poplarAvenue) < 2.2;
    if (tooClose(x, z, poplar ? 2.4 : 3.0) || pathDistance(x, z) < 0.3 || !keep.clear(x, z, 0.4)) continue;
    trees.push({ x, z, kind: poplar ? 'poplar' : null });
  }

  // filler: a jittered 3.4-unit grid, kept off paths and walls and well away from other trees
  const fill = P2.rng(17);
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 3.4) {
    for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 3.4) {
      const px = x + (fill() - 0.5) * 2.6;
      const pz = z + (fill() - 0.5) * 2.6;
      if (!insideCemetery(px, pz) || pathDistance(px, pz) < 0.6 || wallDistance(px, pz) < 1.4) continue;
      if (!keep.clear(px, pz, 1) || tooClose(px, pz, 6.2) || fill() < 0.45) continue;
      trees.push({ x: px, z: pz, kind: null });
    }
  }

  for (const t of trees) if (!t.kind) t.kind = TREE_MIX[Math.floor(rnd() * TREE_MIX.length)];
  for (const t of trees) keep.add(t.x, t.z, 0.7);
  return trees;
}

/**
 * Grave plots: a staggered grid (2.4 × 1.9 units) off the paths, walls, trees and landmarks, with a few open lawns
 * left by a noise mask. Ordinary graves are procedural; only the notable ones sit at real positions.
 * Returns [{ x, z, variant }] where variant picks the stone, size and tilt.
 */
export function planPlots(keep) {
  const lawnMask = P2.tileNoise(64, 6, P2.rng(23));
  const lawnAt = (x, z) => {
    const j = Math.floor(((z - BOUNDS.z0) / (BOUNDS.z1 - BOUNDS.z0)) * 63) & 63;
    const i = Math.floor(((x - BOUNDS.x0) / (BOUNDS.x1 - BOUNDS.x0)) * 63) & 63;
    return lawnMask[j * 64 + i];
  };
  const plots = [];
  const r = P2.rng(31);
  for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 1.9) {
    for (let x = BOUNDS.x0 + (Math.round(z / 1.9) % 2) * 1.2; x < BOUNDS.x1; x += 2.4) {
      const px = x + (r() - 0.5) * 0.9;
      const pz = z + (r() - 0.5) * 0.6;
      if (!insideCemetery(px, pz) || pathDistance(px, pz) < 0.7 || wallDistance(px, pz) < 1.1 || !keep.clear(px, pz, 0.5)) continue;
      if (lawnAt(px, pz) > 0.86 || r() < 0.04) continue;
      plots.push({ x: px, z: pz, variant: Math.floor(r() * 1e6) });
    }
  }
  return plots;
}

/** Benches: the mapped ones inside the walls, thinned to one per 2.4 units. Returns [[x, z]]. */
export function planBenches() {
  const benches = [];
  for (const b of OSM.benches) {
    const [x, z] = toUnits(b);
    if (insideCemetery(x, z) && benches.every((q) => Math.hypot(q[0] - x, q[1] - z) > 2.4)) benches.push([x, z]);
  }
  return benches;
}

/** Copenhagen park lamps every 9 units along the two asphalt avenues, alternating sides. Returns [[x, z]]. */
export function planLamps(keep) {
  const SPACING = 9;
  const lamps = [];
  for (const p of AVENUES) {
    let next = 4; // distance from the current segment's start to the next lamp
    let side = 1;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i];
      const b = p.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (; next < L; next += SPACING) {
        const [x, z] = besideSegment(a, b, next / L, side * (p.half + 0.5));
        if (insideCemetery(x, z) && keep.clear(x, z, 0.3)) lamps.push([x, z]);
        side = -side;
      }
      next -= L; // carry the remainder into the next segment (short segments are stepped over correctly)
    }
  }
  return lamps;
}
