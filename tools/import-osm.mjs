#!/usr/bin/env node
/**
 * OpenStreetMap -> world tiles.
 *
 *   node tools/import-osm.mjs <raw-osm.json> [outDir=data/world] [--tile=100]
 *
 * Reads an OSM API / Overpass JSON export (nodes, ways, relations) and writes:
 *   outDir/manifest.json        origin, tile size, grid size, bounds, counts, source and licence
 *   outDir/streets.json         street name -> tiles it runs through (for routes and "which street is this")
 *   outDir/tiles/<i>_<j>.json   the features touching each tile, in metres from the origin
 *
 * Coordinates: metres, x east and z SOUTH of the origin (the north-west corner of the area), so z grows down the
 * screen like image rows and matches three.js ground coordinates.
 * Area-agnostic: point it at any export (a city block or "the area around my Airbnb") and it tiles that.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [input, outDir = 'data/world'] = args.filter((a) => !a.startsWith('--'));
if (!input) {
  console.error('usage: node tools/import-osm.mjs <raw-osm.json> [outDir] [--tile=100]');
  process.exit(1);
}
const TILE = Number(flags.tile ?? 100);

// ---- read ------------------------------------------------------------------------------------------------------------
const raw = JSON.parse(readFileSync(input, 'utf8'));
const nodes = new Map();
const ways = new Map();
const relations = [];
for (const e of raw.elements) {
  if (e.type === 'node') nodes.set(e.id, e);
  else if (e.type === 'way') ways.set(e.id, e);
  else if (e.type === 'relation') relations.push(e);
}

// projection: equirectangular around the area's centre (error < 1 m at this size)
const [W, S, E, N] = raw.bbox ?? bboxOfNodes();
const lat0 = (S + N) / 2;
const KX = 111320 * Math.cos((lat0 * Math.PI) / 180);
const KZ = 110574;
const project = (lon, lat) => [round1((lon - W) * KX), round1((N - lat) * KZ)];
const round1 = (v) => Math.round(v * 10) / 10;
const width = (E - W) * KX;
const depth = (N - S) * KZ;
const NX = Math.ceil(width / TILE);
const NZ = Math.ceil(depth / TILE);

function bboxOfNodes() {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const nd of nodes.values()) { w = Math.min(w, nd.lon); e = Math.max(e, nd.lon); s = Math.min(s, nd.lat); n = Math.max(n, nd.lat); }
  return [w, s, e, n];
}

const wayPoints = (way) => way.nodes.map((id) => nodes.get(id)).filter(Boolean).map((nd) => project(nd.lon, nd.lat));
const isClosed = (way) => way.nodes.length > 3 && way.nodes[0] === way.nodes[way.nodes.length - 1];

/** Join a relation's outer member ways into rings (members may be split into several ways, in any direction). */
function assembleRings(rel, role = 'outer') {
  const parts = rel.members.filter((m) => m.type === 'way' && (m.role || 'outer') === role).map((m) => ways.get(m.ref)).filter(Boolean).map((w) => w.nodes.slice());
  const rings = [];
  while (parts.length) {
    let ring = parts.shift();
    let grew = true;
    while (ring[0] !== ring[ring.length - 1] && grew) {
      grew = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const end = ring[ring.length - 1];
        if (p[0] === end) ring = ring.concat(p.slice(1));
        else if (p[p.length - 1] === end) ring = ring.concat(p.slice().reverse().slice(1));
        else if (p[p.length - 1] === ring[0]) ring = p.concat(ring.slice(1));
        else if (p[0] === ring[0]) ring = p.slice().reverse().concat(ring.slice(1));
        else continue;
        parts.splice(i, 1);
        grew = true;
        break;
      }
    }
    const pts = ring.map((id) => nodes.get(id)).filter(Boolean).map((nd) => project(nd.lon, nd.lat));
    if (pts.length >= 4) rings.push({ pts, closed: ring[0] === ring[ring.length - 1] });
  }
  return rings;
}

