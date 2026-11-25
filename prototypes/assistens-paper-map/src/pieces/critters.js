/**
 * The cemetery's wildlife as layered paper cut-outs (facing right): crows and red squirrels.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';

const D = P2.draw2;

export const crow = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#2f2d2e');
  D.ell(g, 0, 0.32, 0.36, 0.22); // body
  D.ell(g, 0.3, 0.52, 0.15, 0.14); // head
  D.poly(g, [[-0.3, 0.38], [-0.62, 0.5], [-0.6, 0.36]]); // tail
  D.rect(g, -0.05, 0, 0.04, 0.16); // legs
  D.rect(g, 0.06, 0, 0.04, 0.16);
  g.fillStyle = ink('#4a4648', 'print');
  D.ell(g, -0.06, 0.34, 0.2, 0.1); // wing
  g.fillStyle = ink('#6b6258');
  D.poly(g, [[0.42, 0.55], [0.6, 0.5], [0.42, 0.47]]); // beak
  g.fillStyle = ink('#e8dcc0', 'print');
  D.ell(g, 0.33, 0.55, 0.03, 0.03); // eye
}, { w: 1.3, h: 0.7, name: 'crow' });

export const squirrel = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#a5532c');
  D.ell(g, 0, 0.3, 0.22, 0.26); // body
  D.ell(g, 0.14, 0.58, 0.13, 0.12); // head
  D.ell(g, -0.3, 0.58, 0.18, 0.36, 0.3); // tail
  D.poly(g, [[0.1, 0.68], [0.12, 0.8], [0.18, 0.69]]); // ear
  D.rect(g, -0.06, 0, 0.18, 0.1, 0.03); // feet
  g.fillStyle = ink('#e9cfa0', 'print');
  D.ell(g, 0.08, 0.3, 0.08, 0.14); // belly
  g.fillStyle = ink('#2a1608', 'print');
  D.ell(g, 0.2, 0.6, 0.025, 0.025); // eye
}, { w: 1.1, h: 1.15, name: 'squirrel' });
