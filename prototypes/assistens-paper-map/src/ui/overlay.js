/**
 * Small helpers shared by the on-screen overlays (styles in src/styles.css).
 * Overlays are left out in capture mode (?capture) so review screenshots show only the scene; ?capture&hud keeps them.
 */
export const isCaptureMode = () => { const q = new URLSearchParams(location.search); return q.has('capture') && !q.has('hud'); };

/** A fixed overlay element with this class, added to the page; toggle its `visible` class to fade it in and out. */
export function createOverlay(className) {
  const el = document.createElement('div');
  el.className = className;
  document.body.appendChild(el);
  return el;
}
