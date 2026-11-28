#!/usr/bin/env node
// Placement audit: where things stand against the map. Prints, per kind, how many stand in a building, on a road's
// carriageway, in water, on top of another solid thing, or (for play kit) outside their playground.
//   node tools/audit.mjs            (after npm run pack-world)
import { REGION } from '../src/config.js';
import { inPolygon, polylineDistance } from '../src/core/map/math.js';
import { headlessGame } from '../tests/helpers.mjs';

const ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified', 'service', 'busway']);
const { game } = await headlessGame({ pins: REGION });
const idx = game.map.store.index;
const things = game.things;
const onRoad = (x, z) => { const s = idx.nearestStreet(x, z, 3); return s && s.d < -0.15 && ROADS.has(s.street.kind) ? s.street : null; };
const report = {};
const add = (kind, issue, t) => { const r = (report[kind] ??= { n: 0 }); r[issue] = (r[issue] ?? 0) + 1; if (process.argv.includes('-v')) console.log(kind, issue, t.id, t.x.toFixed(1), t.z.toFixed(1)); };
for (const t of things) (report[t.kind] ??= { n: 0 }).n++;
const solid = things.filter((t) => t.solid);
for (const t of things) {
  if (['block', 'church', 'chapel', 'shed', 'wall', 'shopfront', 'crossing'].includes(t.kind)) continue; // crossings are on roads
  if (idx.buildingAt(t.x, t.z, 0)) add(t.kind, 'in a building', t);
  const road = onRoad(t.x, t.z);
  if (road) add(t.kind, `on a road`, t);
  if (idx.inWater(t.x, t.z)) add(t.kind, 'in water', t);
  if (t.solid) for (const o of solid) if (o !== t && o.id < t.id && Math.hypot(o.x - t.x, o.z - t.z) < (o.solid + t.solid) * 0.8) add(t.kind, `overlaps a ${o.kind}`, t);
}
for (const tile of game.map.tiles()) {
  for (const k of (tile.plan?.playgroundKit ?? []).filter((x) => !x.mapped)) {
    const yards = tile.areas.filter((a) => a.kind === 'schoolyard');
    const pg = [...tile.plan.playgrounds, ...yards].find((p) => inPolygon(k.x, k.z, p.pts) || polylineDistance(k.x, k.z, [...p.pts, p.pts[0]]) < 2);
    if (!pg) add('playground', 'outside its playground', { id: 'kit', x: k.x, z: k.z });
  }
}
console.table(report);
