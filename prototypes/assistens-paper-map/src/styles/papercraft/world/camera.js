/**
 * The papercraft camera for the game's zooms (LENS in settings.js): it eases the harness camera's distance and pitch
 * over, and retunes the lens (haze, tilt-shift blur) so each zoom reads.
 */
import { LENS } from '../settings.js';

const EASE = 0.6; // seconds to settle into the other zoom

export function createCamera(H, start) {
  let mode = start;
  let from = { dist: LENS[start].dist, pitch: LENS[start].pitch };
  let t = 1;
  let lensDone = false;

  // the lens exists once the harness has started: retune it on the next step after a switch
  function tuneLens() {
    if (lensDone || !H.post) return;
    const z = LENS[mode];
    H.post.o.hazeStart = z.haze[0];
    H.post.o.hazeEnd = z.haze[1];
    Object.assign(H.post.o, z.blur);
    H.post.apply();
    lensDone = true;
  }

  H.onStep((time, dt) => {
    tuneLens();
    if (t >= 1) return;
    t = Math.min(1, t + dt / EASE);
    const e = t * t * (3 - 2 * t);
    H.view.dist = from.dist + (LENS[mode].dist - from.dist) * e;
    H.view.tpitch = from.pitch + (LENS[mode].pitch - from.pitch) * e;
  });
  // restart() puts the camera back to its first distance: keep the zoom the player chose
  H.onRestart(() => {
    H.view.dist = LENS[mode].dist;
    H.view.tpitch = H.view.pitch = LENS[mode].pitch;
  });
  H.view.pitchMin = LENS[start].pitchMin;
  H.view.pitchMax = LENS[start].pitchMax;

  return {
    /** Switch zoom (a key of LENS); instant: no easing (for the first frame). */
    set(to, { instant = false } = {}) {
      from = { dist: H.view.dist, pitch: H.view.tpitch };
      mode = to;
      t = instant ? 0.999 : 0;
      H.view.pitchMin = LENS[mode].pitchMin;
      H.view.pitchMax = LENS[mode].pitchMax;
      lensDone = false;
    },
  };
}
