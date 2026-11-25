/**
 * Near stands up, far lies flat. Every piece within STREAM.radius of the walker stands; further away cards fold flat
 * and are then hidden, and constructions (blocks, walls) are hidden at once (a folding house looks wrong). The ground
 * print shows what lies flat: roofs, streets, parks. This keeps the frame cheap however big the map gets.
 *
 * Pieces come two ways:
 *   - built at load and handed over with add(hinge, ...) (the cemetery: small, and you start in it)
 *   - built when first needed with lazy(x, z, make) (the neighbourhood: hundreds of blocks; make() is called the first
 *     time the walker comes near, nearest first, a couple per frame so walking never stutters)
 * Landmarks pass `always`: they stand whatever the distance, so you can steer by them.
 */
import { STREAM } from '../config.js';

const UP = 1;
const DOWN = 0;
const FOLDING = 2;
/** At the start, pieces within this share of the radius are built before the first frame. */
const START_NOW = 0.5;

export function createStream(H, {
  radius = STREAM.radius, hysteresis = STREAM.hysteresis, checkEvery = STREAM.checkEvery,
  buildPerStep = STREAM.buildPerStep, budgetMs = STREAM.budgetMs,
} = {}) {
  const items = [];
  const queue = []; // lazy items waiting to be built, nearest first
  let sinceCheck = Infinity;
  let started = false;

  const heroAt = () => (H.hero ? H.hero.group.position : { x: 0, z: 0 });
  const wanted = (it, p) => it.always || Math.hypot(it.x - p.x, it.z - p.z) < radius + (it.state === UP ? hysteresis : 0);

  // each piece's own fixed jitter (popup's h.jit, 0..0.035) staggers the folds, so a row rises like a wave
  function raise(it) {
    const h = it.hinge;
    if (!h.group.visible) { h.group.visible = true; h.reset(0); } // from flat: rise from the page
    h.set(1, h.jit * 7);
    it.state = UP;
  }

  function lower(it) {
    const h = it.hinge;
    if (it.node) {
      h.group.visible = false;
      h.reset(0);
      it.state = DOWN;
    } else {
      h.set(0, h.jit * 5);
      it.state = FOLDING;
    }
  }

  function check() {
    const p = heroAt();
    for (const it of items) {
      const want = wanted(it, p);
      if (!it.hinge) {
        if (want && !it.queued) { it.queued = true; queue.push(it); }
        continue;
      }
      if (want && it.state !== UP) raise(it);
      else if (!want && it.state === UP) lower(it);
      else if (it.state === FOLDING && it.hinge.p < 0.03) { it.hinge.group.visible = false; it.state = DOWN; }
    }
    queue.sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z)); // nearest last: pop()
  }

  // a few pieces per frame, within a small time budget, so walking into a new street never stutters
  function buildSome() {
    const p = heroAt();
    const t0 = performance.now();
    for (let n = 0; n < buildPerStep && queue.length && (n === 0 || performance.now() - t0 < budgetMs); n++) {
      const it = queue.pop();
      it.queued = false;
      if (!wanted(it, p)) continue; // walked away before its turn
      it.hinge = it.make();
      it.make = null;
      if (!it.hinge) { items.splice(items.indexOf(it), 1); continue; }
      it.state = DOWN;
      if (started) raise(it);
    }
  }

  return {
    /** A piece built already. node: a construction (hidden, not folded, when far). always: a landmark. */
    add(hinge, { x, z, node = false, always = false }) {
      if (hinge) items.push({ hinge, x, z, node, always, state: UP });
      return hinge;
    },
    /** A piece built the first time the walker comes within range: make() returns its hinge (or null). */
    lazy(x, z, make, { node = false, always = false } = {}) {
      items.push({ hinge: null, make, x, z, node, always, state: DOWN, queued: false });
    },
    /**
     * Before H.start(): build what is in range now (so the opening frame is complete) and hide what is not.
     * Then follow the walker.
     */
    start() {
      check();
      // build what the opening frame shows in one go; the rest of what is in range follows over the first seconds
      const p0 = heroAt();
      const now = queue.filter((it) => Math.hypot(it.x - p0.x, it.z - p0.z) < radius * START_NOW);
      for (const it of now) {
        queue.splice(queue.indexOf(it), 1);
        it.queued = false;
        it.hinge = it.make();
        it.make = null;
        if (it.hinge) it.state = UP;
        else items.splice(items.indexOf(it), 1);
      }
      const p = heroAt();
      for (const it of items) {
        if (it.hinge && !wanted(it, p)) {
          it.hinge.group.visible = false;
          it.state = DOWN;
        }
      }
      H.onStep((t, dt) => {
        sinceCheck += dt;
        if (sinceCheck >= checkEvery) { sinceCheck = 0; check(); }
        buildSome();
      });
      started = true; // what is standing now rises with the harness's own opening; from here on we raise what we build
    },
    /** For tests and the HUD: how many pieces exist, are built, and stand. */
    stats() {
      let built = 0;
      let up = 0;
      for (const it of items) { if (it.hinge) built++; if (it.state === UP) up++; }
      return { pieces: items.length, built, standing: up, waiting: queue.length };
    },
  };
}
