/**
 * Where the walker may go. The harness asks `blocksWalker(x, z)` for every step; true stops him.
 *
 * Rules: stay inside the play region, keep out of buildings and water, and cross the cemetery walls only at the gates
 * and path openings. Everything else (streets, pavements, parks, lawns between graves) is open ground; the pieces
 * standing on it (trees, graves, benches, playground kit) add their own small solid circles through popup's `solid`.
 */
import { inRegion, buildingAt, inWater } from './neighbourhood.js';
import { wallBlocks } from './cemetery.js';

/** How far the walker keeps from a building's wall (units). */
const BUILDING_CLEARANCE = 0.3;

export const walkable = (x, z) => inRegion(x, z) && !buildingAt(x, z, BUILDING_CLEARANCE) && !inWater(x, z);

export const blocksWalker = (x, z) => !walkable(x, z) || wallBlocks(x, z);
