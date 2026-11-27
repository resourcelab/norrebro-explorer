/**
 * Shopfronts: a card on a block's ground floor, as wide as the shop and as tall as the shop floor (TOY.groundFloor),
 * with a lit shop window, a door, an awning in its group's colour and the shop's name on the fascia above. Returns
 * [pts, paint] for popup; build.js stands it on the block's folded facade, facing the street.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { letter, textWidth } from './lettering.js';
import { convexHull, segmentDistance } from '../../../core/map/math.js';

const D = P2.draw2;
/** Awning and fascia colours by group: food warm, shops teal, everyday blue, culture plum. */
const GROUP = {
  food: { awning: '#b8432f', stripe: '#f3e2c4', fascia: '#3a2a22' },
  shop: { awning: '#2f6b62', stripe: '#e9efe2', fascia: '#1f2f33' },
  everyday: { awning: '#2f4f7a', stripe: '#e6ecf4', fascia: '#1e2a3a' },
  culture: { awning: '#6b3f6e', stripe: '#f0e4ef', fascia: '#2a1f2c' },
};
const MAX_TEXT = 0.24; // letter height on the fascia (units, 1.2 m: big, like a real shop's lettering)

/** @param f a shopfront thing (core/world.js): name, group, a, b, height */
export function shopfront(f) {
  const w = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const h = f.height;
  const c = GROUP[f.group] ?? GROUP.shop;
  const text = Math.min(MAX_TEXT, (w * 0.9) / Math.max(0.01, textWidth(f.name, 1)));
  const fasciaH = Math.max(0.24, text * 1.35);
  return P2.drawnPiece((g, ink) => {
    const x0 = -w / 2;
    // the shop window (warm light inside) and the door
    const sill = 0.08;
    const top = h - fasciaH - 0.14;
    g.fillStyle = ink('#2b2724');
    D.rect(g, x0, 0, w, top + 0.04);
    g.fillStyle = ink('#f1c87a', 'print');
    D.rect(g, x0 + 0.06, sill, w * 0.62, top - sill - 0.04);
    g.fillStyle = ink('#e9b765', 'print');
    D.rect(g, x0 + 0.06, sill, w * 0.62, (top - sill) * 0.25);
    g.fillStyle = ink('#4a3a2c');
    D.rect(g, x0 + w * 0.74, 0, w * 0.18, top - 0.02); // the door
    g.fillStyle = ink('#d8b26a', 'print');
    D.rect(g, x0 + w * 0.88, top * 0.45, 0.025, 0.06); // its handle
    // the awning: stripes over the window
    const stripes = Math.max(4, Math.round(w / 0.18));
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = ink(i % 2 ? c.stripe : c.awning);
      D.rect(g, x0 + (i * w) / stripes, top, w / stripes + 0.005, 0.14);
    }
    // the fascia with the name
    g.fillStyle = ink(c.fascia);
    D.rect(g, x0, h - fasciaH, w, fasciaH, 0.02);
    letter(g, f.name, 0, h - fasciaH / 2, text, ink('#f7efdc', 'print'));
  }, { w: w + 0.04, h: h + 0.04, res: 220, name: 'shopfront' }); // fine enough for the lettering
}

/**
 * Where a shopfront stands on a block as papercraft folds it: blocks fold on their convex hull (pieces/buildings.js),
 * so a front on a recessed wall of the real outline is moved out onto the hull's facade that faces the same way.
 * Returns { x, z, yaw }.
 */
export function onFoldedFacade(f) {
  if (!f.footprint) return { x: f.x, z: f.z, yaw: f.yaw };
  const hull = convexHull(f.footprint);
  const n = [Math.sin(f.yaw), Math.cos(f.yaw)];
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const e = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const m = [e[1], -e[0]];
    const cx = (a[0] + b[0]) / 2;
    const cz = (a[1] + b[1]) / 2;
    const out = (cx - f.x) * m[0] + (cz - f.z) * m[1] >= 0 ? m : [-m[0], -m[1]]; // the hull's outward side here
    if (out[0] * n[0] + out[1] * n[1] < 0.7) continue; // not the same way round
    const d = segmentDistance(f.x, f.z, a, b);
    if (best && d >= best.d) continue;
    const t = Math.max(0, Math.min(L, (f.x - a[0]) * e[0] + (f.z - a[1]) * e[1]));
    best = { d, x: a[0] + e[0] * t + out[0] * 0.03, z: a[1] + e[1] * t + out[1] * 0.03, yaw: Math.atan2(out[0], out[1]) };
  }
  return best ?? { x: f.x, z: f.z, yaw: f.yaw };
}