// ---- classify ---------------------------------------------------------------------------------------------------------
const STREET_WIDTH = { primary: 14, secondary: 12, tertiary: 11, tertiary_link: 8, residential: 8, unclassified: 8, living_street: 6, service: 5, pedestrian: 6, busway: 7, cycleway: 3, footway: 2.5, path: 2, steps: 2.5, track: 3 };
const AREA_KIND = (t) =>
  t.natural === 'water' || t.water || t.landuse === 'basin' ? 'water'
    : t.landuse === 'cemetery' || t.amenity === 'grave_yard' ? 'cemetery'
    : t.leisure === 'playground' ? 'playground'
    : t.leisure === 'pitch' ? 'pitch'
    : t.leisure === 'park' ? 'park'
    : t.leisure === 'garden' ? 'garden'
    : t.landuse === 'grass' || t.landuse === 'meadow' ? 'grass'
    : t.landuse === 'forest' || t.natural === 'wood' ? 'wood'
    : t.natural === 'scrub' ? 'scrub'
    : t.landuse === 'flowerbed' ? 'flowerbed'
    : t.highway === 'pedestrian' && t.area === 'yes' ? 'square'
    : t.place === 'square' ? 'square'
    : t.amenity === 'parking' ? 'parking'
    : t.amenity === 'school' || t.amenity === 'kindergarten' ? 'schoolyard'
    : null;
const POI_CATEGORY = (t) => {
  if (t.tourism === 'artwork' || t.tourism === 'museum' || t.tourism === 'gallery' || t.amenity === 'theatre' || t.amenity === 'cinema' || t.amenity === 'arts_centre' || t.amenity === 'music_venue') return 'culture';
  if (t.historic) return 'history';
  if (['cafe', 'restaurant', 'fast_food', 'bar', 'pub', 'ice_cream', 'bakery'].includes(t.amenity) || ['bakery', 'butcher', 'greengrocer', 'deli', 'coffee', 'confectionery'].includes(t.shop)) return 'food';
  if (t.leisure === 'playground' || t.leisure === 'pitch' || t.leisure === 'sports_centre') return 'play';
  if (['library', 'school', 'kindergarten', 'community_centre', 'place_of_worship', 'toilets', 'drinking_water', 'post_office', 'pharmacy', 'townhall'].includes(t.amenity) || t.railway === 'station' || t.public_transport === 'station' || t.highway === 'bus_stop' || t.railway === 'subway_entrance') return 'everyday';
  if (t.shop) return 'shop';
  if (t.leisure === 'park' || t.natural) return 'nature';
  return null;
};
const PROP = (t) => (t.amenity === 'bench' ? 'bench' : t.amenity === 'bicycle_parking' ? 'bikes' : t.highway === 'street_lamp' ? 'lamp' : t.amenity === 'waste_basket' ? 'bin' : t.leisure === 'picnic_table' ? 'picnic' : t.amenity === 'drinking_water' || t.man_made === 'water_tap' ? 'tap'
  : t.playground ? `play:${t.playground}` // equipment inside a playground: swing, slide, structure, sandpit, springy...
  : t.highway === 'crossing' || t.footway === 'crossing' ? `crossing:${t.crossing ?? 'marked'}` // zebra, traffic_signals, uncontrolled...
  : t.highway === 'traffic_signals' ? 'signals'
  : t.highway === 'bus_stop' ? 'bus-stop'
  : null);
/**
 * Props mapped as small areas or lines (a bike-parking strip, a swing frame): kept as a point at their middle, with
 * the direction and length of their long side, [x, z, kind, angle, length].
 */
const AREA_PROP = (t) => (t.amenity === 'bicycle_parking' ? 'bikes' : t.playground ? `play:${t.playground}` : t.amenity === 'bench' ? 'bench' : t.leisure === 'picnic_table' ? 'picnic' : null);
const KEEP_TAGS = ['amenity', 'shop', 'tourism', 'historic', 'leisure', 'cuisine', 'opening_hours', 'website', 'wikipedia', 'wikidata', 'addr:street', 'addr:housenumber', 'start_date', 'description', 'name:en', 'artist_name'];
const pick = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => KEEP_TAGS.includes(k)));

