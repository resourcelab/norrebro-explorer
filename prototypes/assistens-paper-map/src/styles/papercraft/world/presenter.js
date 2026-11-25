/**
 * What near and far look like in paper. The game core says which things are near (core/nearby.js); here a near thing
 * stands up and a far one lies flat:
 *   - cards fold flat and are then hidden; constructions (blocks, walls, sheds) are hidden at once (a folding house
 *     looks wrong); the printed ground shows what lies flat (roofs, streets, parks)
 *   - a thing's paper pieces are only built the first time it comes near, nearest first, a few per frame within a
 *     small time budget, so the load stays quick and walking into a new street never stutters
 *   - things arrive and leave with their tiles (add, remove); a removed thing's pieces leave the scene
 */
import { BUILD } from '../settings.js';

const UP = 1;
const DOWN = 0;
const FOLDING = 2;

/**
 * @param makers Map id -> { x, z, node, make: () => hinge | hinge[] | null }
 */
export function createPresenter(H, makers, { buildPerStep = BUILD.buildPerStep, budgetMs = BUILD.budgetMs } = {}) {
  const items = new Map(); // id -> { ...maker, hinges, state, wanted }
  const take = (list) => { for (const [id, m] of list) if (!items.has(id)) items.set(id, { ...m, id, hinges: null, state: DOWN, wanted: false }); };
  take(makers);
  const queue = [];
  let started = false;

  const heroAt = () => H.hero.group.position;
  const dist = (it, p) => Math.hypot(it.x - p.x, it.z - p.z);

  // each piece's own fixed jitter (popup's h.jit, 0..0.035) staggers the folds, so a row rises like a wave
  function raise(it) {
    for (const h of it.hinges) {
      if (!h.group.visible) { h.group.visible = true; h.reset(0); } // from flat: rise from the page
      h.set(1, h.jit * 7);
    }
    it.state = UP;
  }
  function lower(it) {
    for (const h of it.hinges) {
      if (it.node) { h.group.visible = false; h.reset(0); } else h.set(0, h.jit * 5);
    }
    it.state = it.node ? DOWN : FOLDING;
  }
  function build(it) {
    const made = it.make();
    it.make = null;
    it.hinges = made ? [].concat(made) : [];
  }

  function buildSome() {
    if (!queue.length) return;
    const p = heroAt();
    queue.sort((a, b) => dist(b, p) - dist(a, p)); // nearest last: pop()
    const t0 = performance.now();
    for (let n = 0; n < buildPerStep && queue.length && (n === 0 || performance.now() - t0 < budgetMs); n++) {
      const it = queue.pop();
      it.queued = false;
      if (!it.wanted || it.hinges) continue; // went far again before its turn
      build(it);
      it.state = DOWN;
      if (it.wanted) raise(it);
    }
  }

  // finish folds: a card that has folded flat is hidden
  function tidy() {
    for (const it of items.values()) {
      if (it.state === FOLDING && it.hinges.every((h) => h.p < 0.03)) {
        for (const h of it.hinges) h.group.visible = false;
        it.state = DOWN;
      }
    }
  }

  return {
    /**
     * Before H.start(): build what is near now and close to the walker (so the opening frame is complete); the rest
     * of what is near follows over the first seconds.
     */
    start(nearIds, radius) {
      const p = heroAt();
      for (const id of nearIds) {
        const it = items.get(id);
        if (!it) continue;
        it.wanted = true;
        if (dist(it, p) < radius * BUILD.startShare || it.eager) { build(it); it.state = UP; } else { it.queued = true; queue.push(it); }
      }
      // pieces built for other reasons (eager critters) that are far: hidden
      for (const it of items.values()) {
        if (!it.wanted && it.eager) { build(it); for (const h of it.hinges) h.group.visible = false; }
      }
      let since = 0;
      H.onStep((t, dt) => {
        buildSome();
        since += dt;
        if (since > 0.3) { since = 0; tidy(); }
      });
      started = true;
    },
    /** The game's near/far changes: { came: ids, went: ids }. */
    update({ came, went }) {
      for (const id of came) {
        const it = items.get(id);
        if (!it) continue;
        it.wanted = true;
        if (it.hinges) { if (it.state !== UP) raise(it); } else if (!it.queued) { it.queued = true; queue.push(it); }
      }
      for (const id of went) {
        const it = items.get(id);
        if (!it) continue;
        it.wanted = false;
        if (it.hinges && it.state === UP && started) lower(it);
      }
    },
    /** Things that arrived with a tile that loaded: their makers. They are built when the game says they are near. */
    add(more) { take(more); },
    /** Things whose tile was dropped: take their pieces out of the scene for good. */
    remove(ids) {
      const dead = new Set();
      for (const id of ids) {
        const it = items.get(id);
        if (!it) continue;
        items.delete(id);
        it.wanted = false;
        for (const h of it.hinges ?? []) { h.group.removeFromParent(); dead.add(h); }
      }
      if (!dead.size) return;
      const kept = H.hinges.filter((h) => !dead.has(h)); // the harness animates every hinge in this list
      H.hinges.length = 0;
      H.hinges.push(...kept);
      for (let i = queue.length - 1; i >= 0; i--) if (!items.has(queue[i].id)) queue.splice(i, 1);
    },
    /** How many pieces exist, are built, and stand (for checks). */
    stats() {
      let built = 0;
      let up = 0;
      for (const it of items.values()) { if (it.hinges) built++; if (it.state === UP) up++; }
      return { things: items.size, built, standing: up, waiting: queue.length };
    },
  };
}
