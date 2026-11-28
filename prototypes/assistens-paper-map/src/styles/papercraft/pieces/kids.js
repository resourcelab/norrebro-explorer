/**
 * Paper pieces for where children play and walk: more playground equipment (basket swing, sandpit, spring rider,
 * roundabout, playhouse), the kit on pitches (goal, basketball hoop, table-tennis table, skate ramp), a school's
 * flagpole, and the street things a child learns to read (traffic light, bus stop, crossing sign, bin, picnic table).
 * Each is a single painted card, [pts, paint] for popup, drawn at about life size in units (build.js scales it).
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { letter } from './lettering.js';

const D = P2.draw2;
const RED = '#c4523a';
const YELLOW = '#e8b93a';
const BLUE = '#3f7fb5';
const GREEN = '#5f9a48';
const IRON = '#3a3a36';
const WOOD = '#b88a52';

// ---- playground --------------------------------------------------------------------------------------------------------
const basketswing = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(GREEN);
  D.poly(g, [[-1.5, 0], [-1.25, 0], [-0.95, 2.2], [-1.1, 2.2]]);
  D.poly(g, [[1.5, 0], [1.25, 0], [0.95, 2.2], [1.1, 2.2]]);
  D.rect(g, -1.15, 2.1, 2.3, 0.16, 0.04);
  g.fillStyle = ink(IRON);
  for (const x of [-0.5, 0.5]) D.poly(g, [[x - 0.02, 2.1], [x + 0.02, 2.1], [x * 0.9 + 0.02, 0.62], [x * 0.9 - 0.02, 0.62]]);
  g.fillStyle = ink('#d86a3a'); // the round nest seat, seen from the side
  D.ell(g, 0, 0.55, 0.75, 0.16);
  g.fillStyle = ink('#a84a2a', 'print');
  for (let k = -3; k <= 3; k++) D.rect(g, k * 0.2 - 0.02, 0.45, 0.04, 0.2);
  D.rect(g, -1.5, 0, 3.0, 0.08);
}, { w: 3.3, h: 2.4, name: 'basketswing' });

const sandpit = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(WOOD); // the low wooden frame
  D.rect(g, -1.3, 0, 2.6, 0.28, 0.04);
  g.fillStyle = ink('#e9cf8e'); // the sand heaped inside, a castle on it
  D.poly(g, [[-1.2, 0.26], [-0.6, 0.5], [0.1, 0.42], [0.8, 0.55], [1.2, 0.26]]);
  g.fillStyle = ink('#d8b56a', 'print');
  D.rect(g, -0.25, 0.4, 0.3, 0.25);
  D.poly(g, [[-0.28, 0.65], [-0.1, 0.8], [0.08, 0.65]]);
  g.fillStyle = ink(RED); // a bucket and spade
  D.poly(g, [[0.5, 0.45], [0.75, 0.45], [0.7, 0.75], [0.55, 0.75]]);
  g.fillStyle = ink(BLUE);
  D.rect(g, 0.88, 0.45, 0.05, 0.42);
  D.poly(g, [[0.82, 0.42], [0.99, 0.42], [0.95, 0.3], [0.86, 0.3]]);
}, { w: 2.8, h: 0.95, name: 'sandpit' });

const springy = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(IRON); // the spring, on a rod that ties the base, the coils and the horse into one card
  D.rect(g, -0.05, 0, 0.1, 0.75);
  for (let k = 0; k < 5; k++) D.rect(g, -0.22, 0.08 + k * 0.12, 0.44, 0.06, 0.03);
  g.fillStyle = ink(RED); // a little horse
  D.poly(g, [[-0.55, 0.7], [0.4, 0.7], [0.55, 0.95], [0.45, 1.25], [0.2, 1.1], [0.2, 0.9], [-0.55, 0.9]]);
  D.rect(g, -0.6, 0.8, 0.12, 0.25, 0.04); // its tail
  g.fillStyle = ink(YELLOW);
  D.rect(g, 0.12, 0.85, 0.06, 0.32); // handle, from the horse's neck
  g.fillStyle = ink(IRON, 'print');
  D.ell(g, 0.38, 1.08, 0.04, 0.04); // eye
  g.fillStyle = ink(GREEN);
  D.rect(g, -0.4, 0, 0.8, 0.08, 0.03);
}, { w: 1.3, h: 1.35, name: 'springy' });

const roundabout = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(IRON);
  D.rect(g, -0.08, 0, 0.16, 0.3);
  g.fillStyle = ink(BLUE); // the turning disc, seen from the side
  D.ell(g, 0, 0.32, 1.1, 0.14);
  g.fillStyle = ink(YELLOW); // the hand rails
  for (const x of [-0.8, -0.27, 0.27, 0.8]) D.rect(g, x - 0.03, 0.35, 0.06, 0.45);
  D.rect(g, -0.85, 0.75, 1.7, 0.07, 0.03);
}, { w: 2.4, h: 0.9, name: 'roundabout' });

const playhouse = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#e6d0a0'); // walls
  D.rect(g, -0.75, 0, 1.5, 1.0);
  g.fillStyle = ink(RED); // roof
  D.poly(g, [[-0.95, 0.95], [0, 1.6], [0.95, 0.95]]);
  g.fillStyle = ink('#7a5236'); // door
  D.rect(g, -0.2, 0, 0.4, 0.7, 0.18);
  g.fillStyle = ink('#9fc3d8'); // window
  D.rect(g, 0.35, 0.5, 0.28, 0.25);
  g.fillStyle = ink(GREEN, 'print'); // a flower box
  D.rect(g, 0.32, 0.42, 0.34, 0.07);
}, { w: 2.0, h: 1.7, name: 'playhouse' });

export const MORE_PLAYGROUND = { basketswing, sandpit, springy, roundabout, playhouse };

// ---- sports ------------------------------------------------------------------------------------------------------------
const goal = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#f4f1ea');
  D.rect(g, -1.5, 0, 0.12, 1.3);
  D.rect(g, 1.38, 0, 0.12, 1.3);
  D.rect(g, -1.5, 1.2, 3.0, 0.12);
  g.fillStyle = ink('#cfcac0', 'print'); // the net
  for (let k = 1; k < 12; k++) D.rect(g, -1.4 + k * 0.233, 0.02, 0.025, 1.18);
  for (let k = 1; k < 6; k++) D.rect(g, -1.4, k * 0.2, 2.8, 0.025);
}, { w: 3.1, h: 1.4, name: 'goal' });

const hoop = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(IRON);
  D.rect(g, -0.07, 0, 0.14, 2.6); // the post
  g.fillStyle = ink('#f4f1ea'); // the board
  D.rect(g, -0.55, 2.3, 1.1, 0.75, 0.03);
  g.fillStyle = ink(RED, 'print');
  D.rect(g, -0.2, 2.42, 0.4, 0.3);
  g.fillStyle = ink('#e07a2a'); // the ring and net
  D.rect(g, -0.28, 2.28, 0.56, 0.06);
  g.fillStyle = ink('#f4f1ea', 'print');
  D.poly(g, [[-0.26, 2.28], [0.26, 2.28], [0.16, 1.95], [-0.16, 1.95]]);
}, { w: 1.2, h: 3.1, name: 'hoop' });

const table = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#3e6a8a'); // a concrete table-tennis table's top, seen from the side
  D.rect(g, -1.4, 0.7, 2.8, 0.12);
  g.fillStyle = ink('#9a9a92');
  D.rect(g, -0.9, 0, 0.3, 0.72);
  D.rect(g, 0.6, 0, 0.3, 0.72);
  g.fillStyle = ink('#f4f1ea'); // the net
  D.rect(g, -0.03, 0.82, 0.06, 0.16);
  D.rect(g, -0.6, 0.94, 1.2, 0.04);
}, { w: 3.0, h: 1.05, name: 'table' });

const ramp = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#9a9a92'); // a concrete quarter pipe
  D.poly(g, [[-1.4, 0], [1.4, 0], [1.4, 1.2], ...Array.from({ length: 9 }, (_, k) => { const a = (k / 8) * Math.PI / 2; return [1.4 - Math.sin(a) * 2.2, 1.2 - (1 - Math.cos(a)) * 1.2]; })]);
  g.fillStyle = ink(IRON);
  D.rect(g, 1.2, 1.2, 0.24, 0.08); // the coping
  g.fillStyle = ink('#c9c9c0', 'print');
  for (let k = 0; k < 3; k++) D.rect(g, 0.2 + k * 0.35, 0.05, 0.04, 0.4 + k * 0.25);
}, { w: 3.0, h: 1.4, name: 'ramp' });

export const SPORT = { goal, hoop, table, ramp };

// ---- schools and streets -----------------------------------------------------------------------------------------------
/** A white pole with the Danish flag flying: every school and kindergarten has one in its yard. */
export const flagpole = () => P2.drawnPiece((g, ink) => {
  const x = -0.7; // the pole, left of the card's middle, so the flag fits on it
  g.fillStyle = ink('#f4f1ea');
  D.rect(g, x - 0.05, 0, 0.1, 4.2);
  D.ell(g, x, 4.22, 0.1, 0.1);
  g.fillStyle = ink('#c8102e'); // red with a white cross, nearer the pole
  D.rect(g, x + 0.04, 3.2, 1.3, 0.85);
  g.fillStyle = ink('#ffffff', 'print');
  D.rect(g, x + 0.41, 3.2, 0.16, 0.85);
  D.rect(g, x + 0.04, 3.55, 1.3, 0.16);
}, { w: 1.8, h: 4.5, name: 'flagpole' });

