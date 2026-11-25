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
 *   ground                    what a style prints on the ground: { outline, paths, chapel, chapelCentre }
 *   notable                   the notable graves, for "where am I?"
 */
import { inPolygon, centroid } from '../../map/math.js';
import { OUTLINE, BOUNDS, insideCemetery, wallBlocks, hedgeBlocks, wallDistance, PATHS, CHAPEL, CHAPEL_CENTRE, SHEDS } from './map.js';
import { planNotableGraves, planTrees, planPlots, planBenches, planLamps } from './plan.js';
import { describeAssistens } from './things.js';

const inBuilding = (x, z) => inPolygon(x, z, CHAPEL) || SHEDS.some((pts) => inPolygon(x, z, pts));

export const assistens = {
  id: 'assistens',
  name: 'Assistens Kirkegård',
  bounds: BOUNDS,
  inside: insideCemetery,
  edgeDistance: wallDistance,
  blocks: (x, z) => wallBlocks(x, z) || hedgeBlocks(x, z) || inBuilding(x, z),
  ground: { outline: OUTLINE, paths: PATHS, chapel: CHAPEL, chapelCentre: CHAPEL_CENTRE },

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
