/**
 * A Copenhagen-style street sign in the bottom-left corner naming the street the walker is on: a small lesson in
 * reading street names as you go. Hidden when he is not on (or right beside) a named street.
 */
import { STREETS } from '../map/neighbourhood.js';
import { polylineDistance } from '../map/math.js';
import { isCaptureMode, createOverlay } from './overlay.js';

const CHECK_EVERY = 0.25; // seconds: four looks a second is plenty
const BESIDE = 1.2; // units beyond the street edge that still count as "on" it (the pavement)

export function attachStreetSign(H) {
  if (isCaptureMode()) return;
  const sign = createOverlay('street-sign');
  const named = STREETS.filter((s) => s.name);
  let shown = null;
  let lastCheck = -Infinity;

  H.onStep((t) => {
    if (t - lastCheck < CHECK_EVERY) return;
    lastCheck = t;
    const p = H.hero.group.position;
    let best = null;
    let bestDist = BESIDE;
    for (const s of named) {
      const d = polylineDistance(p.x, p.z, s.pts) - s.half;
      if (d < bestDist) { bestDist = d; best = s.name; }
    }
    if (best === shown) return;
    shown = best;
    if (best) sign.textContent = best;
    sign.classList.toggle('visible', !!best);
  });
}
