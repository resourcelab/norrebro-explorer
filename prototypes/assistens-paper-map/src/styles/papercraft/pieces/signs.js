/**
 * Street signs: a Copenhagen-style white name plate (black letters) for each street that meets at a corner, on a
 * slim grey post. One card per corner; returns [pts, paint].
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { letter, textWidth } from './lettering.js';

const D = P2.draw2;
const POST_H = 2.3;
const PLATE_H = 0.38;
const PLATE_GAP = 0.08;
const TEXT = 0.22; // letter height (units)

export function cornerSign(names) {
  const widths = names.map((n) => textWidth(n, TEXT) + 0.36);
  const w = Math.max(...widths);
  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#6f7275'); // the post
    D.rect(g, -0.05, 0, 0.1, POST_H);
    names.forEach((name, i) => {
      const top = POST_H - i * (PLATE_H + PLATE_GAP);
      const pw = widths[i];
      g.fillStyle = ink('#1d1d1b'); // black rim
      D.rect(g, -pw / 2, top - PLATE_H, pw, PLATE_H, 0.05);
      g.fillStyle = ink('#fbfaf5'); // white enamel
      D.rect(g, -pw / 2 + 0.04, top - PLATE_H + 0.04, pw - 0.08, PLATE_H - 0.08, 0.03);
      letter(g, name, 0, top - PLATE_H / 2, TEXT, ink('#1d1d1b', 'print'));
    });
  }, { w: w + 0.2, h: POST_H + 0.2, res: 120, name: 'street sign' });
}
