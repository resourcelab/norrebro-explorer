/**
 * Cyclists ride back and forth along their street. Each frame moves every rider along its route and flips the card
 * so the bike faces the way it is going (the cards face the camera, so "facing" is left or right on screen).
 */
import { pointAlong } from '../map/math.js';

const MAX_STEP = 0.1; // seconds: a long frame (tab in the background) never teleports a rider

export function startTraffic(H, riders) {
  H.onStep((t, dt) => {
    for (const r of riders) ride(r, Math.min(dt, MAX_STEP));
  });
}

function ride(r, dt) {
  r.s += r.dir * r.speed * dt;
  if (r.s > r.total) { r.s = r.total; r.dir = -1; }
  if (r.s < 0) { r.s = 0; r.dir = 1; }
  const p = pointAlong(r.route, r.lengths, r.s);
  const g = r.hinge.group;
  g.position.x = p.x;
  g.position.z = p.z;
  const headingRight = p.dx * r.dir >= 0;
  g.scale.x = Math.abs(g.scale.x) * (headingRight ? 1 : -1);
}
