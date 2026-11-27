/** The button that steps to the next zoom (Z does the same); it names the zoom it goes to. */
import { ZOOMS, ZOOM_ORDER } from '../config.js';
import { createOverlay } from './overlay.js';

export function attachZoomButton(game) {
  const button = createOverlay('zoom-button');
  button.setAttribute('role', 'button');
  const label = (mode) => { button.textContent = `${ZOOMS[ZOOM_ORDER[(ZOOM_ORDER.indexOf(mode) + 1) % ZOOM_ORDER.length]].label} (Z)`; };
  button.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a click on the scene
  button.addEventListener('click', (e) => { e.stopPropagation(); game.toggleZoom(); });
  game.onZoom(label);
  label(game.state.zoom);
}
