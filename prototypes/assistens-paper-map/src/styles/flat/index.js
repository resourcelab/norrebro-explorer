/**
 * The flat style: the game as a clean top-down map, drawn on a 2D canvas (no three.js). North is always up. It is
 * the second style, and the proof that the game core and the styles are apart: it implements the same interface as
 * papercraft (../README.md), reads the same things and game state, and shares no drawing code with it.
 *
 * Near and far: everything on the map is always drawn; small things (trees, graves, benches, signs...) only when near,
 * so the map view stays readable. Tiles: where a tile is loaded its outlines are drawn; everywhere else the world's
 * overview is. It pins no tiles, so it streams as you walk.
 */
import { ZOOMS } from '../../config.js';

const COLOURS = {
  paper: '#f2ede1', veil: 'rgba(242,237,225,0.5)', lawn: '#cfd8ad', park: '#bfd39b', grass: '#c9d9a8', garden: '#bcd29c',
  pitch: '#a9cf92', playground: '#f0d58f', square: '#e6dfcd', schoolyard: '#e8dfc9', parking: '#ddd8cc', wood: '#a6c48b',
  scrub: '#b3c896', flowerbed: '#e3b9c3', cemetery: '#c6d6a2', forecourt: '#ddd2b8', water: '#9ccbe0', road: '#ffffff', casing: '#c9c0ad',
  footway: '#f7f1e3', path: '#eadfc4', block: '#e0c1a3', blockEdge: '#b68b6a', far: '#e8d6c3', wall: '#d9a94a', hedge: '#6e8f55',
  tree: { linden: '#9cbf5a', chestnut: '#7fa84e', maple: '#b7c25a', beech: '#8fae55', yew: '#4f7a4f', poplar: '#a6b85e' },
  grave: '#a8a49b', notable: '#6d6a64', bench: '#7b5a3c', lamp: '#4a4a46', tap: '#4b8fb8', kit: '#e0703c', rack: '#5a6470',
  brick: '#b5523a', copper: '#5f9a86', chapel: '#c9694c', shed: '#b9a58e', ink: '#2e241c', hero: '#d6452f',
  shop: { food: '#b8432f', shop: '#2f6b62', everyday: '#2f4f7a', culture: '#6b3f6e' },
  /** Kinds this style doesn't know are drawn as a dot in their category's colour (core/kinds.js). */
  category: { building: '#c9a283', landmark: '#c4523a', barrier: '#d9a94a', tree: '#9cbf5a', monument: '#8c877d', prop: '#5a6470', animal: '#2f2d2e', sign: '#2e241c', place: '#d6452f' },
};
const EASE = 0.5; // seconds to ease between zooms
const FOLLOW = 6; // how quickly the view catches up with the walker (1/s)

