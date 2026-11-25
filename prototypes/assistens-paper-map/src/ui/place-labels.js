/**
 * A paper label at the top of the screen naming the place the walker is at: a notable grave (who rests there) or a
 * landmark (a church, a park, a square). The nearest one in range wins.
 */
import { NOTABLE_GRAVES } from '../data/notable-graves.js';
import { isCaptureMode, createOverlay } from './overlay.js';

const GRAVE_RANGE = 4.2; // units (~20 m)
const LANDMARK_RANGE = 11; // units (~55 m)
const KIND_TEXT = { church: 'Kirke · church', flag: 'Park / plads · park or square' };

/**
 * @param notable [{ x, z, name }] notable graves from the plan
 * @param landmarks [{ x, z, name, kind }] from map/landmarks.js NAMED_PLACES
 */
export function attachPlaceLabels(H, notable, landmarks) {
  if (isCaptureMode()) return;
  const places = [
    ...notable.map((n) => ({ ...n, range: GRAVE_RANGE, about: NOTABLE_GRAVES[n.name] ?? '' })),
    ...landmarks.map((l) => ({ ...l, range: LANDMARK_RANGE, about: KIND_TEXT[l.kind] ?? '' })),
  ];
  const tag = createOverlay('grave-label');
  let shown = null;

  H.onStep(() => {
    const p = H.hero.group.position;
    let best = null;
    let bestScore = 1;
    for (const n of places) {
      const score = Math.hypot(n.x - p.x, n.z - p.z) / n.range; // under 1: in range; the most central wins
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best === shown) return;
    shown = best;
    if (best) {
      const name = document.createElement('b');
      name.textContent = best.name;
      const about = document.createElement('span');
      about.textContent = best.about;
      tag.replaceChildren(name, document.createElement('br'), about);
    }
    tag.classList.toggle('visible', !!best);
  });
}
