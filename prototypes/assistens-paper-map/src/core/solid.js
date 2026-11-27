/**
 * Solid radii (units), by kind: how close the walker's centre may come to a thing's centre (plus his own radius,
 * WALK.radius). Sized from the toy heights (config.js TOY): a trunk, a headstone, a bench's length. A style may draw a
 * thing larger or smaller; collision stays the same (core/colliders.js).
 */
import { SCALE, TOY } from '../config.js';

const P = TOY.person * SCALE; // a metre of something people use, in units
export const SOLID = {
  tree: 0.25, // the trunk and the root plate
  grave: 0.55 * P, bench: 0.9 * P, lamp: 0.15, tap: 0.3 * P, rack: 1.0 * P, sign: 0.12, fingerpost: 0.15,
  notable: 0.8 * P, gatePost: 0.3, playground: 1.6 * P,
};
