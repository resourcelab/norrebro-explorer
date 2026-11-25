/**
 * The world as a list of THINGS: everything that stands on the map, described by what it is, never by how it looks.
 * This list is the contract between the game core and the styles: a style gets it once and decides how each kind
 * looks (a paper card, a pixel sprite, a flat icon). Every thing is plain data:
 *
 *   { id, kind, x, z, solid?, always?, ...fields of its kind }
 *
 *   id      stable string ('tree-12'), used to say it has come near or gone far
 *   x, z    where it stands (world units; x east, z south). Long things (wall runs) also give a and b.
 *   solid   radius (units) the walker cannot enter, or absent. core/colliders.js builds collision from it.
 *   always  true for landmarks: always "near", so a style keeps them standing to steer by
 *
 * Kinds and their fields:
 *   chapel        pts (footprint), yaw                   shed         pts
 *   wall          a, b, wall: 'wall' | 'hedge'           gate-post    -
 *   tree          species, size (scale), seed            grave        variant, size
 *   notable-grave name, index, tall                       bench, lamp, tap
 *   critter       species: 'crow' | 'squirrel'           block        pts, levels, buildingId
 *   playground    equipment: swings | slide | climber | seesaw
 *   bike-rack     -                                      corner-sign  names
 *   fingerpost    arms: [{ name, dx, metres }]          flag         name, color
 *   church        name, pts, tower: [x, z]
 * Cyclists move, so they are not things: core/traffic.js keeps them in the game state.
 *
 * Sizes are TOY scale (config.js): what a style draws should honour them, so every style reads the same way.
 */
import { TOY } from '../config.js';
import { OSM } from '../data/assistens-osm.js';
import { toUnits } from './map/units.js';
import { segmentDistance, splitRuns } from './map/math.js';
import { insideCemetery, pathDistance, WALLS, HEDGES, GATES, openingTestFor, CHAPEL, CHAPEL_CENTRE, CHAPEL_YAW, SHEDS } from './map/cemetery.js';
import { BUILDINGS } from './map/neighbourhood.js';
import { CHURCHES, FLAGS } from './map/landmarks.js';
import { rng } from './random.js';

/** Every kind of thing; a style should know how to draw each (tests/core.test.mjs checks the list stays honest). */
export const KINDS = [
  'chapel', 'shed', 'wall', 'gate-post', 'tree', 'grave', 'notable-grave', 'bench', 'lamp', 'tap', 'critter', 'block',
  'playground', 'bike-rack', 'church', 'flag', 'corner-sign', 'fingerpost',
];

/** Graves that get the tall stele. */
const TALL_GRAVES = /Andersen|Kierkegaard|Bohr|Ørsted/;
const WALL_RUN = 5; // units: walls are cut into straight runs no longer than this
const HEDGE_RUN = 4;
const GATE_POST_OFFSET = 1.55; // units either side of a gate's centre
const CRITTER_TRIES = 26;

/** Solid radii (units) at toy scale, by kind. A style may draw larger or smaller; collision stays the same. */
const SOLID = {
  tree: 0.35 * TOY.tree, grave: 0.45, notable: 0.7 * TOY.notable, bench: 0.5 * TOY.prop, lamp: 0.2 * TOY.prop,
  tap: 0.3 * TOY.prop, gatePost: 0.35, playground: 1.0 * TOY.playground, rack: 0.6 * TOY.prop, sign: 0.15, fingerpost: 0.2,
};

/** @returns {object[]} the things, in a fixed order (the same list on every load) */
export function describeWorld(plan) {
  const { rnd } = plan;
  const between = (a, b) => a + rnd() * (b - a);
  const things = [];
  const counters = {};
  const add = (kind, fields) => {
    counters[kind] = (counters[kind] ?? 0) + 1;
    const thing = { id: `${kind}-${counters[kind]}`, kind, ...fields };
    things.push(thing);
    return thing;
  };

  // ---- the cemetery ----
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

  // ---- the neighbourhood ----
  for (const b of BUILDINGS) {
    if (!b.raised) continue;
    const [x0, z0, x1, z1] = b.box;
    add('block', { x: (x0 + x1) / 2, z: (z0 + z1) / 2, pts: b.pts, levels: b.levels, buildingId: b.id });
  }
  for (const t of plan.streetTrees) {
    const size = TOY.tree * between(0.85, 1.05);
    add('tree', { x: t.x, z: t.z, species: t.kind, size, seed: Math.floor(rnd() * 1e6), solid: SOLID.tree, area: 'street' });
  }
  for (const e of plan.playgroundKit) add('playground', { x: e.x, z: e.z, equipment: e.kind, solid: SOLID.playground });
  for (const [x, z] of plan.racks) add('bike-rack', { x, z, solid: SOLID.rack });
  for (const [x, z] of plan.streetBenches) add('bench', { x, z, solid: SOLID.bench });

  // ---- wayfinding ----
  for (const c of CHURCHES) add('church', { x: c.centre[0], z: c.centre[1], name: c.name, pts: c.pts, tower: c.tower, always: true, landmarkId: c.id });
  for (const f of FLAGS) add('flag', { x: f.at[0], z: f.at[1], name: f.name, color: f.color, always: true });
  for (const s of plan.cornerSigns) add('corner-sign', { x: s.x, z: s.z, names: s.names, solid: SOLID.sign });
  for (const p of plan.fingerposts) add('fingerpost', { x: p.x, z: p.z, arms: p.arms, solid: SOLID.fingerpost });

  return things;
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
