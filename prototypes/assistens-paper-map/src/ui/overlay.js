/**
 * Small helpers shared by the on-screen overlays (styles in src/styles.css).
 * Overlays are left out in capture mode (?capture) so review screenshots show only the scene.
 */
export const isCaptureMode = () => new URLSearchParams(location.search).has('capture');

/** A fixed overlay element with this class, added to the page; toggle its `visible` class to fade it in and out. */
export function createOverlay(className) {
  const el = document.createElement('div');
  el.className = className;
  document.body.appendChild(el);
  return el;
}
