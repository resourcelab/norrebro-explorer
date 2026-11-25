/**
 * Builds the neighbourhood round the walls from the plan: apartment blocks on their real footprints, street trees,
 * playground equipment, bike racks, pavement benches and the cyclists.
 */
import { TOY } from '../config.js';
import { BUILDINGS } from '../map/neighbourhood.js';
import { polylineLengths } from '../map/math.js';
import { VARIANTS_PER_KIND } from '../pieces/trees.js';
import { apartmentBlock } from '../pieces/buildings.js';
import { PLAYGROUND } from '../pieces/playground.js';
import { bikeRack, cyclist } from '../pieces/street.js';
import { printOnce } from './popup.js';

const RIDER_VARIANTS = 5;

/**
 * @param {object} H the harness
 * @param {Function} popup from world/popup.js
 * @param {object} plan from plan/index.js
 * @param {{ treeVariant: Function, props: object }} prints shared printed pieces (see world/build.js)
 * @returns {object[]} the cyclists, for world/traffic.js
 */
export function buildNeighbourhood(H, popup, plan, { treeVariant, props }) {
  const { rnd } = plan;
  const between = (a, b) => a + rnd() * (b - a);

  // everything out here is built the first time the walker comes near (popup.lazy), so the load stays quick;
  // choices that use the plan's random stream are made now, so the neighbourhood is the same on every visit
  for (const b of BUILDINGS) {
    if (!b.raised) continue;
    const [x0, z0, x1, z1] = b.box;
    popup.lazy((x0 + x1) / 2, (z0 + z1) / 2, () => apartmentBlock(H, popup, b), { node: true });
  }

  for (const t of plan.streetTrees) {
    const v = treeVariant(t.kind, Math.floor(rnd() * VARIANTS_PER_KIND));
    const scale = TOY.tree * between(0.85, 1.05);
    popup.lazy(t.x, t.z, () => popup(v.pts, null, { x: t.x, z: t.z, cross: true, materials: v.mat, sway: 0.5, scale, solid: 0.35 }));
  }

  const kit = Object.fromEntries(Object.entries(PLAYGROUND).map(([kind, make]) => [kind, printOnce(H, make())]));
  for (const e of plan.playgroundKit) {
    popup.lazy(e.x, e.z, () => popup(kit[e.kind].pts, null, { x: e.x, z: e.z, materials: kit[e.kind].mat, scale: TOY.playground, solid: 1.0 }));
  }

  const rack = printOnce(H, bikeRack());
  for (const [x, z] of plan.racks) {
    popup.lazy(x, z, () => popup(rack.pts, null, { x, z, materials: rack.mat, scale: TOY.prop, solid: 0.6 }));
  }
  for (const [x, z] of plan.streetBenches) {
    popup.lazy(x, z, () => popup(props.bench.pts, null, { x, z, materials: props.bench.mat, scale: TOY.prop, solid: 0.5 }));
  }

  return buildRiders(H, popup, plan);
}

/**
 * One cyclist on every other mapped stretch of the cycle streets (so they don't crowd), sharing a few printed riders.
 * Each rider: { hinge, route, lengths, total, s (distance along), dir (+1 / -1), speed (units/s) }.
 */
function buildRiders(H, popup, plan) {
  const { rnd } = plan;
  const prints = Array.from({ length: RIDER_VARIANTS }, (_, k) => printOnce(H, cyclist(k + 3)));
  const riders = [];
  plan.cycleRoutes.forEach((route, k) => {
    if (k % 2) return;
    const { pts, mat } = prints[k % prints.length];
    const lengths = polylineLengths(route.pts);
    const total = lengths.reduce((a, b) => a + b, 0);
    if (total < 1) return;
    const [x, z] = route.pts[0];
    riders.push({
      hinge: popup(pts, null, { x, z, materials: mat, scale: TOY.cyclist, stream: false }),
      route: route.pts, lengths, total,
      s: rnd() * Math.min(10, total), dir: k % 4 ? 1 : -1, speed: 3.2 + rnd() * 1.6,
    });
  });
  return riders;
}
