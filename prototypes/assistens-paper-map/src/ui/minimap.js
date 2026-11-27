/**
 * The minimap, bottom right: north always up, about 600 m across, centred on the walker.
 *   - you are here: an arrow pointing the way you walk
 *   - home: a little house (HOME in config.js); at the rim with its distance when it is off the map
 *   - landmarks: churches and parks by name; places beyond the map (the lakes, Superkilen) as arrows on the rim
 *   - the edge of the walkable area as a dashed line
 *   - a compass rose (N Ø S V, Danish first) turned the way the 3D view is turned, so north on screen is easy to find
 * Click it to switch between the walking view and the map view.
 *
 * It reads only game.map and game.state, so it works with every style.
 * The streets, parks and roofs come from the world's overview (the whole imported area, so no tile has to be loaded),
 * drawn once into a large off-screen canvas; each update only crops and decorates it.
 */
import { HOME, SCALE } from '../config.js';
import { isCaptureMode, createOverlay } from './overlay.js';

const SIZE = 210; // css px
const SPAN = 120; // units across the map (600 m)
const BASE_PPU = 4; // pixels per unit in the off-screen base map
const UPDATE_EVERY = 0.1; // seconds
const PATH = '#efe4c8';

const AREA_FILL = { water: '#9cc3d5', park: '#b9cf95', grass: '#c3d5a2', garden: '#b5cd96', pitch: '#a7c98f', playground: '#e6cf92', cemetery: '#aac58e', square: '#e4ddcb', wood: '#9dbb83', scrub: '#acc290', schoolyard: '#e6dcc4', parking: '#d9d4c8', flowerbed: '#d9b3c0', forecourt: '#ddd2b8' };

/** The static map: the overview and the sites, in a canvas covering the whole imported area. */
function drawBase(map) {
  const b = map.bounds;
  const { overview } = map;
  const W = Math.ceil((b.x1 - b.x0) * BASE_PPU);
  const H = Math.ceil((b.z1 - b.z0) * BASE_PPU);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const X = (x) => (x - b.x0) * BASE_PPU;
  const Z = (z) => (z - b.z0) * BASE_PPU;
  const poly = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.closePath(); };
  const line = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); };

  g.fillStyle = '#efe7d4';
  g.fillRect(0, 0, W, H);
  for (const a of overview.areas) { g.fillStyle = AREA_FILL[a.kind] ?? '#e2dccb'; poly(a.pts); g.fill(); }
  for (const site of map.sites) for (const a of site.ground.areas) { g.fillStyle = AREA_FILL[a.kind] ?? AREA_FILL.cemetery; poly(a.pts); g.fill(); }
  g.fillStyle = '#d8c3ad';
  for (const pts of overview.buildings) { poly(pts); g.fill(); }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const s of overview.streets) {
    const road = s.width >= 5;
    g.strokeStyle = road ? '#ffffff' : '#f6f0e2';
    g.lineWidth = Math.max(1.2, s.half * 2 * BASE_PPU * (road ? 1 : 0.7));
    line(s.pts);
    g.stroke();
  }
  g.strokeStyle = PATH;
  for (const site of map.sites) for (const p of site.ground.paths) { g.lineWidth = Math.max(1, p.half * 2 * BASE_PPU); line(p.pts); g.stroke(); }
  return { cv, X, Z };
}

