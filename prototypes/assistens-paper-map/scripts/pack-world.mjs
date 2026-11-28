#!/usr/bin/env node
/**
 * Pack the repo's world tiles (data/world, made by tools/import-osm.mjs) into what the game loads: world/ in this
 * prototype. The source tiles keep full detail; the packed ones are what a browser needs, and no more.
 *
 *   node scripts/pack-world.mjs [source=../../data/world] [out=world]
 *
 * What it does:
 *   1. reads every source tile and drops the duplicates (a feature crossing a tile edge is listed in every tile)
 *   2. simplifies outlines and centre lines (Douglas-Peucker) and rounds to whole metres
 *   3. cuts the area into tiles again, this time with a MARGIN: a tile holds every outline or street whose box comes
 *      within MARGIN of it, so the game can plan a tile (trees clear of walls, signs at corners) from that tile alone,
 *      and get the same answer whichever tiles happen to be loaded
 *   4. writes an overview: the whole area, flat and simplified harder, for minimaps, map views and the far landscape,
 *      plus the full footprints of the landmark buildings (they stand everywhere, so they can't wait for their tile)
 *
 * Output, format "norrebro-explorer/packed@1" (metres from the area's north-west corner, x east, z south):
 *   world/manifest.json      origin, bbox, tile size, grid, margin, the tile list, source and licence
 *   world/overview.json      { bounds, streets, areas, buildings, landmarks }
 *   world/addresses.json     { street: [[house number, x, z], ...] } (rounded to half metres), for "where do you live?"
 *   world/tiles/<i>_<j>.json { i, j, buildings, streets, areas, barriers, trees, props, pois }
 *                            areas carry `sport` for pitches; barriers are fences, hedges and walls (lines);
 *                            props: [x, z, kind] or, for ones mapped as a strip, [x, z, kind, angle, length]
 *                            pois: [x, z, name, category, type] (type: bakery, cafe, hairdresser... from the OSM tags),
 *                            with the margin like the outlines; trees and props only in the tile they stand in
 *
 * Map data © OpenStreetMap contributors, ODbL 1.0.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANDMARKS } from '../src/data/landmarks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [srcArg, outArg] = process.argv.slice(2);
const SRC = srcArg ?? join(root, '..', '..', 'data', 'world');
const OUT = outArg ?? join(root, 'world');

/** Metres: an outline or street within this distance of a tile is packed into it. */
const MARGIN = 30;
/** Simplification tolerances (metres): tiles, then the overview. */
const EPS = { building: 1.2, area: 1.0, street: 0.8, overview: 2.5 };
/** What the overview keeps: the streets and areas you can see on a map (no service roads in yards, no flowerbeds). */
const OVERVIEW_STREETS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'pedestrian', 'unclassified', 'service', 'cycleway', 'busway']);
const OVERVIEW_AREAS = new Set(['water', 'park', 'grass', 'garden', 'pitch', 'playground', 'cemetery', 'square', 'wood', 'scrub']);

// ---- geometry ---------------------------------------------------------------------------------------------------------
function douglasPeucker(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, az] = pts[0];
  const [bx, bz] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, bz - az);
  let dmax = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, z] = pts[i];
    const d = L < 1e-6 ? Math.hypot(x - ax, z - az) : Math.abs((bz - az) * x - (bx - ax) * z + bx * az - bz * ax) / L;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [pts[0], pts[pts.length - 1]];
  return douglasPeucker(pts.slice(0, idx + 1), eps).slice(0, -1).concat(douglasPeucker(pts.slice(idx), eps));
}