/** A traffic light: the walking man lit green. */
export const trafficLight = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(IRON);
  D.rect(g, -0.05, 0, 0.1, 2.3);
  D.rect(g, -0.2, 1.6, 0.4, 0.9, 0.06);
  g.fillStyle = ink('#5a1a14');
  D.ell(g, 0, 2.28, 0.12, 0.12);
  g.fillStyle = ink('#3ac46a', 'print'); // green: you may cross
  D.ell(g, 0, 1.85, 0.12, 0.12);
  g.fillStyle = ink(YELLOW); // the push button box
  D.rect(g, -0.12, 0.9, 0.24, 0.3, 0.04);
}, { w: 0.6, h: 2.6, name: 'traffic-light' });

/** A Copenhagen bus stop: the yellow sign on a post, and a small glass shelter. */
export const busStop = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#c9d6dc'); // the shelter glass
  D.rect(g, -1.4, 0.05, 1.6, 1.25);
  g.fillStyle = ink('#4a5054');
  D.rect(g, -1.5, 1.25, 1.8, 0.12);
  D.rect(g, -1.45, 0, 0.06, 1.3);
  D.rect(g, 0.15, 0, 0.06, 1.3);
  g.fillStyle = ink(IRON); // the sign post, and the kerb stone that ties it to the shelter
  D.rect(g, 0.75, 0, 0.07, 2.2);
  D.rect(g, -1.45, 0, 2.3, 0.06);
  g.fillStyle = ink('#f5c400'); // the yellow sign
  D.rect(g, 0.5, 1.75, 0.6, 0.5, 0.05);
  letter(g, 'BUS', 0.8, 2.0, 0.18, ink('#1e2a3a', 'print'));
}, { w: 3.2, h: 2.4, name: 'bus-stop' });

