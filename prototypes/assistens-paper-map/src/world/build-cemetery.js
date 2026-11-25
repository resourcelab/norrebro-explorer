/**
 * Builds the cemetery from the plan: the chapel, sheds, the yellow wall with its gate posts, hedges, trees, grave
 * plots, notable graves, benches, lamps, water taps, and the crows and squirrels.
 * Every piece stands on a hinge and folds up from the page when the scene starts.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { OSM } from '../data/assistens-osm.js';
import { PALETTE as C } from '../config.js';
import { toUnits } from '../map/units.js';
import { segmentDistance } from '../map/math.js';
import { insideCemetery, pathDistance, WALLS, GATES, openingTestFor, CHAPEL_CENTRE, CHAPEL_YAW, SHEDS } from '../map/cemetery.js';
import { VARIANTS_PER_KIND } from '../pieces/trees.js';
import { createPlotPrints, notableGrave } from '../pieces/graves.js';
import { wallPaint, lidPaint, hedgePaint, splitRuns, placeRun, gatePost } from '../pieces/walls.js';
import { chapelFold } from '../pieces/chapel.js';
import { shed } from '../pieces/props.js';
import { crow, squirrel } from '../pieces/critters.js';

/** Graves that get the tall stele. */
const TALL_GRAVES = /Andersen|Kierkegaard|Bohr|Ørsted/;
const WALL = { h: 1.75, t: 0.5, maxRun: 5 };
const HEDGE = { h: 0.75, t: 0.6, maxRun: 4 };
const GATE_POST_OFFSET = 1.55; // units either side of a gate's centre
const CRITTER_TRIES = 26;

/**
 * @param {object} H the harness
 * @param {Function} popup from world/popup.js
 * @param {object} plan from plan/index.js
 * @param {{ treeVariant: Function, props: object }} prints shared printed pieces (see world/build.js)
 * @returns {Array<[hinge, 'peck' | 'shy']>} the critters, for world/life.js
 */
export function buildCemetery(H, popup, plan, { treeVariant, props }) {
  const { rnd } = plan;
  const between = (a, b) => a + rnd() * (b - a);

  // the chapel by the Kapelvej gate, turned to its real footprint
  popup(null, null, { node: chapelFold(H), height: 6.2, x: CHAPEL_CENTRE[0], z: CHAPEL_CENTRE[1], yaw: CHAPEL_YAW, level: true, solid: 3.2 });
  H.spots.chapel = CHAPEL_CENTRE;

  // sheds and service buildings on their mapped footprints
  for (const pts of SHEDS) shed(H, popup, pts);

  // the yellow wall, cut into short straight runs and left open at the gates and where paths pass
  WALLS.forEach((w, i) => {
    for (const run of splitRuns(w, { maxLen: WALL.maxRun, gap: openingTestFor(i) })) {
      placeRun(H, popup, run, { h: WALL.h, t: WALL.t, wall: wallPaint, lid: lidPaint(P2.shade(C.wall, -0.08)) });
    }
  });
  buildGatePosts(H, popup);

  // clipped hedges
  for (const hedge of OSM.hedges) {
    for (const run of splitRuns(hedge.map(toUnits), { maxLen: HEDGE.maxRun })) {
      placeRun(H, popup, run, { h: HEDGE.h, t: HEDGE.t, wall: hedgePaint, lid: hedgePaint });
    }
  }

  // trees: slotted paper crosses sharing a few printed variants per kind
  for (const t of plan.trees) {
    const v = treeVariant(t.kind, Math.floor(rnd() * VARIANTS_PER_KIND));
    popup(v.pts, null, { x: t.x, z: t.z, cross: true, materials: v.mat, sway: t.kind === 'yew' ? 0.2 : 0.5, scale: between(0.88, 1.1), solid: 0.35 });
  }

  // ordinary grave plots, each one of the printed variants, scaled a little
  const plotPrints = createPlotPrints(H);
  for (const p of plan.plots) {
    const v = plotPrints[p.variant % plotPrints.length];
    popup(v.pts, null, { x: p.x, z: p.z, materials: v.mat, scale: 1.35 + (p.variant % 7) * 0.06, solid: 0.45 });
  }

  // notable graves: a little grander
  plan.notable.forEach((n, i) => {
    popup(...notableGrave(i, TALL_GRAVES.test(n.name)), { x: n.x, z: n.z, scale: 1.3, solid: 0.7 });
  });
  const hca = plan.notable.find((n) => n.name === 'H.C. Andersen');
  if (hca) H.spots.hca = [hca.x, hca.z];

  // benches (skipping any the widened paths now cover), lamps, water taps
  for (const [x, z] of plan.benches) {
    if (plan.clear(x, z, 0) && pathDistance(x, z) > 0.1) popup(props.bench.pts, null, { x, z, materials: props.bench.mat, solid: 0.5 });
  }
  for (const [x, z] of plan.lamps) popup(props.lamp.pts, null, { x, z, materials: props.lamp.mat, solid: 0.2 });
  for (const f of OSM.fountains) {
    const [x, z] = toUnits(f);
    popup(...props.tap, { x, z, solid: 0.3 });
  }

  return buildCritters(popup, plan);
}

/** A pair of gate posts at each gate, set along the wall the gate is in. */
function buildGatePosts(H, popup) {
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
    for (const side of [-1, 1]) gatePost(H, popup, gx + ux * side * GATE_POST_OFFSET, gz + uz * side * GATE_POST_OFFSET);
  }
}

/** Crows on the lawns and squirrels under the trees (every third one), placed just south of random trees. */
function buildCritters(popup, plan) {
  const creatures = [];
  const r = P2.rng(77);
  for (let k = 0; k < CRITTER_TRIES; k++) {
    const t = plan.trees[Math.floor(r() * plan.trees.length)];
    const x = t.x + (r() - 0.5) * 4;
    const z = t.z + 1.5 + r() * 1.5;
    if (!insideCemetery(x, z) || pathDistance(x, z) < 0) continue;
    const isSquirrel = k % 3 === 0;
    const hinge = popup(...(isSquirrel ? squirrel() : crow()), { x, z, scale: isSquirrel ? 1.1 : 1 });
    creatures.push([hinge, isSquirrel ? 'shy' : 'peck']);
  }
  return creatures;
}
