/**
 * A Copenhagen-style street sign in the bottom-left corner naming the street the walker is on (game.state.street):
 * a small lesson in reading street names as you go. Hidden when he is not on a named street.
 */
import { isCaptureMode, createOverlay } from './overlay.js';

export function attachStreetSign(game) {
  if (isCaptureMode()) return;
  const sign = createOverlay('street-sign');
  let shown = null;
  game.onFrame((state) => {
    if (state.street === shown) return;
    shown = state.street;
    if (shown) sign.textContent = shown;
    sign.classList.toggle('visible', !!shown);
  });
}
