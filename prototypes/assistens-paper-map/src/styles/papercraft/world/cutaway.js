/**
 * The cut-away: a block standing between the camera and the walker folds down toward the page while he is behind it,
 * and rises again once he walks out, so the walker (3.5 m, under the shop signs) is never lost behind a five-storey
 * block. Every CHECK seconds it looks along the line from the walker toward the camera, as far as the tallest block
 * could hide him, a little wider than he is, and tells the presenter which blocks are in the way.
 */
import { inPolygon } from '../../../core/map/math.js';

const CHECK = 0.2; // seconds
const REACH = 12; // units toward the camera: a tall block this far off can still hide him at the street zoom
const SIDES = [-0.45, 0, 0.45]; // units either side of the line (his width, and a little room)

/** @param blocks Map id -> footprint pts (units) of the blocks that may fold */
export function createCutaway(H, presenter, blocks) {
  let since = 0;
  H.onStep((t, dt) => {
    since += dt;
    if (since < CHECK) return;
    since = 0;
    const hero = H.hero.group.position;
    const cam = H.camera.position;
    const [dx, dz] = [cam.x - hero.x, cam.z - hero.z];
    const L = Math.hypot(dx, dz) || 1;
    const [ux, uz] = [dx / L, dz / L];
    const reach = Math.min(REACH, L);
    const inWay = new Set();
    for (const [id, pts] of blocks) {
      const [bx, bz] = pts[0];
      if (Math.hypot(bx - hero.x, bz - hero.z) > reach + 12) continue; // far off: skip the closer look
      for (const side of SIDES) {
        let hit = false;
        for (let s = 0.4; s <= reach && !hit; s += 0.3) hit = inPolygon(hero.x + ux * s - uz * side, hero.z + uz * s + ux * side, pts);
        if (hit) { inWay.add(id); break; }
      }
    }
    presenter.cutAway(inWay);
  });
}
