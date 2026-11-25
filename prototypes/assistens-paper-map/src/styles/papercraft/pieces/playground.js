/**
 * Playground equipment as single paper cut-outs (each piece's parts overlap, so it cuts as one card): swings, a slide
 * with a little roofed tower, a climbing dome and a seesaw. Each returns [pts, paint] for H.printed / popup.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';

const D = P2.draw2;
const RED = '#c4523a';
const YELLOW = '#e8b93a';
const BLUE = '#3f7fb5';
const GREEN = '#5f9a48';
const IRON = '#3a3a36';

const swings = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(RED); // the A-frame legs and top bar
  D.poly(g, [[-1.5, 0], [-1.25, 0], [-0.95, 2.2], [-1.1, 2.2]]);
  D.poly(g, [[1.5, 0], [1.25, 0], [0.95, 2.2], [1.1, 2.2]]);
  D.rect(g, -1.15, 2.1, 2.3, 0.16, 0.04);
  g.fillStyle = ink(IRON); // chains
  for (const x of [-0.62, -0.18, 0.18, 0.62]) D.rect(g, x, 0.62, 0.04, 1.5);
  g.fillStyle = ink(YELLOW); // seats
  D.rect(g, -0.7, 0.52, 0.56, 0.12, 0.03);
  D.rect(g, 0.12, 0.52, 0.56, 0.12, 0.03);
  D.rect(g, -1.5, 0, 3.0, 0.08); // a ground strip ties the parts into one card
}, { w: 3.3, h: 2.4, name: 'swings' });

const slide = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(BLUE); // the tower
  D.rect(g, -1.1, 0, 0.14, 1.9);
  D.rect(g, -0.5, 0, 0.14, 1.9);
  D.rect(g, -1.15, 1.75, 0.8, 0.14);
  g.fillStyle = ink(YELLOW); // the chute
  D.poly(g, [[-0.4, 1.8], [-0.3, 1.9], [1.5, 0.25], [1.6, 0.05], [1.35, 0.05]]);
  g.fillStyle = ink(BLUE, 'print'); // ladder rungs
  for (let k = 0; k < 4; k++) D.rect(g, -1.0, 0.3 + k * 0.38, 0.52, 0.07);
  g.fillStyle = ink(RED); // the roof
  D.poly(g, [[-1.25, 1.88], [-0.75, 2.4], [-0.25, 1.88]]);
  D.rect(g, -1.2, 0, 2.85, 0.08);
}, { w: 3.4, h: 2.5, name: 'slide' });

const climber = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(GREEN); // the dome: the top half of an ellipse
  const dome = Array.from({ length: 17 }, (_, k) => [Math.cos((k / 16) * Math.PI) * 1.3, Math.sin((k / 16) * Math.PI) * 1.25]);
  D.poly(g, dome);
  g.fillStyle = ink('#3e6a32', 'print'); // the frame's bars
  for (let k = -2; k <= 2; k++) D.rect(g, k * 0.42 - 0.03, 0.05, 0.06, 1.2 - Math.abs(k) * 0.25);
  for (let k = 1; k <= 3; k++) D.rect(g, -1.2 + k * 0.08, k * 0.32, 2.4 - k * 0.16, 0.06);
  g.fillStyle = ink('#f3ead6', 'print'); // a highlight
  D.ell(g, -0.4, 0.8, 0.12, 0.06);
}, { w: 2.8, h: 1.4, name: 'climber' });

const seesaw = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(RED); // the pivot
  D.poly(g, [[-0.3, 0], [0.3, 0], [0, 0.6]]);
  g.fillStyle = ink(YELLOW); // the plank, tipped
  D.poly(g, [[-1.4, 0.2], [1.4, 0.7], [1.4, 0.82], [-1.4, 0.32]]);
  g.fillStyle = ink(IRON); // handles
  D.rect(g, -1.2, 0.3, 0.08, 0.4);
  D.rect(g, 1.2, 0.74, 0.08, 0.4);
  D.rect(g, -1.4, 0, 2.8, 0.06);
}, { w: 3.0, h: 1.3, name: 'seesaw' });

/** kind -> () => [pts, paint]; the kinds plan/neighbourhood.js places. */
export const PLAYGROUND = { swings, slide, climber, seesaw };
