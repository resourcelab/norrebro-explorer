/**
 * The placement plan: where everything stands, decided before anything is built, so the printed ground can put plot
 * beds, sandpits and leaf litter under the pieces that will stand on them.
 *
 * Seeded: the same plan on every load. The order of the calls matters (they share one random stream and the
 * keep-out zones), so add new steps at the end.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { START } from '../config.js';
import { FAR } from '../map/landmarks.js';
import { centroid } from '../map/math.js';
import { CHAPEL_CENTRE, SHEDS } from '../map/cemetery.js';
import { createKeepOut } from './keep-out.js';
import { planNotableGraves, planTrees, planPlots, planBenches, planLamps } from './cemetery.js';
import {
  planStreetTrees, planPlaygrounds, planPlaygroundKit, planStreetFurniture, planCycleRoutes, planCornerSigns, planFingerposts,
} from './neighbourhood.js';

/**
 * @returns {{
 *   rnd: () => number, clear: (x: number, z: number, r: number) => boolean,
 *   notable: {x: number, z: number, name: string}[], trees: {x: number, z: number, kind: string}[],
 *   plots: {x: number, z: number, variant: number}[], benches: number[][], lamps: number[][],
 *   streetTrees: {x: number, z: number, kind: string}[], playgrounds: {pts: number[][], sandpit: boolean}[],
 *   playgroundKit: {x: number, z: number, kind: string}[], racks: number[][], streetBenches: number[][],
 *   cycleRoutes: {name: string, pts: number[][]}[], cornerSigns: {x: number, z: number, names: string[]}[],
 *   fingerposts: {x: number, z: number, arms: {name: string, dx: number, metres: number}[]}[],
 * }}
 */
export function planWorld() {
  const rnd = P2.rng(5);
  const keep = createKeepOut();

  // nothing may crowd the chapel, the walker's start or the sheds
  keep.add(CHAPEL_CENTRE[0], CHAPEL_CENTRE[1], 4.6);
  keep.add(START[0], START[1], 2.6);
  for (const pts of SHEDS) keep.add(...centroid(pts), 1.6);

  // inside the walls
  const notable = planNotableGraves(keep);
  const trees = planTrees(keep, rnd);
  const plots = planPlots(keep);
  const benches = planBenches();
  const lamps = planLamps(keep);

  // outside the walls
  const streetTrees = planStreetTrees(rnd);
  const playgrounds = planPlaygrounds();
  const playgroundKit = planPlaygroundKit(playgrounds, rnd);
  const { racks, benches: streetBenches } = planStreetFurniture();
  const cycleRoutes = planCycleRoutes();

  // wayfinding
  const cornerSigns = planCornerSigns();
  const fingerposts = planFingerposts(FAR, START);

  return {
    rnd, clear: keep.clear, notable, trees, plots, benches, lamps,
    streetTrees, playgrounds, playgroundKit, racks, streetBenches, cycleRoutes, cornerSigns, fingerposts,
  };
}