const features = { streets: [], buildings: [], areas: [], barriers: [], trees: [], pois: [], props: [] };
const usedAsMember = new Set();
for (const rel of relations) for (const m of rel.members ?? []) if (m.type === 'way') usedAsMember.add(m.ref);

for (const way of ways.values()) {
  const t = way.tags ?? {};
  const pts = wayPoints(way);
  if (pts.length < 2) continue;
  if (t.building || t['building:part']) {
    if (!isClosed(way)) continue;
    features.buildings.push({ id: `w${way.id}`, pts, levels: num(t['building:levels']), height: num(t.height), kind: t.building ?? 'part', name: t.name, addr: addr(t) });
  } else if (AREA_KIND(t) && isClosed(way)) {
    features.areas.push({ id: `w${way.id}`, kind: AREA_KIND(t), name: t.name, sport: t.sport, surface: t.surface, of: AREA_KIND(t) === 'schoolyard' ? t.amenity : undefined, pts });
  } else if (t.highway && STREET_WIDTH[t.highway] !== undefined) {
    features.streets.push({ id: `w${way.id}`, kind: t.highway, name: t.name, width: STREET_WIDTH[t.highway], surface: t.surface, oneway: t.oneway === 'yes' || undefined, pts });
  } else if (t.barrier && ['wall', 'fence', 'hedge', 'retaining_wall', 'city_wall'].includes(t.barrier)) {
    features.barriers.push({ id: `w${way.id}`, kind: t.barrier, pts });
  } else if (t.natural === 'tree_row') {
    for (const p of pts) features.trees.push(p);
  } else if (AREA_PROP(t)) {
    const c = centroid(pts);
    const [angle, length] = longSide(pts);
    features.props.push([c[0], c[1], AREA_PROP(t), angle, length]);
  } else if (t.railway === 'subway') {
    // underground: skip
  }
  const category = t.name ? POI_CATEGORY(t) : null;
  if (category && (t.building || AREA_KIND(t) || t.amenity || t.shop || t.tourism)) {
    const c = centroid(pts);
    features.pois.push({ id: `w${way.id}`, x: c[0], z: c[1], name: t.name, category, tags: pick(t) });
  }
}
for (const rel of relations) {
  const t = rel.tags ?? {};
  if (t.type !== 'multipolygon') continue;
  const rings = assembleRings(rel);
  for (const [k, ring] of rings.entries()) {
    const id = `r${rel.id}${rings.length > 1 ? `-${k}` : ''}`;
    if (t.building) features.buildings.push({ id, pts: ring.pts, levels: num(t['building:levels']), height: num(t.height), kind: t.building, name: t.name, addr: addr(t) });
    else if (AREA_KIND(t)) features.areas.push({ id, kind: AREA_KIND(t), name: t.name, sport: t.sport, of: AREA_KIND(t) === 'schoolyard' ? t.amenity : undefined, pts: ring.pts, partial: ring.closed ? undefined : true });
  }
  if (t.name && POI_CATEGORY(t) && rings.length) {
    const c = centroid(rings[0].pts);
    features.pois.push({ id: `r${rel.id}`, x: c[0], z: c[1], name: t.name, category: POI_CATEGORY(t), tags: pick(t) });
  }
}
for (const nd of nodes.values()) {
  const t = nd.tags;
  if (!t) continue;
  const [x, z] = project(nd.lon, nd.lat);
  if (t.natural === 'tree') features.trees.push([x, z]);
  const prop = PROP(t);
  if (prop) features.props.push([x, z, prop]);
  const category = POI_CATEGORY(t);
  if (category && (t.name || category === 'play' || t.amenity === 'toilets' || t.amenity === 'drinking_water')) {
    features.pois.push({ id: `n${nd.id}`, x, z, name: t.name, category, tags: pick(t) });
  }
}

/** A tag value as a number ("5", "12.5 m"), or undefined. */
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/** "Street 12" from the address tags, or undefined. */
function addr(t) {
  return t['addr:street'] ? `${t['addr:street']} ${t['addr:housenumber'] ?? ''}`.trim() : undefined;
}

