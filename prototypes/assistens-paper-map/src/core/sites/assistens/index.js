/**
 * Assistens Kirkegård as a SITE: a place with its own, more detailed plan than the world tiles carry (wall runs with
 * gates, path kinds, the notable graves, the chapel), laid over the tiles it covers.
 *
 * A site answers the same questions every site does (core/sites/index.js):
 *   id, name, bounds          where it is (units)
 *   inside(x, z)              is this point in the site?
 *   edgeDistance(x, z)        how far to its walls (units): the neighbourhood keeps its trees and signs clear of them
 *   blocks(x, z)              does the site stop the walker here (walls, hedges, the chapel, sheds)?
 *   plan(keep)                where everything stands (positions), planned once, seeded
 *   things(plan, rnd)         the plan as things (core/world.js lists the kinds)
 *   ground                    what a style draws on the ground, as plain layers any style can draw without knowing
 *                             the site (see GROUND below)
 */
import { inPolygon, centroid } from '../../map/math.js';
import { OUTLINE, BOUNDS, insideCemetery, wallBlocks, hedgeBlocks, wallDistance, PATHS, CHAPEL, CHAPEL_CENTRE, SHEDS } from './map.js';
import { planNotableGraves, planTrees, planPlots, planBenches, planLamps } from './plan.js';
import { describeAssistens } from './things.js';

const inBuilding = (x, z) => inPolygon(x, z, CHAPEL) || SHEDS.some((pts) => inPolygon(x, z, pts));

const PATH_KIND = { c: 'cycleway', f: 'footway', p: 'path', s: 'service' };
const [ccx, ccz] = CHAPEL_CENTRE;

/**
 * The site's ground as plain layers (units), the same shapes the tiles give, so a style draws a site the way it draws
 * the rest of the map:
 *   areas  [{ kind, pts }]                     kind: 'cemetery' (the lawn inside the walls), 'forecourt'
 *   paths  [{ kind, surface, half, pts }]      kind: footway | cycleway | path | service; surface: asphalt | gravel
 * A style may print a site more richly (papercraft adds plot beds and fallen leaves from the site's plan), but needs
 * nothing beyond these layers to draw it.
 */
const GROUND = {
  areas: [
    { kind: 'cemetery', pts: OUTLINE },
    { kind: 'forecourt', pts: CHAPEL.map(([x, z]) => [ccx + (x - ccx) * 1.35, ccz + (z - ccz) * 1.35]) },
  ],
  paths: PATHS.map((p) => ({ kind: PATH_KIND[p.kind[0]] ?? 'path', surface: p.asphalt ? 'asphalt' : 'gravel', half: p.half, pts: p.pts })),
};

export const assistens = {
  id: 'assistens',
  name: 'Assistens Kirkegård',
  bounds: BOUNDS,
  inside: insideCemetery,
  edgeDistance: wallDistance,
  blocks: (x, z) => wallBlocks(x, z) || hedgeBlocks(x, z) || inBuilding(x, z),
  ground: GROUND,

  /** @param keep the shared keep-out zones (core/plan/keep-out.js); @param rnd the site's random stream */
  plan(keep, rnd) {
    // nothing may crowd the chapel or the sheds
    keep.add(CHAPEL_CENTRE[0], CHAPEL_CENTRE[1], 4.6);
    for (const pts of SHEDS) keep.add(...centroid(pts), 1.6);
    const notable = planNotableGraves(keep);
    const trees = planTrees(keep, rnd);
    const plots = planPlots(keep);
    const benches = planBenches();
    const lamps = planLamps(keep);
    return { notable, trees, plots, benches, lamps, clear: keep.clear };
  },
  things: describeAssistens,
};
