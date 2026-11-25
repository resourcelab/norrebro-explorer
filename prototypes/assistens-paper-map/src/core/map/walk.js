/**
 * Where the walker may go: the map's part of collision. core/colliders.js adds the small round things (trees, graves,
 * benches) on top.
 *
 * Rules: stay inside the play area and on loaded tiles, keep out of buildings and water, and let the sites have their
 * say (the cemetery's walls open only at the gates and along paths; hedges, the chapel and sheds are walked round).
 * Everything else (streets, pavements, parks, lawns between graves) is open ground.
 */
import { siteBlocks } from '../sites/index.js';

/** How far the walker keeps from a building's wall (units). */
const BUILDING_CLEARANCE = 0.3;

/**
 * @param store the world store (core/world/store.js)
 * @param inRegion (x, z) -> inside the play area
 * @returns (x, z) -> true where the map stops the walker
 */
export function createWalkRules(store, inRegion) {
  return (x, z) => !inRegion(x, z) || !store.has(store.keyAt(x, z)) || store.index.buildingAt(x, z, BUILDING_CLEARANCE) !== null
    || store.index.inWater(x, z) || siteBlocks(x, z);
}
