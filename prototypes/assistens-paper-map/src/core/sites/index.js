/**
 * Sites: places with a hand-kept plan in more detail than the world tiles (see sites/assistens/index.js for what a
 * site provides). The tiles give every street, block and park; a site adds what OpenStreetMap's general data can't
 * say on its own (where the gates are, which graves are famous). Most of Nørrebro needs no site at all.
 *
 * To add one: a folder here with the same shape as assistens/, its data in src/data/sites/, and a line in SITES.
 */
import { assistens } from './assistens/index.js';

export const SITES = [assistens];

/** The site at (x, z), or null. */
export const siteAt = (x, z) => SITES.find((s) => s.inside(x, z)) ?? null;
/** True when a footprint lies wholly inside a site (the site draws it itself). */
export const insideSite = (pts) => SITES.some((s) => pts.every(([x, z]) => s.inside(x, z)));
/** Distance (units) to the nearest site edge, capped. */
export const siteEdgeDistance = (x, z, cap = 10) => {
  let d = cap;
  for (const s of SITES) {
    const { x0, z0, x1, z1 } = s.bounds;
    if (x < x0 - cap || x > x1 + cap || z < z0 - cap || z > z1 + cap) continue;
    d = Math.min(d, s.edgeDistance(x, z));
  }
  return d;
};
/** True where any site stops the walker. */
export const siteBlocks = (x, z) => SITES.some((s) => {
  const { x0, z0, x1, z1 } = s.bounds;
  return x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2 && s.blocks(x, z);
});
