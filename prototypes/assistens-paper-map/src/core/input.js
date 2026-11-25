/**
 * Input: the keyboard (arrows or WASD to walk, Shift to run, Z to switch zoom) turned into an intent the game reads
 * each step: { x, z, run } with x east and z south. Physical keys (any layout); all released when the page loses focus.
 * Touch controls can feed the same intent later.
 */
const KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

export function createKeyboard({ onZoom } = {}) {
  const down = new Set();
  let run = false;
  addEventListener('keydown', (e) => {
    run = e.shiftKey;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyZ' && !e.repeat) onZoom?.();
    if (!KEYS[e.code]) return;
    down.add(e.code);
    e.preventDefault();
  });
  addEventListener('keyup', (e) => { run = e.shiftKey; down.delete(e.code); });
  addEventListener('blur', () => down.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) down.clear(); });

  return {
    /** The current intent: { x, z, run }. */
    read() {
      let x = 0;
      let z = 0;
      for (const c of down) { x += KEYS[c][0]; z += KEYS[c][1]; }
      return { x, z, run };
    },
    clear() { down.clear(); },
  };
}

/** For tests and scripted walks: an intent you set by hand. */
export function createScriptedInput() {
  let intent = { x: 0, z: 0, run: false };
  return { read: () => intent, set: (x, z, run = false) => { intent = { x, z, run }; }, clear() { intent = { x: 0, z: 0, run: false }; } };
}