/** A closed ring, simplified: split at the point furthest from the first, simplify both halves, rejoin (open ring). */
function simplifyRing(pts, eps) {
  const same = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const ring = same ? pts.slice(0, -1) : pts;
  if (ring.length < 4) return ring;
  let far = 0;
  let best = -1;
  ring.forEach(([x, z], i) => { const d = Math.hypot(x - ring[0][0], z - ring[0][1]); if (d > best) { best = d; far = i; } });
  const a = douglasPeucker(ring.slice(0, far + 1), eps);
  const b = douglasPeucker(ring.slice(far).concat([ring[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

const rounded = (pts) => {
  const out = [];
  for (const [x, z] of pts) {
    const p = [Math.round(x), Math.round(z)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
};
const boxOf = (pts) => {
  let x0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return [x0, z0, x1, z1];
};

// ---- read and de-duplicate -------------------------------------------------------------------------------------------
if (!existsSync(join(SRC, 'manifest.json'))) {
  console.error(`pack-world: no world tiles at ${SRC} (make them with: npm run import-osm in the repo root)`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const T = manifest.tileSize;
const { nx: NX, nz: NZ } = manifest.grid;
const seen = new Set();
const all = { buildings: [], streets: [], areas: [], barriers: [], trees: new Map(), props: [], pois: [] };
for (const key of manifest.tiles) {
  const tile = JSON.parse(readFileSync(join(SRC, 'tiles', `${key}.json`), 'utf8'));
  for (const kind of ['buildings', 'streets', 'areas', 'barriers']) {
    for (const f of tile[kind] ?? []) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      all[kind].push(f);
    }
  }
  for (const [x, z] of tile.trees) all.trees.set(`${Math.round(x)},${Math.round(z)}`, [Math.round(x), Math.round(z)]);
  for (const [x, z, kind, angle, length] of tile.props) all.props.push(angle === undefined ? [Math.round(x * 2) / 2, Math.round(z * 2) / 2, kind] : [Math.round(x * 2) / 2, Math.round(z * 2) / 2, kind, angle, length]);
  for (const p of tile.pois) {
    if (seen.has('poi:' + p.id) || !p.name) continue;
    seen.add('poi:' + p.id);
    const t = p.tags ?? {};
    const type = t.shop ?? t.amenity ?? t.craft ?? t.tourism ?? t.leisure ?? t.historic ?? null;
    all.pois.push([Math.round(p.x), Math.round(p.z), p.name, p.category, type]);
  }
}

// ---- simplify ---------------------------------------------------------------------------------------------------------
const buildings = all.buildings
  .map((b) => ({ id: b.id, pts: rounded(simplifyRing(b.pts, EPS.building)), levels: b.levels ?? null, kind: b.kind ?? null, name: b.name ?? null }))
  .filter((b) => b.pts.length >= 3);
const streets = all.streets
  .map((s) => ({ id: s.id, name: s.name ?? null, kind: s.kind, width: s.width, pts: rounded(douglasPeucker(s.pts, EPS.street)) }))
  .filter((s) => s.pts.length >= 2);
const areas = all.areas
  .map((a) => ({ id: a.id, kind: a.kind, name: a.name ?? null, ...(a.sport ? { sport: a.sport } : {}), ...(a.of ? { of: a.of } : {}), pts: rounded(simplifyRing(a.pts, EPS.area)) }))
  .filter((a) => a.pts.length >= 3);
// fences, hedges and walls: the game stands them round playgrounds, schoolyards and pitches
const barriers = all.barriers
  .filter((b) => ['fence', 'hedge', 'wall'].includes(b.kind))
  .map((b) => ({ id: b.id, kind: b.kind, pts: rounded(douglasPeucker(b.pts, EPS.street)) }))
  .filter((b) => b.pts.length >= 2);
for (const list of [buildings, streets, areas, barriers]) for (const f of list) f.box = boxOf(f.pts);

// ---- tiles, with a margin ---------------------------------------------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'tiles'), { recursive: true });
const strip = ({ box: _box, ...f }) => f;
const tiles = [];
let bytes = 0;
for (let i = 0; i < NX; i++) {
  for (let j = 0; j < NZ; j++) {
    const [x0, z0, x1, z1] = [i * T - MARGIN, j * T - MARGIN, (i + 1) * T + MARGIN, (j + 1) * T + MARGIN];
    const touches = (f) => f.box[2] >= x0 && f.box[0] <= x1 && f.box[3] >= z0 && f.box[1] <= z1;
    const owns = ([x, z]) => x >= i * T && x < (i + 1) * T && z >= j * T && z < (j + 1) * T; // points: in one tile only
    const near = ([x, z]) => x >= x0 && x <= x1 && z >= z0 && z <= z1; // within the margin
    const tile = {
      i, j,
      buildings: buildings.filter(touches).map(strip),
      streets: streets.filter(touches).map(strip),
      areas: areas.filter(touches).map(strip),
      barriers: barriers.filter(touches).map(strip),
      trees: [...all.trees.values()].filter(owns),
      props: all.props.filter(owns),
      pois: all.pois.filter(near), // with the margin: shopfronts on one block are planned together (core/plan/shops.js)
    };
    if (!tile.buildings.length && !tile.streets.length && !tile.areas.length && !tile.trees.length) continue;
    const key = `${i}_${j}`;
    const text = JSON.stringify(tile);
    bytes += text.length;
    writeFileSync(join(OUT, 'tiles', `${key}.json`), text);
    tiles.push(key);
  }
}

// ---- overview ---------------------------------------------------------------------------------------------------------
const landmarkIds = new Set(LANDMARKS.filter((l) => l.building).map((l) => l.building));
const overview = {
  bounds: [0, 0, Math.round(manifest.size.width), Math.round(manifest.size.depth)],
  streets: all.streets.filter((s) => OVERVIEW_STREETS.has(s.kind))
    .map((s) => ({ name: s.name ?? null, kind: s.kind, width: s.width, pts: rounded(douglasPeucker(s.pts, EPS.overview)) }))
    .filter((s) => s.pts.length >= 2),
  areas: all.areas.filter((a) => OVERVIEW_AREAS.has(a.kind))
    .map((a) => ({ kind: a.kind, name: a.name ?? null, pts: rounded(simplifyRing(a.pts, EPS.overview)) }))
    .filter((a) => a.pts.length >= 3),
  buildings: all.buildings.map((b) => rounded(simplifyRing(b.pts, EPS.overview))).filter((pts) => pts.length >= 3),
  landmarks: Object.fromEntries(buildings.filter((b) => landmarkIds.has(b.id)).map((b) => [b.id, b.pts])),
};
for (const id of landmarkIds) if (!overview.landmarks[id]) throw new Error(`pack-world: landmark building ${id} is not in the world tiles`);
const overviewText = JSON.stringify(overview);
writeFileSync(join(OUT, 'overview.json'), overviewText);

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
  format: 'norrebro-explorer/packed@1',
  origin: manifest.origin,
  bboxLonLat: manifest.bboxLonLat,
  tileSize: T,
  grid: manifest.grid,
  size: manifest.size,
  margin: MARGIN,
  tiles,
  source: manifest.source,
  licence: 'Map data © OpenStreetMap contributors, ODbL 1.0',
}, null, 1));

// the address points, read only when a player types where they live
const half = (v) => Math.round(v * 2) / 2;
const addressesIn = existsSync(join(SRC, 'addresses.json')) ? JSON.parse(readFileSync(join(SRC, 'addresses.json'), 'utf8')) : {};
const addresses = Object.fromEntries(Object.entries(addressesIn).map(([street, list]) => [street, list.map(([nr, x, z]) => [nr, half(x), half(z)])]));
writeFileSync(join(OUT, 'addresses.json'), JSON.stringify(addresses));

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`pack-world: ${tiles.length} tiles (${kb(bytes)}), overview ${kb(overviewText.length)} -> ${OUT.replace(root + '/', '')}/`);
