/**
 * Cyclists ride back and forth along the big streets: one on every other mapped stretch of the cycle streets. Each
 * rider is { id, x, z, dx, dz } in the game state (dx, dz: the way it is riding); a style draws them there.
 */
import { pointAlong, polylineLengths } from './map/math.js';

const MAX_STEP = 0.1; // seconds: a long frame never teleports a rider

/** @param routes plan.cycleRoutes; @param rnd the plan's random stream (start positions and speeds) */
export function createTraffic(routes, rnd) {
  const riders = [];
  routes.forEach((route, k) => {
    if (k % 2) return;
    const lengths = polylineLengths(route.pts);
    const total = lengths.reduce((a, b) => a + b, 0);
    if (total < 1) return;
    riders.push({
      id: `cyclist-${riders.length + 1}`, route: route.pts, lengths, total, look: k,
      s: rnd() * Math.min(10, total), dir: k % 4 ? 1 : -1, speed: 3.2 + rnd() * 1.6, x: route.pts[0][0], z: route.pts[0][1], dx: 1, dz: 0,
    });
  });

  function step(dt) {
    dt = Math.min(dt, MAX_STEP);
    for (const r of riders) {
      r.s += r.dir * r.speed * dt;
      if (r.s > r.total) { r.s = r.total; r.dir = -1; }
      if (r.s < 0) { r.s = 0; r.dir = 1; }
      const p = pointAlong(r.route, r.lengths, r.s);
      r.x = p.x;
      r.z = p.z;
      r.dx = p.dx * r.dir;
      r.dz = p.dz * r.dir;
    }
  }
  step(0);
  return { riders, step };
}
