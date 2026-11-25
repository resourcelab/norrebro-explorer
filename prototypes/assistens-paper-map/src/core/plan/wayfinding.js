/**
 * The plans that span the whole map, made once from the world's overview (so they never wait for a tile): fingerposts
 * to the far places, and the streets the cyclists ride.
 */
import { SCALE } from '../../config.js';
import { siteAt, siteEdgeDistance } from '../sites/index.js';

/** The streets cyclists ride (back and forth along each mapped stretch). */
const CYCLE_STREETS = new Set(['Nørrebrogade', 'Jagtvej', 'Kapelvej', 'Guldbergsgade']);

/**
 * @param world { overview, overviewIndex, inRegion }
 */
export function createWayfinding({ overview, overviewIndex, inRegion }) {
  const free = (x, z, r) => inRegion(x, z) && !siteAt(x, z) && !overviewIndex.buildingAt(x, z, r) && siteEdgeDistance(x, z) > 1.2;

  /** The nearest free pavement spot to (x, z), searching outward; null if none within `reach` units. */
  function freeSpotNear(x, z, reach = 12) {
    for (let r = 0; r <= reach; r += 0.5) {
      for (let k = 0; k < 16; k++) {
        const px = x + Math.cos((k / 16) * 2 * Math.PI) * r;
        const pz = z + Math.sin((k / 16) * 2 * Math.PI) * r;
        const d = overviewIndex.streetDistance(px, pz);
        if (free(px, pz, 0.4) && d > 0 && d < 1.5) return [px, pz];
      }
    }
    return null;
  }

  /**
   * Fingerposts to the far places: one by the cemetery gate nearest the start, pointing to all of them, and one at
   * the edge of the walkable area nearest each place. Returns [{ x, z, arms: [{ name, dx, metres }] }].
   */
  function planFingerposts(far, start) {
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

  /**
   * Streets cyclists ride along, where they touch the play area: [{ name, pts }]. OpenStreetMap cuts a street into
   * short pieces at junctions; pieces of the same street that meet end to end are joined into one long route, so the
   * riders spread out along the street instead of shuttling to and fro at a crossing.
   */
  function planCycleRoutes() {
    const pieces = overview.streets
      .filter((s) => CYCLE_STREETS.has(s.name) && s.pts.length >= 2 && s.pts.some(([x, z]) => inRegion(x, z)))
      .map((s) => ({ name: s.name, pts: s.pts.slice() }));
    const meets = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;
    const routes = [];
    while (pieces.length) {
      const r = pieces.shift();
      for (let grew = true; grew;) {
        grew = false;
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i];
          if (p.name !== r.name) continue;
          const [a, b] = [r.pts[0], r.pts[r.pts.length - 1]];
          if (meets(b, p.pts[0])) r.pts = r.pts.concat(p.pts.slice(1));
          else if (meets(b, p.pts[p.pts.length - 1])) r.pts = r.pts.concat(p.pts.slice(0, -1).reverse());
          else if (meets(a, p.pts[p.pts.length - 1])) r.pts = p.pts.slice(0, -1).concat(r.pts);
          else if (meets(a, p.pts[0])) r.pts = p.pts.slice(1).reverse().concat(r.pts);
          else continue;
          pieces.splice(i, 1);
          grew = true;
          break;
        }
      }
      routes.push(r);
    }
    const length = (pts) => pts.slice(1).reduce((L, p, i) => L + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    return routes.filter((r) => length(r.pts) > 12); // not the stubs between two lanes of a crossing
  }

  return { planFingerposts, planCycleRoutes, freeSpotNear };
}
