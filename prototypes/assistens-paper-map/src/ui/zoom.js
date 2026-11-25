/**
 * Two zooms: close for walking, and a map view that shows about 400 m across (steeper, almost top-down, with the haze
 * pushed back and the tilt-shift blur eased so the whole map reads). Z or the button switches; the camera eases over.
 * ?zoom=map opens in the map view.
 */
import { ZOOMS } from '../config.js';
import { createOverlay } from './overlay.js';

const EASE = 0.6; // seconds to settle into the other zoom

export function attachZoom(H, { capture = false } = {}) {
  let mode = 'walk';
  let from = { ...ZOOMS.walk };
  let t = 1;
  const button = capture ? null : createOverlay('zoom-button');
  if (button) {
    button.setAttribute('role', 'button');
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
    button.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  }

  function label() {
    if (button) button.textContent = mode === 'walk' ? 'Kort · Map (Z)' : 'Gå · Walk (Z)';
  }

  function toggle(to = mode === 'walk' ? 'map' : 'walk') {
    from = { dist: H.view.dist, pitch: H.view.tpitch };
    mode = to;
    t = 0;
    const z = ZOOMS[mode];
    H.view.pitchMin = z.pitchMin;
    H.view.pitchMax = z.pitchMax;
    lensDone = false;
    label();
  }

  // the lens exists once the harness has started: retune it on the next step after a switch
  let lensDone = false;
  function tuneLens() {
    if (lensDone || !H.post) return;
    const z = ZOOMS[mode];
    H.post.o.hazeStart = z.haze[0];
    H.post.o.hazeEnd = z.haze[1];
    Object.assign(H.post.o, z.blur);
    H.post.apply();
    lensDone = true;
  }

  addEventListener('keydown', (e) => { if (e.code === 'KeyZ' && !e.metaKey && !e.ctrlKey) toggle(); });
  H.onStep((time, dt) => {
    tuneLens();
    if (t >= 1) return;
    t = Math.min(1, t + dt / EASE);
    const e = t * t * (3 - 2 * t);
    const z = ZOOMS[mode];
    H.view.dist = from.dist + (z.dist - from.dist) * e;
    H.view.tpitch = from.pitch + (z.pitch - from.pitch) * e;
  });
  H.view.pitchMin = ZOOMS.walk.pitchMin;
  H.view.pitchMax = ZOOMS.walk.pitchMax;
  label();
  if (new URLSearchParams(location.search).get('zoom') === 'map') { toggle('map'); t = 0.999; } // ?zoom=map opens on the map
  // restart() puts the camera back to its first distance: keep the zoom the player chose
  H.onRestart(() => { if (mode === 'map') { H.view.dist = ZOOMS.map.dist; H.view.tpitch = H.view.pitch = ZOOMS.map.pitch; } });
  return { toggle, get mode() { return mode; } };
}
