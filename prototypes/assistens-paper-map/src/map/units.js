/**
 * Map metres -> world units. Both data files (assistens-osm.js and surroundings.js) store metres from the cemetery
 * centroid (55.690776 N, 12.550529 E) with x east and y SOUTH; the world uses the same axes scaled by SCALE.
 */
import { SCALE } from '../config.js';

/** [x, y] in metres -> [x, z] in world units. */
export const toUnits = ([x, y]) => [x * SCALE, y * SCALE];
