/**
 * Where the walker may go: the map's part of collision. core/colliders.js adds the small round things (trees, graves,
 * benches) on top.
 *
 * Rules: stay inside the play region, keep out of buildings and water, cross the cemetery walls only at the gates and
 * path openings, and walk round hedges, the chapel and the sheds. Everything else (streets, pavements, parks, lawns
 * between graves) is open ground.
 */
import { inPolygon } from './math.js';
import { inRegion, buildingAt, inWater } from './neighbourhood.js';
import { wallBlocks, hedgeBlocks, CHAPEL, SHEDS } from './cemetery.js';

/** How far the walker keeps from a building's wall (units). */
const BUILDING_CLEARANCE = 0.3;

export const walkable = (x, z) => inRegion(x, z) && !buildingAt(x, z, BUILDING_CLEARANCE) && !inWater(x, z);

const inCemeteryBuilding = (x, z) => inPolygon(x, z, CHAPEL) || SHEDS.some((pts) => inPolygon(x, z, pts));

export const blocksWalker = (x, z) => !walkable(x, z) || wallBlocks(x, z) || hedgeBlocks(x, z) || inCemeteryBuilding(x, z);