export function createFlatStyle(game) {
  let stepByHand = null; // set once the loop starts (captures)
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
  const view = { x: game.state.hero.x, z: game.state.hero.z, across: ZOOMS[game.state.zoom].across, from: ZOOMS[game.state.zoom].across, to: ZOOMS[game.state.zoom].across, t: 1 };
  const map = game.map;
  const REGION = map.region;
  const boxOf = (pts) => { let x0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let z1 = -Infinity; for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } return [x0, z0, x1, z1]; };
  const withBox = (list, ptsOf) => list.map((f) => ({ f, box: boxOf(ptsOf(f)) }));
  const far = {
    areas: withBox(map.overview.areas, (a) => a.pts),
    streets: withBox([...map.overview.streets].sort((a, b) => a.width - b.width), (s) => s.pts),
    blocks: withBox(map.overview.buildings, (p) => p),
  };
  // sites (Assistens): their ground layers, drawn like any other areas and paths
  const site = {
    areas: withBox(map.sites.flatMap((s) => s.ground.areas), (a) => a.pts),
    paths: withBox(map.sites.flatMap((s) => s.ground.paths), (p) => p.pts),
  };
  let layers = null;
  let labels = [];
  let loadedRects = [];
  /** The loaded tiles' outlines, gathered again whenever tiles load or unload. */
  function gather() {
    layers = {
      areas: withBox(map.features('areas'), (a) => a.pts),
      streets: withBox(map.features('streets').sort((a, b) => a.width - b.width), (s) => s.pts),
      blocks: withBox(map.features('buildings'), (b) => b.pts),
    };
    loadedRects = map.tiles().map((t) => t.rect);
    labels = streetLabels([...map.features('streets'), ...map.overview.streets]);
  }
  map.onTiles(() => { layers = null; });

  // ---- drawing helpers (world units -> screen pixels) ----
  let ppu = 1;
  const sx = (x) => (x - view.x) * ppu + W / 2;
  const sz = (z) => (z - view.z) * ppu + Hh / 2;
  const visible = ([x0, z0, x1, z1]) => sx(x1) > -50 && sx(x0) < W + 50 && sz(z1) > -50 && sz(z0) < Hh + 50;
  const trace = (pts, close = true) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(sx(x), sz(z)) : g.moveTo(sx(x), sz(z)))); if (close) g.closePath(); };
  const dot = (x, z, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(sx(x), sz(z), Math.max(1, r * ppu), 0, 2 * Math.PI); g.fill(); };

  /** Roads, footways and areas of one layer set. */
  function drawGround(L) {
    for (const { f, box } of L.areas) if (visible(box)) { g.fillStyle = COLOURS[f.kind] ?? COLOURS.square; trace(f.pts); g.fill(); }
    for (const { f, box } of L.streets) {
      if (!visible(box)) continue;
      const road = f.width >= 5;
      g.strokeStyle = road ? COLOURS.casing : COLOURS.path;
      g.lineWidth = Math.max(1, (f.half * 2 + (road ? 0.5 : 0)) * ppu);
      trace(f.pts, false);
      g.stroke();
    }
    for (const { f, box } of L.streets) {
      if (!visible(box) || f.width < 5) continue;
      g.strokeStyle = f.kind === 'pedestrian' ? COLOURS.footway : COLOURS.road;
      g.lineWidth = Math.max(1, f.half * 2 * ppu);
      trace(f.pts, false);
      g.stroke();
    }
  }

  /** Paint on the ground: zebra crossings, pitch lines, hopscotch (the same marks the papercraft ground prints). */
  function drawMarkings() {
    const turned = (x, z, angle, fn) => { g.save(); g.translate(sx(x), sz(z)); g.rotate(angle); g.scale(ppu, ppu); fn(); g.restore(); };
    for (const tile of map.tiles()) {
      for (const c of tile.plan?.crossings ?? []) {
        if (!visible([c.x - 3, c.z - 3, c.x + 3, c.z + 3])) continue;
        turned(c.x, c.z, c.along, () => {
          g.fillStyle = '#ffffff';
          const bars = Math.max(3, Math.round(c.length / 0.18));
          for (let k = 0; k < bars; k++) g.fillRect(-0.32, -c.length / 2 + (k + 0.2) * (c.length / bars), 0.64, (c.length / bars) * 0.55);
        });
      }
      for (const h of tile.plan?.schoolyards?.hopscotch ?? []) {
        turned(h.x, h.z, h.angle, () => {
          g.lineWidth = 0.05;
          [[0, 0], [1, 0], [2, -0.5], [2, 0.5], [3, 0], [4, -0.5], [4, 0.5], [5, 0]].forEach(([u, v], n) => { g.strokeStyle = ['#9a8f7a', '#e0a33a', '#5aa0c8', '#d4537e'][n % 4]; g.strokeRect((u - 2.5) * 0.32, (v - 0.5) * 0.32, 0.32, 0.32); });
        });
      }
    }
    for (const { f, box } of layers.areas) {
      if (f.kind !== 'pitch' || !f.axis || !visible(box)) continue;
      const { x, z, angle, length, width } = f.axis;
      turned(x, z, angle, () => {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 0.06;
        g.strokeRect(-(length - 0.2) / 2, -(width - 0.2) / 2, length - 0.2, width - 0.2);
        g.beginPath(); g.moveTo(0, -(width - 0.2) / 2); g.lineTo(0, (width - 0.2) / 2); g.stroke();
        g.beginPath(); g.arc(0, 0, Math.min(width * 0.18, 1), 0, 2 * Math.PI); g.stroke();
      });
    }
  }

  function draw() {
    if (!layers) gather();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = COLOURS.paper;
    g.fillRect(0, 0, W, Hh);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    // the overview where no tile is loaded
    g.save();
    g.beginPath();
    g.rect(0, 0, W, Hh);
    for (const r of loadedRects) g.rect(sx(r.x0), sz(r.z0), (r.x1 - r.x0) * ppu, (r.z1 - r.z0) * ppu); // tiles never overlap
    g.clip('evenodd');
    drawGround(far);
    g.fillStyle = COLOURS.far;
    for (const { f, box } of far.blocks) if (visible(box)) { trace(f); g.fill(); }
    g.restore();

    drawGround(layers);
    drawMarkings();
    for (const { f, box } of site.areas.filter((a) => a.f.kind === 'cemetery')) if (visible(box)) { g.fillStyle = COLOURS.lawn; trace(f.pts); g.fill(); }
    for (const { f, box } of site.paths) {
      if (!visible(box)) continue;
      g.strokeStyle = f.surface === 'asphalt' ? COLOURS.footway : COLOURS.path;
      g.lineWidth = Math.max(1, f.half * 2 * ppu);
      trace(f.pts, false);
      g.stroke();
    }
    for (const { f, box } of site.areas.filter((a) => a.f.kind !== 'cemetery')) if (visible(box)) { g.fillStyle = COLOURS[f.kind] ?? COLOURS.square; trace(f.pts); g.fill(); }
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

    for (const t of game.things) if (near.has(t.id) || t.always) drawThing(t);
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
        dot(t.x, t.z, 1.7 * t.size, COLOURS.tree[t.species] ?? COLOURS.tree.linden);
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
      case 'playground': {
        const r = { springy: 0.35, sandpit: 0.9, roundabout: 0.55, playhouse: 0.5 }[t.equipment] ?? 0.75;
        dot(t.x, t.z, r, t.equipment === 'sandpit' ? '#e9cf8e' : COLOURS.kit);
        if (t.equipment !== 'sandpit') dot(t.x, t.z, r * 0.45, '#fff3df');
        break;
      }
      case 'sport-kit': dot(t.x, t.z, t.equipment === 'table' ? 0.5 : 0.3, t.equipment === 'hoop' ? '#e07a2a' : '#f4f1ea'); break;
      case 'flagpole': dot(t.x, t.z, 0.3, '#c8102e'); dot(t.x, t.z, 0.12, '#ffffff'); break;
      case 'fence':
        g.strokeStyle = t.style === 'hedge' ? '#5f8a48' : t.style === 'wall' ? '#b8664a' : '#3f5a44';
        g.lineWidth = Math.max(1, (t.style === 'hedge' ? 0.3 : 0.1) * ppu);
        trace([t.a, t.b], false);
        g.stroke();
        break;
      case 'bin': dot(t.x, t.z, 0.18, '#2f5a3a'); break;
      case 'picnic-table': g.fillStyle = COLOURS.bench; g.fillRect(sx(t.x) - 0.45 * ppu, sz(t.z) - 0.3 * ppu, 0.9 * ppu, 0.6 * ppu); break;
      case 'bus-stop': g.fillStyle = '#f5c400'; g.fillRect(sx(t.x) - 0.3 * ppu, sz(t.z) - 0.3 * ppu, 0.6 * ppu, 0.6 * ppu); break;
      case 'traffic-light': dot(t.x, t.z, 0.2, COLOURS.ink); dot(t.x, t.z, 0.1, '#3ac46a'); break;
      case 'crossing': break; // painted with the ground (drawMarkings)
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
      case 'shopfront': {
        // a coloured strip along the facade, and the name when you are close
        g.strokeStyle = COLOURS.shop[t.group] ?? COLOURS.shop.shop;
        g.lineWidth = Math.max(2, 0.35 * ppu);
        g.lineCap = 'butt';
        trace([t.a, t.b], false);
        g.stroke();
        g.lineCap = 'round';
        if (ppu > 30) label(t.name, t.x + Math.sin(t.yaw) * 1.1, t.z + Math.cos(t.yaw) * 1.1, 10, false, '#fffaf0');
        break;
      }
      default: // a kind this style doesn't know yet: a dot in its category's colour
        dot(t.x, t.z, 0.4, COLOURS.category[t.category] ?? COLOURS.ink);
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
    dot(r.x, r.z, 0.3, '#2c3a5a');
  }

  function drawHero() {
    const h = game.state.hero;
    const R = Math.max(7, 0.45 * ppu); // about the walker's own size (2 × life, config.js TOY): he fits under a shop sign
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
      stepByHand = (sec, fps = 60) => { for (let i = 0; i < Math.round(sec * fps); i++) step(1 / fps); const h = game.state.hero; view.x = h.x; view.z = h.z; view.across = view.to; view.t = 1; ppu = W / view.across; draw(); };
    },
    credit: '',
    hint: 'arrows / WASD walk · Shift run · Z zoom · walk up to a shop, a grave or a church',
    capture: { ready: () => stepByHand !== null, step: (sec) => stepByHand(sec), restart: () => game.reset() },
    add() {}, // things are read from game.things as they are drawn
    remove(ids) { for (const id of ids) near.delete(id); },
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
