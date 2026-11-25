/** The button that switches between the walking view and the map view (Z does the same). */
import { createOverlay } from './overlay.js';

export function attachZoomButton(game) {
  const button = createOverlay('zoom-button');
  button.setAttribute('role', 'button');
  const label = (mode) => { button.textContent = mode === 'walk' ? 'Kort · Map (Z)' : 'Gå · Walk (Z)'; };
  button.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a click on the scene
  button.addEventListener('click', (e) => { e.stopPropagation(); game.toggleZoom(); });
  game.onZoom(label);
  label(game.state.zoom);
}
