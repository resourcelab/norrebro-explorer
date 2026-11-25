/**
 * Gravestones. Each plot is ONE card cut round 1-3 stones standing on a kerb strip, printed as a small layered collage:
 * stone, inscription, moss, a planted shrub with flowers as the accent. 14 variants, turned and scaled so neighbours
 * differ. Notable graves get a taller stele with wreaths.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { PALETTE as C } from '../settings.js';

const D = P2.draw2;
const STONE_KINDS = ['round', 'gothic', 'cross', 'slab', 'obelisk', 'urn', 'round', 'slab'];
export const PLOT_VARIANTS = 14;

function stoneShape(g, kind, x, w, h) {
  switch (kind) {
    case 'round':
      D.rect(g, x - w / 2, 0.1, w, h - w * 0.45);
      D.ell(g, x, 0.1 + h - w * 0.45, w / 2, w * 0.45);
      break;
    case 'gothic':
      D.rect(g, x - w / 2, 0.1, w, h * 0.72);
      D.poly(g, [[x - w / 2, 0.1 + h * 0.7], [x, 0.1 + h], [x + w / 2, 0.1 + h * 0.7]]);
      break;
    case 'cross':
      D.rect(g, x - w * 0.16, 0.1, w * 0.32, h);
      D.rect(g, x - w * 0.5, 0.1 + h * 0.6, w, w * 0.3);
      D.rect(g, x - w * 0.42, 0.1, w * 0.84, h * 0.16);
      break;
    case 'obelisk':
      D.rect(g, x - w * 0.5, 0.1, w, h * 0.16);
      D.poly(g, [
        [x - w * 0.32, 0.1 + h * 0.15], [x + w * 0.32, 0.1 + h * 0.15], [x + w * 0.2, 0.1 + h * 0.9],
        [x, 0.1 + h * 1.04], [x - w * 0.2, 0.1 + h * 0.9],
      ]);
      break;
    case 'urn':
      D.rect(g, x - w * 0.42, 0.1, w * 0.84, h * 0.55);
      D.ell(g, x, 0.1 + h * 0.72, w * 0.32, h * 0.2);
      D.rect(g, x - w * 0.12, 0.1 + h * 0.84, w * 0.24, h * 0.14);
      break;
    default: // slab
      D.rect(g, x - w / 2, 0.1, w, h, w * 0.08);
  }
}

/** [pts, paint] of grave plot variant v. */
function plotPiece(v) {
  const r = P2.rng(900 + v * 13);
  const n = 1 + Math.floor(r() * 2.6);
  const stones = [];
  let span = 0;
  for (let i = 0; i < n; i++) {
    const kind = STONE_KINDS[Math.floor(r() * STONE_KINDS.length)];
    const w = 0.55 + r() * 0.35;
    const h = (kind === 'obelisk' ? 1.9 : kind === 'cross' ? 1.5 : 1.1) * (0.8 + r() * 0.45);
    stones.push({ kind, w, h });
    span += w + 0.18;
  }
  const col = C.stones[Math.floor(r() * C.stones.length)];
  const col2 = r() < 0.3 ? C.stones[Math.floor(r() * C.stones.length)] : col;
  const flowers = [C.red, '#e8c45a', C.cream, '#c4683a'][Math.floor(r() * 4)];
  const W = span + 0.2;
  const height = Math.max(...stones.map((s) => s.h)) * 1.05 + 0.2;

  return P2.drawnPiece((g, ink) => {
    g.fillStyle = ink(P2.shade(col, -0.18));
    D.rect(g, -W / 2, 0, W, 0.16, 0.03); // the kerb
    let x = -span / 2 + 0.09;
    stones.forEach((s, i) => {
      const cx = x + s.w / 2;
      const c = i % 2 ? col2 : col;
      g.fillStyle = ink(c);
      stoneShape(g, s.kind, cx, s.w, s.h);
      // the inscription: three printed lines
      g.fillStyle = ink(P2.shade(c, c === C.stones[2] ? 0.55 : -0.42), 'print');
      const top = s.kind === 'urn' ? s.h * 0.45 : s.kind === 'obelisk' ? s.h * 0.12 : s.h * 0.6;
      if (s.kind !== 'cross') {
        for (let k = 0; k < 3; k++) D.rect(g, cx - s.w * (0.32 - k * 0.06), 0.1 + top - k * 0.13, s.w * (0.64 - k * 0.12), 0.05);
      }
      g.fillStyle = ink(C.moss, 'print'); // moss at the foot
      D.ell(g, cx - s.w * 0.3, 0.2, s.w * 0.2, 0.08);
      x += s.w + 0.18;
    });
    g.fillStyle = ink('#55703f'); // a planted shrub ...
    D.ell(g, (r() - 0.5) * W * 0.5, 0.2, 0.32, 0.16);
    g.fillStyle = ink(flowers, 'print'); // ... and its flowers
    for (let k = 0; k < 5; k++) D.ell(g, (r() - 0.5) * W * 0.6, 0.18 + r() * 0.12, 0.07, 0.07);
  }, { w: W + 0.4, h: height, name: 'plot' });
}

/** The shared grave plot prints: [{ pts, mat }] x PLOT_VARIANTS. */
export function createPlotPrints(H) {
  return Array.from({ length: PLOT_VARIANTS }, (_, v) => {
    const [pts, paint] = plotPiece(v);
    return { pts, mat: H.printed(pts, paint, { res: 0.9 }) };
  });
}

/** [pts, paint] of a notable grave: a stele (tall) or a broad stone on a plinth, wreaths and flowers at its foot. */
export function notableGrave(seed, tall) {
  return P2.drawnPiece((g, ink) => {
    const r = P2.rng(seed);
    const col = ['#5f5c58', '#a3a19a', '#cdb48a', '#e3dccb'][seed % 4];
    g.fillStyle = ink(P2.shade(col, -0.2));
    D.rect(g, -1.1, 0, 2.2, 0.35, 0.05);
    g.fillStyle = ink(col);
    if (tall) {
      D.rect(g, -0.5, 0.3, 1.0, 2.1);
      D.ell(g, 0, 2.4, 0.5, 0.34);
    } else {
      D.rect(g, -0.6, 0.3, 1.2, 1.4, 0.12);
    }
    g.fillStyle = ink(col === '#5f5c58' ? '#e8d9a8' : P2.shade(col, -0.45), 'print');
    for (let k = 0; k < 4; k++) D.rect(g, -0.32 + k * 0.03, (tall ? 1.9 : 1.3) - k * 0.2, 0.64 - k * 0.06, 0.06);
    g.fillStyle = ink('#4f6a3e');
    D.ell(g, -0.55, 0.42, 0.45, 0.28);
    D.ell(g, 0.55, 0.42, 0.42, 0.26);
    g.fillStyle = ink(C.red, 'print');
    for (let k = 0; k < 9; k++) D.ell(g, (r() - 0.5) * 1.8, 0.38 + r() * 0.3, 0.09, 0.09);
    g.fillStyle = ink(C.cream, 'print');
    for (let k = 0; k < 6; k++) D.ell(g, (r() - 0.5) * 1.8, 0.4 + r() * 0.28, 0.07, 0.07);
  }, { w: 2.6, h: tall ? 2.9 : 1.9, name: 'notable' });
}
