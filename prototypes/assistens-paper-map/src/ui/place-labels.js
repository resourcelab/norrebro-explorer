/**
 * A paper label at the top of the screen naming the place the walker is at: a notable grave (who rests there) or a
 * landmark (a church, a park, a square). The game works out which (game.state.place); this only shows it.
 */
import { isCaptureMode, createOverlay } from './overlay.js';

export function attachPlaceLabels(game) {
  if (isCaptureMode()) return;
  const tag = createOverlay('grave-label');
  let shown = null;
  game.onFrame((state) => {
    if (state.place === shown) return;
    shown = state.place;
    if (shown) {
      const name = document.createElement('b');
      name.textContent = shown.name;
      const about = document.createElement('span');
      about.textContent = shown.about;
      tag.replaceChildren(name, document.createElement('br'), about);
    }
    tag.classList.toggle('visible', !!shown);
  });
}
