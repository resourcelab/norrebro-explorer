/**
 * Trees as slotted paper crosses in November colours: thinned crowns so the limbs show, tall narrow poplars for
 * Poppelalléen, dark cemetery yews. Each kind is printed in 5 variants that many trees share.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import * as EX from 'papercraft/examples/countryside.js';
import { PALETTE as C } from '../settings.js';

const KINDS = {
  linden: { leaf: C.linden, h: [6.4, 7.6], w: 0.78, leaves: 16 },
  chestnut: { leaf: C.chestnut, h: [6.6, 7.8], w: 0.84, leaves: 18 },
  maple: { leaf: C.maple, h: [6, 7], w: 0.8, leaves: 15 },
  beech: { leaf: C.beech, h: [6.4, 7.4], w: 0.8, leaves: 18 },
  poplar: { leaf: C.poplar, h: [8.6, 9.8], w: 0.34, leaves: 12, canopy: 0.84 },
};
export const VARIANTS_PER_KIND = 5;

export function createTreePrints(H) {
  const cache = {};
  /** { pts, mat } for one variant of a kind, printed once. */
  return function treeVariant(kind, i) {
    const key = kind + i;
    if (cache[key]) return cache[key];
    const r = P2.rng(400 + i * 7 + kind.length * 31);
    let pts;
    let paint;
    if (kind === 'yew') {
      const h = 5.6 + r() * 1.2;
      pts = P2.roughen(EX.shape.pine(r, { w: h * 0.5, h, tiers: 4 }), r);
      paint = EX.paintPine({ leaf: C.yew, trunk: C.trunk, ink: C.ink });
    } else {
      const K = KINDS[kind];
      const canopy = K.canopy ?? 0.74;
      const h = K.h[0] + r() * (K.h[1] - K.h[0]);
      const lobes = kind === 'poplar' ? 9 : 7 + Math.floor(r() * 3);
      pts = P2.roughen(EX.shape.tree(r, { w: h * K.w, h, lobes, canopy, trunk: kind === 'poplar' ? 0.3 : 0.24 }), r);
      paint = EX.paintTree(
        { leaf: K.leaf, trunk: C.trunk, ink: C.ink },
        { trunkTop: 1 - canopy, leaves: K.leaves, branches: kind === 'poplar' ? 3 : 5, berries: 0 },
      );
    }
    cache[key] = { pts, mat: H.printed(pts, paint, { res: 0.7, cross: true }) };
    return cache[key];
  };
}
