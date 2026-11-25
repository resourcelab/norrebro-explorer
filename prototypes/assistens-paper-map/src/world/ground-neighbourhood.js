/**
 * Ground layer: the neighbourhood outside the walls. Parks and play areas, then streets (pavement, kerb, asphalt,
 * dashed centre line, grit), then building footprints (flat roofs for the far blocks, a dark base under the folded
 * ones), then street names printed along each street's longest straight stretch.
 * See world/ground.js for the drawing context `k`.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { PALETTE as C } from '../config.js';
import { besideSegment } from '../map/math.js';
import { STREETS, AREAS, BUILDINGS } from '../map/neighbourhood.js';

/** Area fills, and the order they are laid down in (later ones on top). */
const AREA_COLOURS = {
  parking: '#cfc8b6', schoolyard: '#e0d5bc', square: '#ddd3bb', park: '#b9bf8e', grass: '#bfc493', garden: '#b4bc88',
  pitch: '#a9b97f', playground: '#e2cf9c', flowerbed: '#d7b3a6', water: '#9fbfc6',
};
const SANDPIT = '#e6d29e';
const PAVEMENT = '#e2d9c4';
const FOOTWAY = '#e9dfc7';
const CYCLEWAY = '#d6d4cc';
const PEDESTRIAN_STREET = '#d9cfb8';
const FLAT_ROOFS = ['#a8735e', '#8f8e8a', '#9a6a58', '#b89a72', '#9b8f85'];
const RAISED_BASE = '#6a5446';
const NONE = 'rgba(0,0,0,0)';
/** Streets at least this wide (m) are drawn as roads with kerbs; narrower ones as footway strips. */
const ROAD_MIN_WIDTH = 5;

export function printNeighbourhoodGround(k, plan) {
  printAreas(k, plan);
  const roads = STREETS.filter((s) => s.width >= ROAD_MIN_WIDTH).sort((a, b) => a.width - b.width);
  printStreets(k, roads);
  printBuildings(k);
  printStreetNames(k, roads);
}

/** Trace a polygon as the current canvas path. */
function tracePolygon({ g, X, Z }, pts) {
  g.beginPath();
  pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
  g.closePath();
}

function printAreas(k, plan) {
  const { g, ppu, torn } = k;
  for (const kind of Object.keys(AREA_COLOURS)) {
    for (const a of AREAS) if (a.kind === kind) torn(a.pts, AREA_COLOURS[kind]);
  }
  // white lines round ball pitches
  for (const a of AREAS) {
    if (a.kind !== 'pitch') continue;
    tracePolygon(k, a.pts);
    g.strokeStyle = 'rgba(250,246,232,0.8)';
    g.lineWidth = 0.12 * ppu;
    g.stroke();
  }
  for (const pg of plan.playgrounds) if (pg.sandpit) torn(pg.pts, SANDPIT);
}

function printStreets(k, roads) {
  const { g, ppu, X, Z, rnd, torn, bandOf, line } = k;
  const footways = STREETS.filter((s) => s.width < ROAD_MIN_WIDTH);
  for (const s of roads) torn(bandOf(s.pts, s.half + 0.7), PAVEMENT, NONE);
  for (const s of footways) torn(bandOf(s.pts, Math.max(0.3, s.half)), s.kind === 'cycleway' ? CYCLEWAY : FOOTWAY, NONE);
  for (const s of roads) torn(bandOf(s.pts, s.half + 0.06), P2.shade(C.street, -0.25), NONE); // the kerb
  for (const s of roads) torn(bandOf(s.pts, s.half), s.kind === 'pedestrian' ? PEDESTRIAN_STREET : C.street, NONE);

  // dashed centre line on the wide streets
  g.setLineDash([0.9 * ppu, 0.9 * ppu]);
  for (const s of roads) if (s.width >= 10) line(s.pts, 0.1, 'rgba(250,244,230,0.75)');
  g.setLineDash([]);

  // grit: six specks per unit of street length, dark and light
  for (const s of roads) {
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let n = 0; n < L * 6; n++) {
        const [x, z] = besideSegment(a, b, rnd(), (rnd() - 0.5) * 2 * s.half);
        g.fillStyle = rnd() < 0.5 ? 'rgba(60,55,50,0.25)' : 'rgba(240,235,225,0.3)';
        g.fillRect(X(x), Z(z), 2, 2);
      }
    }
  }
}

function printBuildings(k) {
  const { g, ppu, torn } = k;
  // a soft shadow under every footprint, offset down and right like the key light
  for (const b of BUILDINGS) {
    g.save();
    g.translate(0.35 * ppu, 0.5 * ppu);
    tracePolygon(k, b.pts);
    g.fillStyle = 'rgba(70,45,30,0.25)';
    g.fill();
    g.restore();
  }
  for (const b of BUILDINGS) {
    if (b.raised) {
      torn(b.pts, RAISED_BASE); // under a folded block: only shows through gaps
      continue;
    }
    torn(b.pts, FLAT_ROOFS[roofIndex(b.pts[0])]);
    tracePolygon(k, b.pts);
    g.strokeStyle = 'rgba(60,35,25,0.45)';
    g.lineWidth = 0.08 * ppu;
    g.stroke();
  }
}

/** A stable pseudo-random roof colour from a building's first corner (same colour on every load). */
const roofIndex = ([x, z]) => Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * FLAT_ROOFS.length) % FLAT_ROOFS.length;

function printStreetNames(k, roads) {
  const { g, ppu, X, Z } = k;
  // each named street's longest straight stretch
  const longest = new Map();
  for (const s of roads) {
    if (!s.name) continue;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!longest.has(s.name) || L > longest.get(s.name).L) longest.set(s.name, { a, b, L, half: s.half });
    }
  }
  for (const [name, { a, b, L, half }] of longest) {
    const text = name.toUpperCase();
    g.font = `bold ${Math.min(half * 1.1, 1.3) * ppu}px Georgia, serif`;
    if (g.measureText(text).width > L * ppu * 0.8) continue; // doesn't fit: leave it to the street sign
    let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (angle > Math.PI / 2) angle -= Math.PI; // keep the text the right way up
    if (angle < -Math.PI / 2) angle += Math.PI;
    g.save();
    g.translate(X((a[0] + b[0]) / 2), Z((a[1] + b[1]) / 2));
    g.rotate(angle);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(250,244,230,0.8)';
    g.fillText(text, 0, 0);
    g.restore();
  }
}
