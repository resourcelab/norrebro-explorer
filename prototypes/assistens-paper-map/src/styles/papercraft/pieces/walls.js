/**
 * Walls, hedges and gate posts as thin prism folds (a box of card), so a wall seen end-on still shows a face and a lid.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { prismFold } from 'papercraft/lib/paperkit-3d.js';
import { PALETTE as C } from '../settings.js';
export { splitRuns } from '../../../core/map/math.js';

export function wallPaint(P) {
  P.gradient(P2.shade(C.wall, 0.08), P2.shade(C.wall, -0.1), 0.4);
  P.marks('brick', { color: P2.shade(C.wall, -0.4), alpha: 0.35, size: 0.05 });
  P.draw((g) => {
    g.fillStyle = C.coping;
    g.fillRect(P.box.x0 - 1, P.box.y1 - P.box.h * 0.14, P.box.w + 2, P.box.h * 0.15);
    g.fillStyle = P2.shade(C.wall, -0.25);
    g.fillRect(P.box.x0 - 1, P.box.y0 - 1, P.box.w + 2, P.box.h * 0.1);
  });
  P.innerShade(P2.shade(C.wall, -0.6), { alpha: 0.25, blurPx: 6 });
}

export const lidPaint = (col) => (P) => {
  P.gradient(P2.shade(col, 0.1), P2.shade(col, -0.1), 0.5);
  P.marks('tick', { color: P2.shade(col, -0.35), alpha: 0.3, size: 0.06 });
};

export function hedgePaint(P) {
  P.gradient(P2.shade(C.hedge, 0.12), P2.shade(C.hedge, -0.12), 0.6);
  P.marks('leaf', { color: P2.shade(C.hedge, 0.3), alpha: 0.7, size: 0.12 });
  P.marks('leaf', { color: P2.shade(C.hedge, -0.3), alpha: 0.5, size: 0.1 });
}

/** One wall or hedge run as a prism fold on a hinge, its front face turned toward the camera. */
export function placeRun(H, popup, [[ax, az], [bx, bz]], { h, t, wall, lid }) {
  const L = Math.hypot(bx - ax, bz - az);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  let yaw = Math.atan2(-(bz - az), bx - ax);
  if (Math.cos(yaw) < 0) yaw += Math.PI;
  const footprint = [[-L / 2, t / 2], [L / 2, t / 2], [L / 2, -t / 2], [-L / 2, -t / 2]];
  const print = H.cardOpts(cx, cz, 1, null, 0.8);
  const node = prismFold(footprint, { h, roof: 'flat', paints: { wall, roof: lid }, ...print, print });
  return popup(null, null, { node, height: h, x: cx, z: cz, yaw, level: true });
}

/** A square gate pillar with a pyramid cap. */
export function gatePost(H, popup, x, z, scale = 1) {
  const node = prismFold([[-0.32, 0.32], [0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]], {
    h: 1.9, roof: 'pyramid', roofH: 0.45, paints: { wall: wallPaint, roof: lidPaint(C.coping) }, paper: H.paper, seed: 90,
    print: H.cardOpts(x, z),
  });
  return popup(null, null, { node, height: 2.4, x, z, yaw: 0.3, level: true, solid: 0.5, scale });
}
