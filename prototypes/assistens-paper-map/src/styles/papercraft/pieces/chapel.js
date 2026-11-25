/**
 * The cemetery chapel as a box fold: ochre walls with cream pilasters and round-arched windows, a gable with a door
 * and a round window, a red tiled roof. A generic Danish chapel, not a likeness of the real building.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { boxFold } from 'papercraft/lib/paperkit-3d.js';
import { PALETTE as C } from '../settings.js';

function front(P) {
  const { box } = P;
  P.gradient(P2.shade(C.wall, 0.12), P2.shade(C.wall, -0.06), 0.3);
  P.marks('brick', { color: P2.shade(C.wall, -0.35), alpha: 0.25, size: 0.04 });
  P.layer((g) => { // pilasters, cornice and plinth
    for (const f of [0.02, 0.32, 0.64, 0.92]) g.fillRect(box.x0 + box.w * f, box.y0, box.w * 0.06, box.h);
    g.fillRect(box.x0, box.y1 - box.h * 0.1, box.w, box.h * 0.1);
    g.fillRect(box.x0, box.y0, box.w, box.h * 0.07);
  }, C.cream, { lip: 0.8 });
  P.layer((g) => { // round-arched windows
    for (const f of [0.19, 0.48, 0.78]) {
      const cx = box.x0 + box.w * f;
      const w = box.w * 0.1;
      const y0 = box.y0 + box.h * 0.3;
      const y1 = box.y0 + box.h * 0.72;
      g.beginPath();
      g.rect(cx - w / 2, y0, w, y1 - y0);
      g.arc(cx, y1, w / 2, 0, Math.PI);
      g.fill();
    }
  }, '#3e4a52', { lip: 0.6 });
  P.draw((g) => { // glazing bars
    g.strokeStyle = P2.rgba(C.cream, 0.8);
    g.lineWidth = box.w * 0.006;
    for (const f of [0.19, 0.48, 0.78]) {
      const cx = box.x0 + box.w * f;
      g.beginPath();
      g.moveTo(cx, box.y0 + box.h * 0.3);
      g.lineTo(cx, box.y0 + box.h * 0.75);
      g.stroke();
    }
  });
  P.innerShade(P2.shade(C.wall, -0.6), { alpha: 0.25, blurPx: 10 });
}

function gable(P) {
  const { box } = P;
  const cx = (box.x0 + box.x1) / 2;
  P.gradient(P2.shade(C.wall, 0.1), P2.shade(C.wall, -0.08), 0.3);
  P.marks('brick', { color: P2.shade(C.wall, -0.35), alpha: 0.25, size: 0.05 });
  P.layer((g) => { // the arched door
    g.beginPath();
    g.rect(cx - box.w * 0.16, box.y0, box.w * 0.32, box.h * 0.36);
    g.arc(cx, box.y0 + box.h * 0.36, box.w * 0.16, 0, Math.PI);
    g.fill();
  }, '#5a3a2a', { lip: 0.7 });
  P.layer((g) => { // the round window
    g.beginPath();
    g.arc(cx, box.y0 + box.h * 0.7, box.w * 0.1, 0, 7);
    g.fill();
  }, '#3e4a52', { lip: 0.6 });
  P.layer((g) => g.fillRect(cx - box.w * 0.05, box.y0 + box.h * 0.36 + box.w * 0.16, box.w * 0.1, box.h * 0.03), C.cream, { lip: 0.6 });
  P.innerShade(P2.shade(C.wall, -0.6), { alpha: 0.25, blurPx: 10 });
}

function roof(P) {
  P.gradient('#c25a3c', '#9a4430', 0.5);
  P.marks('scallop', { color: '#7a3020', alpha: 0.55, size: 0.08 });
  P.marks('dot', { color: '#e48a6a', alpha: 0.3, size: 0.03, density: 0.5 });
}

export function chapelFold(H) {
  return boxFold({ w: 6.4, d: 4.6, wallH: 3.6, roofH: 2.6, overhang: 0.25, paints: { front, gable, roof }, paper: H.paper, seed: 77 });
}
