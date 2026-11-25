/**
 * The papercraft camera for the game's two zooms (LENS in settings.js): it eases the harness camera's distance and
 * pitch over, and retunes the lens (haze, tilt-shift blur) so the map view reads.
 */
import { LENS } from '../settings.js';

const EASE = 0.6; // seconds to settle into the other zoom

export function createCamera(H) {
  let mode = 'walk';
  let from = { dist: LENS.walk.dist, pitch: LENS.walk.pitch };
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
    if (mode !== 'map') return;
    H.view.dist = LENS.map.dist;
    H.view.tpitch = H.view.pitch = LENS.map.pitch;
  });
  H.view.pitchMin = LENS.walk.pitchMin;
  H.view.pitchMax = LENS.walk.pitchMax;

  return {
    /** Switch to 'walk' or 'map'; instant: no easing (for the first frame). */
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
