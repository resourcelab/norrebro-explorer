/**
 * Ground layer: a site (core/sites/), from its plain ground layers. Each area a torn sheet (a lawn gets watercolour
 * washes, and inside it plot beds under every grave and fallen leaves under the trees, when the site's plan has them);
 * then the gravel and asphalt paths with grit. Works for any site: nothing here knows it is Assistens.
 * See world/ground.js for the drawing context `k`.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { PALETTE as C } from '../settings.js';
import { besideSegment } from '../../../core/map/math.js';

const LEAF_COLOURS = ['#dcae3c', '#c9772f', '#b5612f', '#e2bd5a', '#a8562c'];
const LEAVES_PER_TREE = 70;
const LAWN_DRIFT_MARKS = 26000;
/** Fill for each kind of site area; lawns (cemetery, park) also get washes, plot beds and leaves. */
const AREA_FILL = { cemetery: C.lawn, park: C.lawn, forecourt: '#ddd2b8' };
const LAWNS = new Set(['cemetery', 'park']);

/** @param site a site from game.map.sites (its ground layers); @param plan its plan (plots and trees, if it has them) */
export function printSiteGround(k, site, plan = {}) {
  const { areas, paths } = site.ground;
  const leaf = leafStamp(k);
  const { g, X, Z, torn, washes } = k;

  for (const area of areas.filter((a) => LAWNS.has(a.kind))) {
    // the lawn, and everything clipped to it
    torn(area.pts, AREA_FILL[area.kind]);
    g.save();
    g.beginPath();
    area.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.closePath();
    g.clip();
    washes([C.wash, C.wash, C.washB, C.washB, '#a9a77d']);
    if (plan.plots) printPlotBeds(k, plan.plots);
    if (plan.trees) printLeaves(k, plan.trees, leaf);
    g.restore();
  }

  printPaths(k, paths, leaf);

  // the other areas (the chapel's cobbled forecourt) on top of the paths
  for (const area of areas.filter((a) => !LAWNS.has(a.kind))) torn(area.pts, AREA_FILL[area.kind] ?? C.path);
}

/** leaf(px, py, size): an autumn leaf (a tilted ellipse) at canvas pixels. */
function leafStamp({ g, rnd }) {
  return (x, y, s) => {
    g.fillStyle = P2.rgba(LEAF_COLOURS[Math.floor(rnd() * LEAF_COLOURS.length)], 0.85);
    g.beginPath();
    g.ellipse(x, y, s, s * 0.5, rnd() * Math.PI, 0, 2 * Math.PI);
    g.fill();
  };
}

/** Under each grave: soil with a pale kerb, or (one in four) a clipped box-hedge frame. Size and tilt from its variant. */
function printPlotBeds({ g, ppu, X, Z }, plots) {
  for (const p of plots) {
    const w = 2.0 + (p.variant % 7) * 0.12;
    const d = 1.2 + (p.variant % 5) * 0.08;
    const hedge = p.variant % 4 === 0;
    g.save();
    g.translate(X(p.x), Z(p.z + 0.55)); // the bed lies in front of the stone
    g.rotate(((p.variant % 9) - 4) * 0.02);
    g.fillStyle = P2.rgba(hedge ? C.hedge : C.soil, hedge ? 0.75 : 0.5);
    g.fillRect((-w / 2) * ppu, (-d / 2) * ppu, w * ppu, d * ppu);
    g.fillStyle = P2.rgba(hedge ? '#8a6e4e' : P2.shade(C.soil, 0.12), 0.6);
    g.fillRect((-w / 2 + 0.16) * ppu, (-d / 2 + 0.16) * ppu, (w - 0.32) * ppu, (d - 0.32) * ppu);
    if (!hedge) {
      g.strokeStyle = P2.rgba('#ece4d0', 0.8);
      g.lineWidth = 0.08 * ppu;
      g.strokeRect((-w / 2) * ppu, (-d / 2) * ppu, w * ppu, d * ppu);
    }
    g.restore();
  }
}

/** Leaves under every broadleaf tree (thinning outward), then drifts of leaves and grass blades over the lawns. */
function printLeaves({ g, ppu, X, Z, rnd, drifts }, trees, leaf) {
  for (const t of trees) {
    if (t.kind === 'yew') continue; // evergreen
    for (let n = 0; n < LEAVES_PER_TREE; n++) {
      const a = rnd() * 2 * Math.PI;
      const d = Math.pow(rnd(), 0.7) * 3.4;
      leaf(X(t.x + Math.cos(a) * d), Z(t.z + Math.sin(a) * d * 0.8), (0.1 + rnd() * 0.08) * ppu);
    }
  }
  drifts((x, y) => {
    if (rnd() < 0.6) {
      leaf(x, y, (0.08 + rnd() * 0.07) * ppu);
      return;
    }
    g.strokeStyle = P2.rgba(rnd() < 0.5 ? '#7b8452' : '#969a62', 0.7); // a grass blade
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 4);
    g.stroke();
  }, { n: LAWN_DRIFT_MARKS });
}

/** Paths: a darker verge, the torn gravel or asphalt strip, a worn pale centre, then grit and a few leaves. */
function printPaths(k, PATHS, leaf) {
  const { g, ppu, X, Z, rnd, torn, bandOf, line } = k;
  for (const p of PATHS) torn(bandOf(p.pts, p.half + 0.12), P2.rgba(P2.shade(C.lawn, -0.12), 0.5), 'rgba(0,0,0,0)');
  for (const p of PATHS) torn(bandOf(p.pts, p.half), p.surface === 'asphalt' ? C.asphalt : C.path);
  for (const p of PATHS) line(p.pts, p.half * 0.7, P2.rgba('#fbf3df', 0.35));
  for (const p of PATHS) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i];
      const b = p.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let n = 0; n < L * 9; n++) {
        const [x, z] = besideSegment(a, b, rnd(), (rnd() - 0.5) * 2 * p.half * 0.9);
        if (rnd() < 0.12) {
          leaf(X(x), Z(z), (0.09 + rnd() * 0.05) * ppu);
        } else {
          g.fillStyle = rnd() < 0.6 ? P2.rgba(P2.shade(C.path, -0.3), 0.5) : P2.rgba('#fff6e2', 0.7);
          g.beginPath();
          g.arc(X(x), Z(z), (0.04 + rnd() * 0.05) * ppu, 0, 2 * Math.PI);
          g.fill();
        }
      }
    }
  }
}
