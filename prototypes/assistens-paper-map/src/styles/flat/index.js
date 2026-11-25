/**
 * The flat style: the game as a clean top-down map, drawn on a 2D canvas (no three.js). North is always up. It is
 * the second style, and the proof that the game core and the styles are apart: it implements the same interface as
 * papercraft (../README.md), reads the same things and game state, and shares no drawing code with it.
 *
 * Near and far: everything on the map is always drawn; small things (trees, graves, benches, signs...) only when near,
 * so the map view stays readable.
 */
import { ZOOMS, TOY } from '../../config.js';
import { STREETS, AREAS, BUILDINGS, CONTEXT, REGION } from '../../core/map/neighbourhood.js';
import { OUTLINE, PATHS } from '../../core/map/cemetery.js';

const COLOURS = {
  paper: '#f2ede1', veil: 'rgba(242,237,225,0.5)', lawn: '#cfd8ad', park: '#bfd39b', grass: '#c9d9a8', garden: '#bcd29c',
  pitch: '#a9cf92', playground: '#f0d58f', square: '#e6dfcd', schoolyard: '#e8dfc9', parking: '#ddd8cc', wood: '#a6c48b',
  scrub: '#b3c896', flowerbed: '#e3b9c3', cemetery: '#c6d6a2', water: '#9ccbe0', road: '#ffffff', casing: '#c9c0ad',
  footway: '#f7f1e3', path: '#eadfc4', block: '#e0c1a3', blockEdge: '#b68b6a', far: '#e8d6c3', wall: '#d9a94a', hedge: '#6e8f55',
  tree: { linden: '#9cbf5a', chestnut: '#7fa84e', maple: '#b7c25a', beech: '#8fae55', yew: '#4f7a4f', poplar: '#a6b85e' },
  grave: '#a8a49b', notable: '#6d6a64', bench: '#7b5a3c', lamp: '#4a4a46', tap: '#4b8fb8', kit: '#e0703c', rack: '#5a6470',
  brick: '#b5523a', copper: '#5f9a86', chapel: '#c9694c', shed: '#b9a58e', ink: '#2e241c', hero: '#d6452f',
};
const EASE = 0.5; // seconds to ease between zooms
const FOLLOW = 6; // how quickly the view catches up with the walker (1/s)

