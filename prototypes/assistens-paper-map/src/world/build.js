/**
 * Builds every standing piece from the plan: the cemetery, then the neighbourhood round it, then the walker.
 * Prints shared by both halves (tree variants, benches, lamps) are made once here.
 */
import { START, TOY } from '../config.js';
import { createTreePrints } from '../pieces/trees.js';
import { createPropPrints } from '../pieces/props.js';
import { createWalker } from '../pieces/walker.js';
import { createPopup } from './popup.js';
import { buildCemetery } from './build-cemetery.js';
import { buildNeighbourhood } from './build-neighbourhood.js';
import { buildWayfinding } from './build-wayfinding.js';

/**
 * @returns {{ creatures: Array<[object, string]>, riders: object[], stream: object }} the moving things (for world/life.js
 *   and world/traffic.js) and the near/far stream
 */
export function buildWorld(H, plan) {
  const popup = createPopup(H);
  const prints = { treeVariant: createTreePrints(H), props: createPropPrints(H) };

  const creatures = buildCemetery(H, popup, plan, prints);
  const riders = buildNeighbourhood(H, popup, plan, prints);
  buildWayfinding(H, popup, plan);

  // the walker: a small 3D paper model; the harness walks him and swings his limbs by his stride
  const doll = createWalker(H);
  const hero = popup(null, null, { node: doll, height: 3.1, x: START[0], z: START[1], sway: 0.2, scale: TOY.walker, stream: false });
  H.setHero(hero, { stride: doll.userData.stride });

  popup.stream.start();
  return { creatures, riders, stream: popup.stream };
}
