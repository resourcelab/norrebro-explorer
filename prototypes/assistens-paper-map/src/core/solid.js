/**
 * Solid radii (units) at toy scale, by kind: how close the walker may come to a thing's centre. A style may draw a
 * thing larger or smaller; collision stays the same (core/colliders.js).
 */
import { TOY } from '../config.js';

export const SOLID = {
  tree: 0.35 * TOY.tree, grave: 0.45, notable: 0.7 * TOY.notable, bench: 0.5 * TOY.prop, lamp: 0.2 * TOY.prop,
  tap: 0.3 * TOY.prop, gatePost: 0.35, playground: 1.0 * TOY.playground, rack: 0.6 * TOY.prop, sign: 0.15, fingerpost: 0.2,
};
