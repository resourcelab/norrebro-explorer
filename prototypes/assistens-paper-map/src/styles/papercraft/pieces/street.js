/**
 * Street life: a bike rack with three parked bikes, and cyclists (printed facing right; world/traffic.js flips them).
 * Each returns [pts, paint] for H.printed / popup.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';

const D = P2.draw2;
const TYRE = '#2b2b2b';
const RIM = '#f1e9d8';
const FRAME = '#3a3a36';
const BIKE_COLOURS = ['#c4523a', '#2c3a5a', '#e8b93a', '#5f9a48', '#7a4a8a'];

export const bikeRack = () => P2.drawnPiece((g, ink) => {
  for (let k = 0; k < 3; k++) {
    const x = -1.0 + k * 1.0;
    g.fillStyle = ink(TYRE); // wheels, resting on the rack's ground strip
    D.ell(g, x - 0.34, 0.32, 0.3, 0.3);
    D.ell(g, x + 0.34, 0.32, 0.3, 0.3);
    g.fillStyle = ink(BIKE_COLOURS[k]); // frame, handlebars, saddle post
    D.poly(g, [[x - 0.34, 0.32], [x - 0.04, 0.64], [x + 0.34, 0.32], [x + 0.24, 0.32], [x - 0.04, 0.54], [x - 0.24, 0.32]]);
    D.rect(g, x - 0.1, 0.5, 0.07, 0.28);
    D.rect(g, x + 0.1, 0.36, 0.07, 0.44);
    g.fillStyle = ink(RIM, 'print');
    D.ell(g, x - 0.34, 0.32, 0.13, 0.13);
    D.ell(g, x + 0.34, 0.32, 0.13, 0.13);
  }
  g.fillStyle = ink('#8a8a86');
  D.rect(g, -1.5, 0, 3.0, 0.08);
}, { w: 3.5, h: 0.95, name: 'bike rack' });

/** A cyclist; the seed picks the coat and helmet colours. */
export const cyclist = (seed) => P2.drawnPiece((g, ink) => {
  const r = P2.rng(seed);
  const coat = BIKE_COLOURS[Math.floor(r() * BIKE_COLOURS.length)];
  g.fillStyle = ink(TYRE); // wheels
  D.ell(g, -0.55, 0.38, 0.36, 0.36);
  D.ell(g, 0.55, 0.38, 0.36, 0.36);
  g.fillStyle = ink(RIM, 'print');
  D.ell(g, -0.55, 0.38, 0.22, 0.22);
  D.ell(g, 0.55, 0.38, 0.22, 0.22);
  g.fillStyle = ink(FRAME);
  D.poly(g, [[-0.55, 0.38], [-0.1, 0.9], [0.4, 0.9], [0.55, 0.38], [0.45, 0.38], [0.32, 0.8], [-0.05, 0.8], [-0.45, 0.38]]);
  g.fillStyle = ink(coat); // body, and the arm reaching to the bars
  D.poly(g, [[-0.25, 0.9], [0.05, 1.7], [0.35, 1.65], [0.2, 0.95]]);
  D.poly(g, [[0.15, 1.55], [0.55, 1.25], [0.62, 1.3], [0.25, 1.65]]);
  g.fillStyle = ink('#2b2a2e'); // leg
  D.poly(g, [[-0.2, 0.95], [0.05, 0.95], [0.1, 0.4], [-0.02, 0.4]]);
  g.fillStyle = ink('#f1d9b8'); // head, overlapping the body so it cuts as one card
  D.ell(g, 0.2, 1.8, 0.22, 0.22);
  g.fillStyle = ink(r() < 0.5 ? FRAME : '#c4523a'); // helmet
  D.ell(g, 0.18, 1.94, 0.24, 0.13);
}, { w: 1.9, h: 2.2, name: 'cyclist' });
