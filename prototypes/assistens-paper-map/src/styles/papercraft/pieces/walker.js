/**
 * The walker: a Nørrebro local out for a walk, a small 3D paper model that reads from every side. Every body part is a
 * front card with a profile card standing behind it; legs and arms swing on hip and shoulder pivots with the distance
 * walked. Navy wool coat, mustard knitted hat, red scarf, a canvas tote. Faces +z, like the harness expects.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { makeCard } from 'papercraft/lib/paperkit-3d.js';

const D = P2.draw2;
const PROFILE = -Math.PI / 2; // a profile card: its +x points forward (+z)
const COLOURS = {
  coat: '#2c3a5a', coatSide: '#26324e', scarf: '#b4432f', hat: '#d9a33a', trousers: '#2b2a2e',
  skin: '#f1d9b8', hair: '#5a3a26', tote: '#e6dcc4',
};

export function createWalker(H) {
  const c = COLOURS;
  const g = new H.THREE.Group();
  const body = new H.THREE.Group();
  g.add(body);

  const card = ([pts, paint], seed, { x = 0, y = 0, z = 0, ry = 0, parent = body, back = 'mirror' } = {}) => {
    const m = makeCard(pts, { paint, paper: H.paper, thickness: 0.05, edgeWidth: 0.04, pxPerUnit: 64, seed, back, folds: [] });
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    return m;
  };
  const plain = (col) => (P) => {
    P.gradient(P2.shade(col, 0.08), P2.shade(col, -0.1), 0.5);
    P.felt();
    P.innerShade(P2.shade(col, -0.5), { alpha: 0.25, blurPx: 8 });
  };

  // legs: a front + a profile card per leg, hanging from a hip pivot
  const legs = [-0.12, 0.12].map((x, i) => {
    const hip = new H.THREE.Group();
    hip.position.set(x, 0.95, 0);
    body.add(hip);
    const leg = (col, shoe) => P2.drawnPiece((gg, ink) => {
      gg.fillStyle = ink(col);
      D.rect(gg, -0.1, 0.18, 0.2, 0.8, 0.05);
      gg.fillStyle = ink('#1e1a18');
      D.rect(gg, -0.12, 0, shoe, 0.22, 0.07);
    }, { w: 0.45, h: 1.0, name: 'leg' });
    card(leg(c.trousers, 0.24), 310 + i, { y: -0.97, parent: hip });
    card(leg(P2.shade(c.trousers, -0.08), 0.34), 320 + i, { y: -0.97, z: -0.2, ry: PROFILE, parent: hip });
    return hip;
  });

  // the coat, front (scarf, buttons, a pocket) and side
  card(P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(c.coat);
    D.rect(gg, -0.4, 0, 0.8, 1.32, 0.2);
    gg.fillStyle = ink(c.scarf);
    D.rect(gg, -0.3, 1.08, 0.6, 0.22, 0.08);
    D.rect(gg, 0.06, 0.55, 0.16, 0.6, 0.04);
    gg.fillStyle = ink('#e8c25a', 'print');
    D.rect(gg, 0.06, 0.62, 0.16, 0.04);
    D.rect(gg, 0.06, 0.74, 0.16, 0.04);
    gg.fillStyle = ink('#1f2a44', 'print');
    D.rect(gg, -0.3, 0.3, 0.2, 0.05);
    D.ell(gg, -0.1, 0.9, 0.03, 0.03);
    D.ell(gg, -0.1, 0.65, 0.03, 0.03);
  }, { w: 0.85, h: 1.35, name: 'coat' }), 301, { y: 0.7, back: plain(P2.shade(c.coat, -0.06)) });
  card(P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(c.coatSide);
    D.rect(gg, -0.24, 0, 0.48, 1.28, 0.18);
    gg.fillStyle = ink(c.scarf);
    D.rect(gg, -0.2, 1.06, 0.4, 0.2, 0.06);
    gg.fillStyle = ink('#1f2a44', 'print');
    D.rect(gg, -0.02, 0.05, 0.04, 1.0);
  }, { w: 0.55, h: 1.3, name: 'coat side' }), 302, { y: 0.72, z: -0.27, ry: PROFILE });

  // the head: a face in front (hair on its back), a profile behind it
  card(P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(c.skin);
    D.ell(gg, 0, 0.38, 0.36, 0.38);
    gg.fillStyle = ink(c.hair, 'print');
    D.rect(gg, -0.32, 0.5, 0.64, 0.12, 0.06);
    gg.fillStyle = ink('#2a1608', 'print');
    D.ell(gg, -0.12, 0.35, 0.04, 0.05);
    D.ell(gg, 0.12, 0.35, 0.04, 0.05);
    gg.fillStyle = ink('#d48a6a', 'print');
    D.ell(gg, -0.2, 0.25, 0.05, 0.03);
    D.ell(gg, 0.2, 0.25, 0.05, 0.03);
    gg.fillStyle = ink('#8a3a22', 'print');
    D.rect(gg, -0.07, 0.17, 0.14, 0.03, 0.015);
  }, { w: 0.8, h: 0.8, name: 'face' }), 304, { y: 1.88, back: plain(c.hair) });
  card(P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(P2.shade(c.skin, -0.04));
    D.ell(gg, 0, 0.38, 0.34, 0.38);
    gg.fillStyle = ink(c.hair);
    D.ell(gg, -0.12, 0.44, 0.24, 0.32);
    gg.fillStyle = ink('#2a1608', 'print');
    D.ell(gg, 0.22, 0.35, 0.03, 0.045);
  }, { w: 0.75, h: 0.8, name: 'head side' }), 305, { y: 1.86, z: -0.37, ry: PROFILE });

  // the knitted hat, front and profile
  const hat = (col, seed, ry) => card(P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(col);
    D.rect(gg, -0.36, 0, 0.72, 0.38, 0.16);
    gg.fillStyle = ink(P2.shade(col, -0.22));
    D.rect(gg, -0.37, 0, 0.74, 0.12, 0.04);
    gg.fillStyle = ink(P2.shade(col, -0.3), 'print');
    for (const x of [-0.2, 0, 0.2]) D.rect(gg, x - 0.02, 0.14, 0.04, 0.22);
  }, { w: 0.78, h: 0.45, name: 'hat' }), seed, { y: 2.42, z: ry ? -0.37 : 0.02, ry });
  hat(c.hat, 306, 0);
  hat(P2.shade(c.hat, -0.06), 307, PROFILE);

  // arms on shoulder pivots; the right hand carries the tote
  const arms = [-0.45, 0.45].map((x, i) => {
    const shoulder = new H.THREE.Group();
    shoulder.position.set(x, 1.92, 0);
    body.add(shoulder);
    const arm = (col) => P2.drawnPiece((gg, ink) => {
      gg.fillStyle = ink(col);
      D.rect(gg, -0.1, 0.14, 0.2, 0.66, 0.09);
      gg.fillStyle = ink(c.skin);
      D.ell(gg, 0, 0.08, 0.09, 0.08);
    }, { w: 0.26, h: 0.82, name: 'arm' });
    card(arm(c.coat), 330 + i, { y: -0.8, parent: shoulder });
    card(arm(c.coatSide), 340 + i, { y: -0.8, z: -0.12, ry: PROFILE, parent: shoulder });
    return shoulder;
  });
  card(P2.drawnPiece((gg, ink) => {
    gg.fillStyle = ink(c.tote);
    D.rect(gg, -0.26, 0, 0.52, 0.56, 0.04);
    D.rect(gg, -0.18, 0.5, 0.06, 0.5);
    D.rect(gg, 0.12, 0.5, 0.06, 0.5);
    D.rect(gg, -0.18, 0.95, 0.36, 0.06);
    gg.fillStyle = ink(c.scarf, 'print');
    D.ell(gg, 0, 0.28, 0.1, 0.1);
  }, { w: 0.6, h: 1.05, name: 'tote' }), 350, { y: -1.45, z: 0.05, ry: PROFILE, parent: arms[1] });

  // the stride: phase runs with the distance walked; the planted foot stays put; arms swing opposite the legs
  const legLen = 0.97 * 1.25;
  const stepLen = 1.2;
  const reach = stepLen / (2 * legLen);
  const legAngle = (ph, gait) => {
    const u = (ph / Math.PI) % 2;
    const A = gait * reach;
    if (u >= 1) return A * (3 - 2 * u);
    const e = u * u * (3 - 2 * u);
    return A * (2 * e - 1);
  };
  g.userData.stride = (walked, gait) => {
    const ph = (walked / stepLen) * Math.PI;
    const l0 = legAngle(ph, gait);
    const l1 = legAngle(ph + Math.PI, gait);
    legs[0].rotation.x = -l0;
    legs[1].rotation.x = -l1;
    arms[0].rotation.x = l0 * 0.7;
    arms[1].rotation.x = l1 * 0.25; // the tote arm swings less
    body.position.y = Math.abs(Math.sin(ph)) * 0.05 * gait;
  };
  return g;
}
