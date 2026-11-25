/**
 * Landmark pieces, drawn a bit taller than life (TOY.landmark) so you can see and steer by them from far:
 *   - a church: a red-brick nave folded on its real footprint, and a tower with a green copper spire (towers are
 *     placed at the street end of the church; their exact spot and height are generic, not surveyed)
 *   - a flag: a tall pole with a pennant, marking a park or a square
 *   - a fingerpost: arms pointing to places beyond the walkable area, with the distance
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { prismFold } from 'papercraft/lib/paperkit-3d.js';
import { TOY } from '../../../config.js';
import { foldableFootprint } from './buildings.js';
import { letter, textWidth } from './lettering.js';

const D = P2.draw2;
const BRICK = '#a9503a';
const COPPER = '#6f9a86';
const SLATE = '#5d5a58';

/** True-ish heights in units, before TOY.landmark: walls 12 m, tower 32 m, spire 22 m. */
const NAVE_WALL = 2.4;
const NAVE_ROOF = 1.6;
const TOWER_SIDE = 1.7;
const TOWER_H = 6.4;
const SPIRE_H = 4.4;

const brickPaint = (P) => {
  const { box } = P;
  P.gradient(P2.shade(BRICK, 0.08), P2.shade(BRICK, -0.12), 0.4);
  P.marks('brick', { color: P2.shade(BRICK, -0.45), alpha: 0.3, size: 0.12, units: true });
  // tall arched windows along the wall
  P.draw((g) => {
    const n = Math.max(1, Math.round(box.w / 1.1));
    g.fillStyle = '#2f3a44';
    for (let i = 0; i < n; i++) {
      const x = box.x0 + (i + 0.5) * (box.w / n);
      const w = Math.min(0.34, (box.w / n) * 0.45);
      const y0 = box.y0 + box.h * 0.22;
      const y1 = box.y0 + box.h * 0.72;
      g.beginPath();
      g.moveTo(x - w / 2, y0);
      g.lineTo(x - w / 2, y1);
      g.arc(x, y1, w / 2, Math.PI, 0, true);
      g.lineTo(x + w / 2, y0);
      g.closePath();
      g.fill();
    }
  });
  P.innerShade(P2.shade(BRICK, -0.6), { alpha: 0.25, blurPx: 8 });
};
const roofPaint = (col) => (P) => {
  P.gradient(P2.shade(col, 0.12), P2.shade(col, -0.12), 0.5);
  P.marks('scallop', { color: P2.shade(col, -0.35), alpha: 0.4, size: 0.2, units: true });
};

/** The nave and the tower of a church: returns both hinges. */
export function church(H, popup, c) {
  const k = TOY.landmark;
  const pts = foldableFootprint(c.pts);
  const [p0, p1] = pts;
  const x = (p0[0] + p1[0]) / 2;
  const z = (p0[1] + p1[1]) / 2;
  const nave = prismFold(pts, {
    h: NAVE_WALL * k, roof: 'pyramid', roofH: NAVE_ROOF * k, paints: { wall: brickPaint, roof: roofPaint(SLATE) },
    paper: H.paper, seed: 500 + c.id.length, print: H.cardOpts(x, z, 1, null, 0.6),
  });
  const naveHinge = popup(null, null, { node: nave, height: (NAVE_WALL + NAVE_ROOF) * k, x, z, yaw: Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]), level: true });

  const s = TOWER_SIDE / 2;
  const [tx, tz] = c.tower;
  const tower = prismFold([[-s, s], [s, s], [s, -s], [-s, -s]], {
    h: TOWER_H * k, roof: 'pyramid', roofH: SPIRE_H * k, paints: { wall: brickPaint, roof: roofPaint(COPPER) },
    paper: H.paper, seed: 600 + c.id.length, print: H.cardOpts(tx, tz, 1, null, 0.7),
  });
  const towerHinge = popup(null, null, { node: tower, height: (TOWER_H + SPIRE_H) * k, x: tx, z: tz + s, yaw: 0, level: true, solid: s });
  return [naveHinge, towerHinge];
}

/** A tall flag on a pole: [pts, paint]. About 7 units tall, so it shows over the roofs. */
export const flag = (color) => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#e9e2d0'); // the pole, with a ball on top
  D.rect(g, -0.07, 0, 0.14, 6.6);
  D.ell(g, 0, 6.7, 0.16, 0.16);
  g.fillStyle = ink(color); // the pennant, with a swallowtail
  D.poly(g, [[0.05, 6.5], [2.4, 6.15], [1.9, 5.8], [2.4, 5.45], [0.05, 5.1]]);
  g.fillStyle = ink('#fbfaf5', 'print');
  D.ell(g, 0.7, 5.8, 0.22, 0.22);
}, { w: 5.2, h: 6.95, res: 80, name: 'flag' });

/**
 * A fingerpost with one arm per far place: { label, dx } (dx < 0 points the arm left). Text on the arm like
 * "Søerne 700 m". [pts, paint].
 */
export function fingerpost(arms) {
  const TEXT = 0.26;
  const ARM_H = 0.44;
  const widths = arms.map((a) => textWidth(a.label, TEXT) + 0.6);
  const reach = Math.max(...widths);
  const top = 2.6;
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#7a5a3c'); // the wooden post
    D.rect(g, -0.08, 0, 0.16, top + 0.2);
    arms.forEach((a, i) => {
      const y = top - i * (ARM_H + 0.12);
      const w = widths[i];
      const dir = a.dx < 0 ? -1 : 1;
      const x0 = dir > 0 ? -0.1 : 0.1;
      const x1 = x0 + dir * w;
      const tip = x1 + dir * 0.3;
      g.fillStyle = ink('#f1e4c4'); // the arm, pointed at the far end
      D.poly(g, [[x0, y], [x1, y], [tip, y - ARM_H / 2], [x1, y - ARM_H], [x0, y - ARM_H]]);
      letter(g, a.label, (x0 + x1) / 2, y - ARM_H / 2, TEXT, ink('#3a2a1c', 'print'));
    });
  }, { w: 2 * (reach + 0.5), h: top + 0.35, res: 110, name: 'fingerpost' });
}