/** The direction (radians, of x east and z south) and length (m) of a shape's longest side. */
function longSide(pts) {
  let best = [0, 0];
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (L > best[1]) best = [Math.round(Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) * 1000) / 1000, round1(L)];
  }
  return best;
}

/** Average of the points, rounded to 0.1 m (where an area's point of interest goes). */
function centroid(pts) {
  let x = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    z += p[1];
  }
  return [round1(x / pts.length), round1(z / pts.length)];
}

// ---- tile -------------------------------------------------------------------------------------------------------------
const key = (i, j) => `${i}_${j}`;
const tiles = new Map();
const tile = (i, j) => {
  const k = key(i, j);
  if (!tiles.has(k)) tiles.set(k, { i, j, streets: [], buildings: [], areas: [], barriers: [], trees: [], pois: [], props: [] });
  return tiles.get(k);
};
const tilesOfBox = (pts) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const out = [];
  for (let i = Math.max(0, Math.floor(x0 / TILE)); i <= Math.min(NX - 1, Math.floor(x1 / TILE)); i++) {
    for (let j = Math.max(0, Math.floor(z0 / TILE)); j <= Math.min(NZ - 1, Math.floor(z1 / TILE)); j++) out.push([i, j]);
  }
  return out;
};
const inGrid = (x, z) => x >= 0 && z >= 0 && x < NX * TILE && z < NZ * TILE;
// a big feature (a lake, a park) is listed in every tile its bounding box touches; the core de-duplicates by id
for (const kind of ['streets', 'buildings', 'areas', 'barriers']) {
  for (const f of features[kind]) for (const [i, j] of tilesOfBox(f.pts)) tile(i, j)[kind].push(f);
}
for (const p of features.trees) if (inGrid(...p)) tile(Math.floor(p[0] / TILE), Math.floor(p[1] / TILE)).trees.push(p);
for (const p of features.props) if (inGrid(p[0], p[1])) tile(Math.floor(p[0] / TILE), Math.floor(p[1] / TILE)).props.push(p);
for (const p of features.pois) if (inGrid(p.x, p.z)) tile(Math.floor(p.x / TILE), Math.floor(p.z / TILE)).pois.push(p);

// street index: name -> tiles (and the street's kind)
const streetIndex = {};
for (const s of features.streets) {
  if (!s.name) continue;
  const entry = (streetIndex[s.name] ??= { kinds: [], tiles: [] });
  if (!entry.kinds.includes(s.kind)) entry.kinds.push(s.kind);
  for (const [i, j] of tilesOfBox(s.pts)) if (!entry.tiles.includes(key(i, j))) entry.tiles.push(key(i, j));
}

// ---- write ------------------------------------------------------------------------------------------------------------
rmSync(join(outDir, 'tiles'), { recursive: true, force: true });
mkdirSync(join(outDir, 'tiles'), { recursive: true });
let bytes = 0;
for (const [k, t] of tiles) {
  const s = JSON.stringify(t);
  bytes += s.length;
  writeFileSync(join(outDir, 'tiles', `${k}.json`), s);
}
const manifest = {
  format: 'norrebro-explorer/world@1',
  source: { generator: raw.generator, fetched: raw.fetched, licence: 'Map data © OpenStreetMap contributors, ODbL 1.0', input },
  origin: { lon: W, lat: N, note: 'north-west corner; x metres east, z metres south' },
  bboxLonLat: [W, S, E, N],
  tileSize: TILE,
  grid: { nx: NX, nz: NZ },
  size: { width: round1(width), depth: round1(depth) },
  tiles: [...tiles.keys()].sort(),
  counts: Object.fromEntries(Object.entries(features).map(([k, v]) => [k, v.length])),
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(outDir, 'streets.json'), JSON.stringify(streetIndex, null, 1));
console.log(`world: ${NX}x${NZ} tiles of ${TILE} m (${manifest.size.width} x ${manifest.size.depth} m), ${tiles.size} tiles written, ${(bytes / 1024).toFixed(0)} KB`);
console.log('counts:', manifest.counts);
console.log('streets named:', Object.keys(streetIndex).length);
