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
  bin: 0.3 * P, picnic: 1.0 * P, busStop: 0.5, light: 0.12, flagpole: 0.12, goal: 0.35, hoop: 0.2, table: 0.6, ramp: 0.9,
  /** Play equipment by kind: roughly half its footprint, so you walk between the pieces, not through them. */
  kit: { swings: 1.2, basketswing: 1.1, slide: 1.1, climber: 1.0, sandpit: 0.0, springy: 0.25, seesaw: 0.7, roundabout: 0.6, playhouse: 0.6 },
};
