/**
 * Ground layer: the neighbourhood outside the walls, and the context beyond the walkable area.
 *   1. the context ring (flat: parks, water, streets, roofs), then a paper-coloured veil over it, so you can see where
 *      the walkable area ends
 *   2. the walkable area: parks and play areas, streets (pavement, kerb, asphalt, dashed centre line, grit), every
 *      block's roof (a near block stands up over its own print)
 *   3. street names along every named street, repeated along long ones
 * See world/ground.js for the drawing context `k`.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { PALETTE as C } from '../settings.js';
import { besideSegment } from '../../../core/map/math.js';

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
const NONE = 'rgba(0,0,0,0)';
/** Streets at least this wide (m) are drawn as roads with kerbs; narrower ones as footway strips. */
const ROAD_MIN_WIDTH = 5;

/** How strongly the context beyond the walkable area is veiled (0 = not at all). */
const CONTEXT_VEIL = 0.32;
/** Street names: repeated every this many units along a street, and never closer than this to the same name. */
const NAME_REPEAT = 34;

/** @param map game.map: its overview (beyond the play area) and the loaded tiles' features (inside it) */
export function printNeighbourhoodGround(k, map) {
  const REGION = map.region;
  const byWidth = (a, b) => a.width - b.width;
  const context = map.overview;
  const contextRoads = context.streets.filter((s) => s.width >= ROAD_MIN_WIDTH).sort(byWidth);
  // the overview, printed only outside the play area (inside it the tiles' finer outlines are printed instead)
  k.g.save();
  clipOutside(k, REGION);
  printAreas(k, context.areas);
  printStreets(k, contextRoads, context.streets.filter((s) => s.width < ROAD_MIN_WIDTH));
  printBuildings(k, context.buildings);
  k.g.restore();
  veilOutside(k, REGION);

  const streets = map.features('streets');
  const roads = streets.filter((s) => s.width >= ROAD_MIN_WIDTH).sort(byWidth);
  printAreas(k, map.features('areas'));
  printSandpits(k, map);
  printStreets(k, roads, streets.filter((s) => s.width < ROAD_MIN_WIDTH));
  printBuildings(k, map.features('buildings').map((b) => b.pts));
  printStreetNames(k, [...roads, ...contextRoads.filter((s) => !s.pts.every(([x, z]) => inside(REGION, x, z)))]);
}

const inside = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** Clip drawing to everything outside the rectangle (a little inside its edge, so the two prints meet). */
function clipOutside({ g, X, Z, W, H }, r) {
  const m = 2; // units of overlap
  g.beginPath();
  g.rect(0, 0, W, H);
  g.moveTo(X(r.x0 + m), Z(r.z0 + m));
  g.lineTo(X(r.x0 + m), Z(r.z1 - m));
  g.lineTo(X(r.x1 - m), Z(r.z1 - m));
  g.lineTo(X(r.x1 - m), Z(r.z0 + m));
  g.closePath();
  g.clip('evenodd');
}

/** A paper-coloured veil over everything outside the walkable area. */
function veilOutside({ g, X, Z, W, H }, r) {
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H);
  g.moveTo(X(r.x0), Z(r.z0));
  g.lineTo(X(r.x0), Z(r.z1));
  g.lineTo(X(r.x1), Z(r.z1));
  g.lineTo(X(r.x1), Z(r.z0));
  g.closePath();
  g.fillStyle = `rgba(239, 232, 214, ${CONTEXT_VEIL})`;
  g.fill('evenodd');
  g.restore();
}

/** Trace a polygon as the current canvas path. */
function tracePolygon({ g, X, Z }, pts) {
  g.beginPath();
  pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
  g.closePath();
}

function printAreas(k, areas) {
  const { g, ppu, torn } = k;
  for (const kind of Object.keys(AREA_COLOURS)) {
    for (const a of areas) if (a.kind === kind) torn(a.pts, AREA_COLOURS[kind]);
  }
  // white lines round ball pitches
  for (const a of areas) {
    if (a.kind !== 'pitch') continue;
    tracePolygon(k, a.pts);
    g.strokeStyle = 'rgba(250,246,232,0.8)';
    g.lineWidth = 0.12 * ppu;
    g.stroke();
  }
}

function printSandpits({ torn }, map) {
  for (const tile of map.tiles()) for (const pg of tile.plan.playgrounds) if (pg.sandpit) torn(pg.pts, SANDPIT);
}

function printStreets(k, roads, footways) {
  const { g, ppu, X, Z, rnd, torn, bandOf, line } = k;
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

/** @param footprints polygons (units) */
function printBuildings(k, footprints) {
  const { g, ppu, torn } = k;
  // a soft shadow under every footprint, offset down and right like the key light
  for (const pts of footprints) {
    g.save();
    g.translate(0.35 * ppu, 0.5 * ppu);
    tracePolygon(k, pts);
    g.fillStyle = 'rgba(70,45,30,0.25)';
    g.fill();
    g.restore();
  }
  // every block is printed as its roof: the far ones stay flat, and a near one stands up over its own print
  for (const pts of footprints) {
    torn(pts, FLAT_ROOFS[roofIndex(pts[0])]);
    tracePolygon(k, pts);
    g.strokeStyle = 'rgba(60,35,25,0.45)';
    g.lineWidth = 0.08 * ppu;
    g.stroke();
  }
}

/** A stable pseudo-random roof colour from a building's first corner (same colour on every load). */
const roofIndex = ([x, z]) => Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * FLAT_ROOFS.length) % FLAT_ROOFS.length;

/**
 * Every named street gets its name printed along it: on each straight stretch long enough for the text, repeated every
 * NAME_REPEAT units, never twice close together for the same name. The text runs the right way up and is sized to the
 * street.
 */
function printStreetNames(k, roads) {
  const { g, ppu, X, Z } = k;
  const placed = new Map(); // name -> [[x, z], ...]
  for (const s of roads) {
    if (!s.name) continue;
    const text = s.name.toUpperCase();
    const size = Math.max(0.55, Math.min(s.half * 0.95, 1.15)); // units
    g.font = `bold ${size * ppu}px Georgia, serif`;
    const need = g.measureText(text).width / ppu + 1.2;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < need) continue;
      const count = Math.max(1, Math.floor(L / NAME_REPEAT));
      for (let n = 0; n < count; n++) {
        const t = (n + 0.5) / count;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const near = placed.get(s.name) ?? [];
        if (near.some(([px, pz]) => Math.hypot(px - x, pz - z) < NAME_REPEAT * 0.8)) continue;
        near.push([x, z]);
        placed.set(s.name, near);
        let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (angle > Math.PI / 2) angle -= Math.PI; // keep the text the right way up
        if (angle < -Math.PI / 2) angle += Math.PI;
        g.save();
        g.translate(X(x), Z(z));
        g.rotate(angle);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = 'rgba(250,244,230,0.85)';
        g.fillText(text, 0, 0);
        g.restore();
      }
    }
  }
}