export function attachMinimap(game) {
  if (isCaptureMode()) return;
  const wrap = createOverlay('minimap visible');
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = `${SIZE}px`;
  canvas.style.height = `${SIZE}px`;
  wrap.appendChild(canvas);
  wrap.title = 'Kort · Map: click to switch views (Z)';
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.addEventListener('click', (e) => { e.stopPropagation(); game.toggleZoom(); });

  const base = drawBase(game.map);
  const REGION = game.map.region;
  const { named: NAMED_PLACES, far: FAR } = game.map.landmarks;
  const g = canvas.getContext('2d');
  const k = SIZE / SPAN; // css px per unit
  let since = Infinity;

  function rimPoint(dx, dz, r) {
    const L = Math.hypot(dx, dz) || 1;
    return [SIZE / 2 + (dx / L) * r, SIZE / 2 + (dz / L) * r];
  }

  function draw() {
    const p = game.state.hero;
    const toScreen = (x, z) => [SIZE / 2 + (x - p.x) * k, SIZE / 2 + (z - p.z) * k];
    const inView = (sx, sy) => Math.hypot(sx - SIZE / 2, sy - SIZE / 2) < SIZE / 2 - 12;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    g.save();
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, 2 * Math.PI);
    g.clip();
    // the base map, cropped round the walker
    const sx = base.X(p.x - SPAN / 2);
    const sy = base.Z(p.z - SPAN / 2);
    g.fillStyle = '#e6dcc6';
    g.fillRect(0, 0, SIZE, SIZE);
    g.drawImage(base.cv, sx, sy, SPAN * BASE_PPU, SPAN * BASE_PPU, 0, 0, SIZE, SIZE);
    // outside the walkable area: veiled; its edge dashed
    const [rx0, rz0] = toScreen(REGION.x0, REGION.z0);
    const [rx1, rz1] = toScreen(REGION.x1, REGION.z1);
    g.fillStyle = 'rgba(239,232,214,0.45)';
    g.beginPath();
    g.rect(0, 0, SIZE, SIZE);
    g.rect(rx0, rz0, rx1 - rx0, rz1 - rz0);
    g.fill('evenodd');
    g.setLineDash([4, 3]);
    g.strokeStyle = 'rgba(90,60,40,0.6)';
    g.lineWidth = 1;
    g.strokeRect(rx0, rz0, rx1 - rx0, rz1 - rz0);
    g.setLineDash([]);

    // landmarks
    g.font = '600 10px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    for (const l of NAMED_PLACES) {
      const [lx, ly] = toScreen(l.x, l.z);
      if (!inView(lx, ly)) continue;
      if (l.kind === 'church') {
        g.fillStyle = '#6f9a86'; // a little copper spire
        g.beginPath();
        g.moveTo(lx, ly - 7);
        g.lineTo(lx + 3.5, ly + 3);
        g.lineTo(lx - 3.5, ly + 3);
        g.closePath();
        g.fill();
      } else {
        g.fillStyle = '#c4523a';
        g.beginPath();
        g.arc(lx, ly, 3, 0, 2 * Math.PI);
        g.fill();
      }
      label(l.name, lx, ly + 13);
    }

    // home: a little house, or an arrow on the rim with the distance
    const [hx, hy] = toScreen(HOME.at[0], HOME.at[1]);
    if (inView(hx, hy)) house(hx, hy);
    else {
      const [ex, ey] = rimPoint(hx - SIZE / 2, hy - SIZE / 2, SIZE / 2 - 14);
      house(ex, ey);
      label(`${HOME.label} ${metres(Math.hypot(HOME.at[0] - p.x, HOME.at[1] - p.z))}`, ex, ey + 15);
    }

    // places beyond the map: arrows on the rim
    for (const f of FAR) {
      const [tx, tz] = f.pointFrom(p.x, p.z);
      const [fx, fy] = toScreen(tx, tz);
      if (inView(fx, fy)) { label(f.name, fx, fy); continue; }
      const [ax, ay] = rimPoint(fx - SIZE / 2, fy - SIZE / 2, SIZE / 2 - 10);
      const ang = Math.atan2(fy - SIZE / 2, fx - SIZE / 2);
      g.save();
      g.translate(ax, ay);
      g.rotate(ang);
      g.fillStyle = '#2c3a5a';
      g.beginPath();
      g.moveTo(7, 0);
      g.lineTo(-4, -5);
      g.lineTo(-4, 5);
      g.closePath();
      g.fill();
      g.restore();
      const [lx, ly] = rimPoint(fx - SIZE / 2, fy - SIZE / 2, SIZE / 2 - 30);
      label(`${f.name} ${metres(Math.hypot(tx - p.x, tz - p.z))}`, lx, ly + 3);
    }

    // you are here: an arrow along the walker's heading (he faces +z at heading 0; north is up, so +z is down)
    const h = game.state.hero.heading;
    g.save();
    g.translate(SIZE / 2, SIZE / 2);
    g.rotate(Math.atan2(Math.cos(h), Math.sin(h)));
    g.fillStyle = '#c4523a';
    g.strokeStyle = '#fbfaf6';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(-6, -6);
    g.lineTo(-3, 0);
    g.lineTo(-6, 6);
    g.closePath();
    g.stroke();
    g.fill();
    g.restore();
    g.restore();

    // the rim and the compass rose, turned with the 3D view (camera yaw: north is that far round from straight up)
    g.strokeStyle = '#2e241c';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, 2 * Math.PI);
    g.stroke();
    compass(24, 24, (game.state.view.yaw * Math.PI) / 180);
  }

  function label(text, x, y) {
    g.font = '600 10px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(251,250,246,0.9)';
    g.strokeText(text, x, y);
    g.fillStyle = '#2e241c';
    g.fillText(text, x, y);
  }

  function house(x, y) {
    g.fillStyle = '#2f5d50';
    g.strokeStyle = '#fbfaf6';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, y - 8);
    g.lineTo(x + 7, y - 2);
    g.lineTo(x + 5, y - 2);
    g.lineTo(x + 5, y + 5);
    g.lineTo(x - 5, y + 5);
    g.lineTo(x - 5, y - 2);
    g.lineTo(x - 7, y - 2);
    g.closePath();
    g.stroke();
    g.fill();
  }

  function compass(x, y, yaw) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(251,250,246,0.95)';
    g.strokeStyle = '#2e241c';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, 17, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
    g.rotate(yaw);
    g.fillStyle = '#c4523a'; // the north needle
    g.beginPath();
    g.moveTo(0, -8.5);
    g.lineTo(3, 0);
    g.lineTo(-3, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#8a8478';
    g.beginPath();
    g.moveTo(0, 8.5);
    g.lineTo(3, 0);
    g.lineTo(-3, 0);
    g.closePath();
    g.fill();
    g.font = '700 8px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#2e241c';
    for (const [t, a] of [['N', 0], ['Ø', 90], ['S', 180], ['V', 270]]) {
      const r = (a * Math.PI) / 180;
      g.save();
      g.translate(Math.sin(r) * 13.5, -Math.cos(r) * 13.5);
      g.rotate(-yaw);
      g.fillStyle = t === 'N' ? '#c4523a' : '#2e241c';
      g.fillText(t, 0, 0);
      g.restore();
    }
    g.restore();
  }

  game.onFrame((state, dt) => {
    since += dt;
    if (since < UPDATE_EVERY) return;
    since = 0;
    draw();
  });
}

/** "350 m" / "1,2 km" (Danish decimal comma). */
function metres(units) {
  const m = units / SCALE;
  return m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