/** A blue crossing sign: a walking figure on a zebra (Danish sign E17). */
export const crossingSign = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(IRON);
  D.rect(g, -0.04, 0, 0.08, 2.0);
  g.fillStyle = ink(BLUE);
  D.rect(g, -0.32, 1.45, 0.64, 0.64, 0.05);
  g.fillStyle = ink('#ffffff', 'print');
  D.poly(g, [[-0.22, 1.62], [0.22, 1.62], [0.0, 2.0]]);
  g.fillStyle = ink(IRON, 'print');
  D.ell(g, 0.0, 1.86, 0.04, 0.04);
  D.rect(g, -0.02, 1.68, 0.04, 0.16);
}, { w: 0.8, h: 2.2, name: 'crossing-sign' });

export const bin = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink('#2f5a3a'); // a green Copenhagen bin on its post
  D.rect(g, -0.04, 0, 0.08, 0.5);
  D.poly(g, [[-0.26, 0.45], [0.26, 0.45], [0.22, 1.0], [-0.22, 1.0]]);
  g.fillStyle = ink('#1f3a26', 'print');
  D.rect(g, -0.18, 0.9, 0.36, 0.05);
}, { w: 0.6, h: 1.05, name: 'bin' });

export const picnicTable = () => P2.drawnPiece((g, ink) => {
  g.fillStyle = ink(WOOD);
  D.rect(g, -1.0, 0.72, 2.0, 0.1); // top
  D.rect(g, -1.2, 0.42, 2.4, 0.08); // benches
  g.fillStyle = ink('#8a6438');
  D.poly(g, [[-0.8, 0], [-0.65, 0], [-0.4, 0.72], [-0.55, 0.72]]);
  D.poly(g, [[0.8, 0], [0.65, 0], [0.4, 0.72], [0.55, 0.72]]);
}, { w: 2.6, h: 0.9, name: 'picnic-table' });

/** A fence's paint for placeRun: thin green-painted railings (a wall: plain brick-red render). */
export const fencePaint = (style) => (P) => {
  if (style === 'wall') { P.gradient('#b8664a', '#9a503a', 0.4); return; }
  P.gradient('#3f5a44', '#2f4434', 0.4);
  P.draw((g) => {
    const { box } = P;
    g.fillStyle = 'rgba(240, 236, 220, 0.55)'; // the gaps between the railings
    const n = Math.max(2, Math.round(box.w / (box.h * 0.35)));
    for (let k = 0; k < n; k++) g.fillRect(box.x0 + ((k + 0.25) * box.w) / n, box.y0 + box.h * 0.12, (box.w / n) * 0.5, box.h * 0.72);
  });
};
