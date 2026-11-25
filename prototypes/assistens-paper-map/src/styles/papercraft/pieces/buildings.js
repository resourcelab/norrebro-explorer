/**
 * Apartment blocks folded up on their real footprints: a prism fold with printed facades (render or brick, rows of
 * windows with a few lit, a ground floor of shopfronts, sometimes an awning) and a flat tiled or slate lid.
 * Nørrebro colours: ochre, red brick, cream and grey render. Facades are generic, not likenesses.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { prismFold } from 'papercraft/lib/paperkit-3d.js';
import { convexHull, signedArea } from '../../../core/map/math.js';
import { TOY } from '../../../config.js';

const FACADES = [
  { wall: '#d9a85a', brick: false }, { wall: '#c4694a', brick: true }, { wall: '#e7dcc2', brick: false },
  { wall: '#b8b2a4', brick: false }, { wall: '#e2c27c', brick: false }, { wall: '#a9573c', brick: true },
  { wall: '#dcbaa0', brick: false }, { wall: '#cf8a5a', brick: true },
];
const ROOFS = ['#a9493a', '#5f6166', '#8a4a3a', '#6f6a64'];
const AWNINGS = ['#2f5d50', '#8a2f2a', '#c49a3a', '#2c3a5a'];

/** Height: true to life, a shop floor plus a storey per mapped level (blocks without a count get 5 or 6). */
const GROUND_FLOOR = TOY.groundFloor;
const STOREY = TOY.storey;
/** Facades are printed coarser than small pieces: they are big and usually a little out of focus. */
const FACADE_RES = 0.55;

/** A stable 0..1 hash of a string (FNV-1a), so a building gets the same colours and height on every load. */
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
const pick = (list, key) => list[Math.floor(hash(key) * list.length)];

function facadePaint({ wall, brick }, k) {
  return (P) => {
    const { box } = P;
    const shopHeight = box.h * 0.2;
    P.gradient(P2.shade(wall, 0.08), P2.shade(wall, -0.1), 0.35);
    if (brick) P.marks('brick', { color: P2.shade(wall, -0.45), alpha: 0.3, size: 0.12, units: true });
    // the upper floors: a grid of windows, a few lit
    P.marks('window', {
      region: { ...box, y1: box.y1 - shopHeight }, units: true, size: 0.37, color: '#f3e2b0', dark: '#3b4653', lit: 0.12, alpha: 1,
    });
    P.draw((g) => {
      const base = box.y0 + box.h - shopHeight;
      // the ground floor: a darker band with shop windows
      g.fillStyle = P2.shade(wall, -0.22);
      g.fillRect(box.x0 - 1, base, box.w + 2, shopHeight);
      g.fillStyle = '#2d3640';
      const shops = Math.max(1, Math.round(box.w / (box.h * 0.35)));
      for (let i = 0; i < shops; i++) {
        g.fillRect(box.x0 + (i + 0.18) * (box.w / shops), base + shopHeight * 0.14, (box.w / shops) * 0.64, shopHeight * 0.7);
      }
      // an awning on every third facade style
      if (k % 3 === 0) {
        g.fillStyle = AWNINGS[k % AWNINGS.length];
        g.fillRect(box.x0 + box.w * 0.1, base - shopHeight * 0.02, box.w * 0.35, shopHeight * 0.22);
      }
      // the cornice
      g.fillStyle = P2.shade(wall, -0.3);
      g.fillRect(box.x0 - 1, box.y0, box.w + 2, box.h * 0.04);
    });
    P.innerShade(P2.shade(wall, -0.6), { alpha: 0.22, blurPx: 8 });
  };
}

const roofPaint = (col) => (P) => {
  P.gradient(P2.shade(col, 0.1), P2.shade(col, -0.12), 0.5);
  P.marks('scallop', { color: P2.shade(col, -0.35), alpha: 0.45, size: 0.18, units: true });
};

const FACADE_PAINTS = FACADES.map((f, k) => facadePaint(f, k));
const ROOF_PAINTS = ROOFS.map(roofPaint);

/**
 * The footprint a block is folded on: its convex hull (prismFold cannot fold courtyards, and a concave outline folds
 * with walls facing inwards), wound behind its first edge, near-duplicate corners dropped, the longest edge first so
 * it becomes the front.
 */
export function foldableFootprint(pts) {
  let hull = convexHull(pts);
  if (signedArea(hull) > 0) hull.reverse();
  hull = hull.filter((p, i) => {
    const q = hull[(i + 1) % hull.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.25;
  });
  let front = 0;
  let frontLength = 0;
  hull.forEach((p, i) => {
    const q = hull[(i + 1) % hull.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L > frontLength) { frontLength = L; front = i; }
  });
  return hull.slice(front).concat(hull.slice(0, front));
}

/**
 * One apartment block standing on its footprint.
 * @param b a building from map/neighbourhood.js BUILDINGS ({ id, pts, levels })
 * @returns the hinge, or null when the footprint is degenerate
 */
export function apartmentBlock(H, popup, b) {
  const pts = foldableFootprint(b.pts);
  if (pts.length < 3) return null;
  // prismFold builds the shape behind its first edge; the piece is placed at that edge's midpoint, turned along it
  const [p0, p1] = pts;
  const x = (p0[0] + p1[0]) / 2;
  const z = (p0[1] + p1[1]) / 2;
  const yaw = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]);
  const levels = b.levels || 5 + Math.floor(hash(b.id) * 2);
  const h = GROUND_FLOOR + levels * STOREY;
  const node = prismFold(pts, {
    h, roof: 'flat', paints: { wall: pick(FACADE_PAINTS, b.id + 'f'), roof: pick(ROOF_PAINTS, b.id + 'r') },
    paper: H.paper, seed: Math.floor(hash(b.id) * 1000), print: H.cardOpts(x, z, 1, null, FACADE_RES),
  });
  return popup(null, null, { node, height: h, x, z, yaw, level: true });
}
