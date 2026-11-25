/**
 * A paper label at the top of the screen naming who rests at the notable grave nearest the walker (within RANGE).
 * Texts live in src/data/notable-graves.js, keyed by the names in assistens-osm.js `tombs`.
 */
import { NOTABLE_GRAVES } from '../data/notable-graves.js';
import { isCaptureMode, createOverlay } from './overlay.js';

const RANGE = 4.2; // units (~20 m)

/** @param notable [{ x, z, name }] from the plan */
export function attachGraveLabels(H, notable) {
  if (isCaptureMode()) return;
  const tag = createOverlay('grave-label');
  let shown = null;

  H.onStep(() => {
    const p = H.hero.group.position;
    let best = null;
    let bestDist = RANGE;
    for (const n of notable) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    if (best === shown) return;
    shown = best;
    if (best) {
      const name = document.createElement('b');
      name.textContent = best.name;
      const about = document.createElement('span');
      about.textContent = NOTABLE_GRAVES[best.name] ?? '';
      tag.replaceChildren(name, document.createElement('br'), about);
    }
    tag.classList.toggle('visible', !!best);
  });
}