export function createFlatStyle(game) {
  const canvas = document.createElement('canvas');
  canvas.className = 'flat-map';
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  let W = 0;
  let Hh = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth;
    Hh = innerHeight;
    canvas.width = W * dpr;
    canvas.height = Hh * dpr;
  };
  addEventListener('resize', resize);
  resize();

  const near = new Set();
  const view = { x: game.state.hero.x, z: game.state.hero.z, across: ZOOMS.walk.across, from: ZOOMS.walk.across, to: ZOOMS.walk.across, t: 1 };
  const things = game.things;
  const labels = streetLabels([...STREETS, ...CONTEXT.streets]);
  const boxOf = (pts) => { let x0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let z1 = -Infinity; for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } return [x0, z0, x1, z1]; };
  const withBox = (list, ptsOf) => list.map((f) => ({ f, box: boxOf(ptsOf(f)) }));
  const layers = {
    areas: withBox([...CONTEXT.areas, ...AREAS], (a) => a.pts),
    streets: withBox([...CONTEXT.streets, ...STREETS].sort((a, b) => a.width - b.width), (s) => s.pts),
    farBlocks: withBox(CONTEXT.buildings, (p) => p),
    blocks: withBox(BUILDINGS, (b) => b.pts),
    paths: withBox(PATHS, (p) => p.pts),
  };

  // ---- drawing helpers (world units -> screen pixels) ----
  let ppu = 1;
  const sx = (x) => (x - view.x) * ppu + W / 2;
  const sz = (z) => (z - view.z) * ppu + Hh / 2;
  const visible = ([x0, z0, x1, z1]) => sx(x1) > -50 && sx(x0) < W + 50 && sz(z1) > -50 && sz(z0) < Hh + 50;
  const trace = (pts, close = true) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z)))); if (close) g.closePath(); };
  const dot = (x, z, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(sx(x), sz(z), Math.max(1, r * ppu), 0, 2 * Math.PI); g.fill(); };

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COLOURS.paper;
    g.fillRect(0, 0, W, Hh);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    for (const { f, box } of layers.areas) if (visible(box)) { g.fillStyle = COLOURS[f.kind] ?? COLOURS.square; trace(f.pts); g.fill(); }
    g.fillStyle = COLOURS.lawn;
    trace(OUTLINE);
    g.fill();
    for (const { f, box } of layers.streets) {
      if (!visible(box)) continue;
      const road = f.width >= 5;
      g.strokeStyle = road ? COLOURS.casing : COLOURS.path;
      g.lineWidth = Math.max(1, (f.half * 2 + (road ? 0.5 : 0)) * ppu);
      trace(f.pts, false);
      g.stroke();
    }
    for (const { f, box } of layers.streets) {
      if (!visible(box) || f.width < 5) continue;
      g.strokeStyle = f.kind === 'pedestrian' ? COLOURS.footway : COLOURS.road;
      g.lineWidth = Math.max(1, f.half * 2 * ppu);
      trace(f.pts, false);
      g.stroke();
    }
    for (const { f, box } of layers.paths) {
      if (!visible(box)) continue;
      g.strokeStyle = COLOURS.path;
      g.lineWidth = Math.max(1, f.half * 2 * ppu);
      trace(f.pts, false);
      g.stroke();
    }
    g.fillStyle = COLOURS.far;
    for (const { f, box } of layers.farBlocks) if (visible(box)) { trace(f); g.fill(); }
    for (const { f, box } of layers.blocks) {
      if (!visible(box) || f.landmark) continue;
      g.fillStyle = 'rgba(80,50,30,0.18)'; // a soft shadow, down and right
      g.save();
      g.translate(0.3 * ppu, 0.4 * ppu);
      trace(f.pts);
      g.fill();
      g.restore();
      g.fillStyle = COLOURS.block;
      g.strokeStyle = COLOURS.blockEdge;
      g.lineWidth = 1;
      trace(f.pts);
      g.fill();
      g.stroke();
    }
    // outside the walkable area: veiled
    g.fillStyle = COLOURS.veil;
    g.beginPath();
    g.rect(0, 0, W, Hh);
    g.rect(sx(REGION.x0), sz(REGION.z0), (REGION.x1 - REGION.x0) * ppu, (REGION.z1 - REGION.z0) * ppu);
    g.fill('evenodd');

    for (const t of things) if (near.has(t.id) || t.always) drawThing(t);
    drawStreetNames();
    for (const r of game.state.riders) drawRider(r);
    drawHero();
  }

  function drawThing(t) {
    const r = 3; // cull with a generous radius
    if (sx(t.x) < -r * ppu - 80 || sx(t.x) > W + r * ppu + 80 || sz(t.z) < -r * ppu - 80 || sz(t.z) > Hh + r * ppu + 80) return;
    switch (t.kind) {
      case 'wall':
        g.strokeStyle = t.wall === 'hedge' ? COLOURS.hedge : COLOURS.wall;
        g.lineWidth = Math.max(1.5, (t.wall === 'hedge' ? 0.6 : 0.5) * ppu);
        trace([t.a, t.b], false);
        g.stroke();
        break;
      case 'tree':
        dot(t.x, t.z, 1.9 * (t.size / TOY.tree) * 0.9, COLOURS.tree[t.species] ?? COLOURS.tree.linden);
        dot(t.x - 0.4, t.z - 0.4, 0.8, 'rgba(255,255,255,0.18)');
        break;
      case 'grave':
        g.fillStyle = COLOURS.grave;
        g.fillRect(sx(t.x) - 0.35 * ppu, sz(t.z) - 0.18 * ppu, 0.7 * ppu, 0.36 * ppu);
        break;
      case 'notable-grave':
        dot(t.x, t.z, 0.55, COLOURS.notable);
        dot(t.x, t.z, 0.25, '#f2d27a');
        break;
      case 'bench':
        g.fillStyle = COLOURS.bench;
        g.fillRect(sx(t.x) - 0.5 * ppu, sz(t.z) - 0.15 * ppu, 1.0 * ppu, 0.3 * ppu);
        break;
      case 'lamp': dot(t.x, t.z, 0.18, COLOURS.lamp); break;
      case 'tap': dot(t.x, t.z, 0.25, COLOURS.tap); break;
      case 'critter': dot(t.x, t.z, 0.18, '#2f2d2e'); break;
      case 'gate-post': dot(t.x, t.z, 0.35, COLOURS.wall); break;
      case 'playground': dot(t.x, t.z, 0.8, COLOURS.kit); dot(t.x, t.z, 0.4, '#fff3df'); break;
      case 'bike-rack':
        g.strokeStyle = COLOURS.rack;
        g.lineWidth = Math.max(1, 0.12 * ppu);
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(sx(t.x + k * 0.5), sz(t.z - 0.4)); g.lineTo(sx(t.x + k * 0.5), sz(t.z + 0.4)); g.stroke(); }
        break;
      case 'chapel': g.fillStyle = COLOURS.chapel; trace(t.pts); g.fill(); break;
      case 'shed': g.fillStyle = COLOURS.shed; trace(t.pts); g.fill(); break;
      case 'block': break; // drawn with the map
      case 'church':
        g.fillStyle = COLOURS.brick;
        trace(t.pts);
        g.fill();
        dot(t.tower[0], t.tower[1], 1.0, COLOURS.copper);
        label(t.name, t.x, t.z + 4, 12, true);
        break;
      case 'flag':
        dot(t.x, t.z, 0.9, t.color);
        dot(t.x, t.z, 0.4, '#fff8ea');
        label(t.name, t.x, t.z + 2.6, 12, true);
        break;
      case 'corner-sign':
        if (ppu > 14) label(t.names.join(' · '), t.x, t.z, 10, false, '#fbfaf5');
        break;
      case 'fingerpost':
        label(t.arms.map((a) => `${a.dx < 0 ? '← ' : ''}${a.name} ${a.metres} m${a.dx >= 0 ? ' →' : ''}`).join('   '), t.x, t.z, 11, true, '#f1e4c4');
        break;
      default:
        break;
    }
  }

  function label(text, x, z, size, bold = false, plate = null) {
    g.font = `${bold ? 700 : 600} ${size}px "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const px = sx(x);
    const pz = sz(z);
    if (plate) {
      const w = g.measureText(text).width + 8;
      g.fillStyle = plate;
      g.strokeStyle = COLOURS.ink;
      g.lineWidth = 1;
      g.fillRect(px - w / 2, pz - size * 0.75, w, size * 1.5);
      g.strokeRect(px - w / 2, pz - size * 0.75, w, size * 1.5);
    } else {
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.strokeText(text, px, pz);
    }
    g.fillStyle = COLOURS.ink;
    g.fillText(text, px, pz);
  }

  function drawStreetNames() {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const l of labels) {
      const size = Math.min(16, l.half * 1.9 * ppu);
      if (size < 7 || sx(l.x) < -100 || sx(l.x) > W + 100 || sz(l.z) < -100 || sz(l.z) > Hh + 100) continue;
      g.font = `600 ${size}px Georgia, serif`;
      if (g.measureText(l.text).width > l.length * ppu * 0.9) continue;
      g.save();
      g.translate(sx(l.x), sz(l.z));
      g.rotate(l.angle);
      g.fillStyle = '#7c6f5c';
      g.fillText(l.text, 0, 0);
      g.restore();
    }
  }

  function drawRider(r) {
    if (sx(r.x) < -20 || sx(r.x) > W + 20 || sz(r.z) < -20 || sz(r.z) > Hh + 20) return;
    dot(r.x, r.z, 0.45, '#2c3a5a');
  }

  function drawHero() {
    const h = game.state.hero;
    const R = Math.max(7, 0.9 * ppu);
    g.save();
    g.translate(sx(h.x), sz(h.z));
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath();
    g.arc(2, 3, R, 0, 2 * Math.PI);
    g.fill();
    g.rotate(Math.atan2(Math.cos(h.heading), Math.sin(h.heading))); // heading 0 faces south (down the screen)
    g.fillStyle = COLOURS.hero;
    g.strokeStyle = '#fff';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(0, 0, R, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(R * 0.75, 0);
    g.lineTo(-R * 0.35, -R * 0.45);
    g.lineTo(-R * 0.35, R * 0.45);
    g.closePath();
    g.fill();
    g.restore();
  }

  return {
    name: 'flat',
    build(nearIds) { for (const id of nearIds) near.add(id); },
    start(step) {
      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        step(dt);
        const h = game.state.hero;
        const k = 1 - Math.exp(-FOLLOW * dt);
        view.x += (h.x - view.x) * k;
        view.z += (h.z - view.z) * k;
        if (view.t < 1) {
          view.t = Math.min(1, view.t + dt / EASE);
          const e = view.t * view.t * (3 - 2 * view.t);
          view.across = view.from + (view.to - view.from) * e;
        }
        ppu = W / view.across;
        game.state.view.yaw = 0; // north is always up
        draw();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      // for captures: step the game by hand and draw (no real-time loop needed)
      window.__flat = { step(sec, fps = 60) { for (let i = 0; i < Math.round(sec * fps); i++) step(1 / fps); const h = game.state.hero; view.x = h.x; view.z = h.z; view.across = view.to; view.t = 1; ppu = W / view.across; draw(); } };
    },
    near({ came, went }) {
      for (const id of came) near.add(id);
      for (const id of went) near.delete(id);
    },
    zoom(mode, { instant = false } = {}) {
      view.from = view.across;
      view.to = ZOOMS[mode].across;
      view.t = instant ? 1 : 0;
      if (instant) view.across = view.to;
    },
  };
}

/** Where to print street names: the middle of each named street's straight stretches long enough for the name. */
function streetLabels(streets) {
  const out = [];
  const seen = new Map();
  for (const s of streets) {
    if (!s.name || s.width < 5) continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 12) continue;
      const x = (a[0] + b[0]) / 2;
      const z = (a[1] + b[1]) / 2;
      const others = seen.get(s.name) ?? [];
      if (others.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 30)) continue;
      others.push([x, z]);
      seen.set(s.name, others);
      let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      out.push({ text: s.name, x, z, angle, length, half: s.half });
    }
  }
  return out;
}
