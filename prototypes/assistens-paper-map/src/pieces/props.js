/**
 * Small props: benches, Copenhagen park lamps, green water taps and the brick sheds.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { prismFold } from 'papercraft/lib/paperkit-3d.js';
import * as EX from 'papercraft/examples/countryside.js';
import { PALETTE as C } from '../config.js';
import { lidPaint } from './walls.js';
import { centroid } from '../map/math.js';

const D = P2.draw2;

export function createPropPrints(H) {
  const benchPts = EX.props.bench(1.25);
  const bench = { pts: benchPts, mat: H.printed(benchPts, EX.paintWood({ wood: C.bench }, { planks: 2 })) };

  const [lampPts, lampPaint] = P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#34443a');
    D.rect(g, -0.07, 0, 0.14, 2.72); // post
    D.rect(g, -0.2, 0, 0.4, 0.18, 0.04); // foot
    D.poly(g, [[-0.32, 2.6], [0, 3.0], [0.32, 2.6]]); // cap
    g.fillStyle = ink('#c9b47c');
    D.rect(g, -0.2, 2.14, 0.4, 0.44, 0.05); // glass
    g.fillStyle = ink('#34443a', 'print');
    D.rect(g, -0.02, 2.12, 0.04, 0.5);
  }, { w: 0.8, h: 3.0, name: 'lamp' });
  const lamp = { pts: lampPts, mat: H.printed(lampPts, lampPaint) };

  const tap = P2.drawnPiece((g, ink) => {
    g.fillStyle = ink('#3f5a44');
    D.rect(g, -0.14, 0, 0.28, 1.2, 0.06);
    D.rect(g, -0.3, 0, 0.6, 0.12, 0.03);
    D.rect(g, 0.1, 0.9, 0.3, 0.1, 0.04);
    g.fillStyle = ink('#9fb0b0', 'print'); // a watering can by the tap
    D.rect(g, -0.36, 0.05, 0.3, 0.3, 0.04);
  }, { w: 0.9, h: 1.3, name: 'tap' });

  return { bench, lamp, tap };
}

/**
 * A small brick shed or service building at its mapped spot, turned along its longest wall. Drawn at a standard size
 * (1.6-3.2 × 1.4 units) rather than the exact footprint: the real ones are tiny at this scale.
 */
export function shed(H, popup, footprintUnits) {
  const pts = footprintUnits;
  const [cx, cz] = centroid(pts);
  // turn the shed along its longest wall, front toward the camera
  let yaw = 0;
  let longest = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L > longest) { longest = L; yaw = Math.atan2(-(q[1] - p[1]), q[0] - p[0]); }
  }
  if (Math.cos(yaw) < 0) yaw += Math.PI;
  const w = Math.max(1.6, Math.min(3.2, longest * 1.2));
  const d = 1.4;
  const brick = (P) => {
    P.gradient('#b8664a', '#9a503a', 0.4);
    P.marks('brick', { color: '#5a2a1a', alpha: 0.4, size: 0.06 });
  };
  const node = prismFold([[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]], {
    h: 1.6, roof: 'pyramid', roofH: 0.9, paints: { wall: brick, roof: lidPaint('#5d5a55') }, paper: H.paper, seed: 60 + pts.length,
    print: H.cardOpts(cx, cz),
  });
  return popup(null, null, { node, height: 2.5, x: cx, z: cz, yaw, level: true, solid: 1.3 });
}
