/**
 * Assistens Kirkegård as things: the chapel, sheds, wall runs and gate posts, hedges, trees, grave plots, the notable
 * graves, benches, lamps, taps and a few crows and squirrels. See core/world.js for what a thing is.
 */
import { TOY } from '../../../config.js';
import { ASSISTENS as OSM } from '../../../data/sites/assistens.js';
import { toUnits } from '../../geo.js';
import { segmentDistance, splitRuns } from '../../map/math.js';
import { SOLID } from '../../solid.js';
import { rng } from '../../random.js';
import { insideCemetery, pathDistance, WALLS, HEDGES, GATES, openingTestFor, CHAPEL, CHAPEL_CENTRE, CHAPEL_YAW, SHEDS } from './map.js';

/** Graves that get the tall stele. */
const TALL_GRAVES = /Andersen|Kierkegaard|Bohr|Ørsted/;
const WALL_RUN = 5; // units: walls are cut into straight runs no longer than this
const HEDGE_RUN = 4;
const GATE_POST_OFFSET = 1.55; // units either side of a gate's centre
const CRITTER_TRIES = 26;

/**
 * @param plan from the site's plan()
 * @param rnd the site's random stream
 * @param add (kind, fields) -> thing
 */
export function describeAssistens(plan, rnd, add) {
  const between = (a, b) => a + rnd() * (b - a);
  add('chapel', { x: CHAPEL_CENTRE[0], z: CHAPEL_CENTRE[1], pts: CHAPEL, yaw: CHAPEL_YAW, always: true });
  for (const pts of SHEDS) {
    const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const z = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    add('shed', { x, z, pts });
  }
  WALLS.forEach((w, i) => {
    for (const [a, b] of splitRuns(w, { maxLen: WALL_RUN, gap: openingTestFor(i) })) add('wall', { wall: 'wall', a, b, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2 });
  });
  for (const [x, z] of gatePosts()) add('gate-post', { x, z, solid: SOLID.gatePost });
  for (const h of HEDGES) {
    for (const [a, b] of splitRuns(h, { maxLen: HEDGE_RUN })) add('wall', { wall: 'hedge', a, b, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2 });
  }
  for (const t of plan.trees) {
    const size = TOY.tree * between(0.88, 1.1);
    add('tree', { x: t.x, z: t.z, species: t.kind, size, seed: Math.floor(rnd() * 1e6), solid: SOLID.tree, area: 'cemetery' });
  }
  for (const p of plan.plots) {
    const size = TOY.grave * (1 + (p.variant % 7) * 0.045);
    add('grave', { x: p.x, z: p.z, variant: p.variant, size, solid: SOLID.grave * size });
  }
  plan.notable.forEach((n, index) => add('notable-grave', { x: n.x, z: n.z, name: n.name, index, tall: TALL_GRAVES.test(n.name), solid: SOLID.notable }));
  for (const [x, z] of plan.benches) {
    if (plan.clear(x, z, 0) && pathDistance(x, z) > 0.1) add('bench', { x, z, solid: SOLID.bench }); // not on the widened paths
  }
  for (const [x, z] of plan.lamps) add('lamp', { x, z, solid: SOLID.lamp });
  for (const f of OSM.fountains) {
    const [x, z] = toUnits(f);
    add('tap', { x, z, solid: SOLID.tap });
  }
  // crows on the lawns and squirrels under the trees (every third one), just south of random trees
  const r = rng(77);
  for (let k = 0; k < CRITTER_TRIES; k++) {
    const t = plan.trees[Math.floor(r() * plan.trees.length)];
    const x = t.x + (r() - 0.5) * 4;
    const z = t.z + 1.5 + r() * 1.5;
    if (!insideCemetery(x, z) || pathDistance(x, z) < 0) continue;
    add('critter', { x, z, species: k % 3 === 0 ? 'squirrel' : 'crow' });
  }
}

/** A pair of gate posts at each gate in a wall, set along the wall. */
function gatePosts() {
  const posts = [];
  for (const [gx, gz] of GATES) {
    let best = null;
    for (const w of WALLS) {
      for (let i = 0; i < w.length - 1; i++) {
        const d = segmentDistance(gx, gz, w[i], w[i + 1]);
        if (!best || d < best.d) best = { d, a: w[i], b: w[i + 1] };
      }
    }
    if (!best || best.d > 2) continue; // a gate in a fence, not a wall
    const L = Math.hypot(best.b[0] - best.a[0], best.b[1] - best.a[1]);
    const ux = (best.b[0] - best.a[0]) / L;
    const uz = (best.b[1] - best.a[1]) / L;
    for (const side of [-1, 1]) posts.push([gx + ux * side * GATE_POST_OFFSET, gz + uz * side * GATE_POST_OFFSET]);
  }
  return posts;
}
