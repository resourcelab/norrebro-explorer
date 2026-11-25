// Map tests: geometry, the world frame, the packed tiles, and the walking rules (no browser, no three.js).
//   npm test   (packs the world first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inPolygon, segmentDistance, signedArea, convexHull, pointAlong, polylineLengths, centroid } from '../src/core/map/math.js';
import { lonLatToMetres, metresToLonLat, toUnits } from '../src/core/geo.js';
import { createSpatialIndex } from '../src/core/world/index.js';
import { GATES, OUTLINE, insideCemetery, wallBlocks } from '../src/core/sites/assistens/map.js';
import { START, REGION, SCALE } from '../src/config.js';
import { headlessGame } from './helpers.mjs';

const { game } = await headlessGame({ pins: REGION });
const blocks = game.map.blocks;
const square = [[0, 0], [2, 0], [2, 2], [0, 2]];

test('geometry helpers', () => {
  assert.equal(inPolygon(1, 1, square), true);
  assert.equal(inPolygon(3, 1, square), false);
  assert.equal(segmentDistance(1, 1, [0, 0], [2, 0]), 1);
  assert.equal(Math.abs(signedArea(square)), 4);
  assert.equal(convexHull([...square, [1, 1]]).length, 4); // the inner point is dropped
  const route = [[0, 0], [3, 0], [3, 4]];
  const p = pointAlong(route, polylineLengths(route), 5);
  assert.deepEqual([p.x, p.z], [3, 2]);
});

test('the world frame: the origin is the north-west corner, x east, z south, and it round-trips', () => {
  assert.deepEqual(lonLatToMetres(12.541, 55.6965), [0, 0]);
  const [x, z] = lonLatToMetres(12.55, 55.69);
  assert.ok(x > 0 && z > 0, 'east and south of the corner are positive');
  const [lon, lat] = metresToLonLat([x, z]);
  assert.ok(Math.abs(lon - 12.55) < 1e-9 && Math.abs(lat - 55.69) < 1e-9);
});

test('the Assistens plan lines up with the cemetery in the world tiles', () => {
  // the tiles' own cemetery area (OpenStreetMap landuse=cemetery), from the packed overview
  const overview = JSON.parse(readFileSync(new URL('../world/overview.json', import.meta.url), 'utf8'));
  const cemetery = overview.areas.filter((a) => a.kind === 'cemetery').map((a) => a.pts.map(toUnits))
    .find((pts) => inPolygon(...centroid(OUTLINE), pts));
  assert.ok(cemetery, 'the tiles have a cemetery round the plan');
  // every corner of the plan's outline lies on the tiles' outline (metres apart: typically 0.1, at most a few)
  const toEdge = (x, z) => Math.min(...cemetery.map((p, i) => segmentDistance(x, z, p, cemetery[(i + 1) % cemetery.length])));
  const metres = OUTLINE.map(([x, z]) => toEdge(x, z) / SCALE).sort((p, q) => p - q);
  assert.ok(metres[metres.length >> 1] < 1, `median ${metres[metres.length >> 1].toFixed(1)} m`);
  assert.ok(metres[metres.length - 1] < 5, `worst ${metres[metres.length - 1].toFixed(1)} m`);
});

test('the spatial index answers like a full search', () => {
  const idx = createSpatialIndex();
  const streets = game.map.features('streets');
  for (const s of streets) idx.add(s);
  for (let k = 0; k < 200; k++) {
    const x = REGION.x0 + ((k * 37) % 100) / 100 * (REGION.x1 - REGION.x0);
    const z = REGION.z0 + ((k * 61) % 100) / 100 * (REGION.z1 - REGION.z0);
    let full = Infinity;
    for (const s of streets) for (let i = 0; i < s.pts.length - 1; i++) full = Math.min(full, segmentDistance(x, z, s.pts[i], s.pts[i + 1]) - s.half);
    if (full < 8) assert.ok(Math.abs(idx.streetDistance(x, z) - full) < 1e-9, `at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
});

test('the walker starts on open ground inside the cemetery', () => {
  assert.equal(insideCemetery(...START), true);
  assert.equal(blocks(...START), false);
});

test('every gate is open', () => {
  for (const [x, z] of GATES) assert.equal(wallBlocks(x, z), false, `gate at ${x.toFixed(1)}, ${z.toFixed(1)}`);
});

test('buildings block the walker, with a little clearance round their walls', () => {
  for (const b of game.map.features('buildings').filter((x) => x.raised).slice(0, 20)) {
    // the corner furthest west, and a point 0.2 units further west of it
    const [cx, cz] = b.pts.reduce((best, p) => (p[0] < best[0] ? p : best));
    if (cx - 0.2 < REGION.x0) continue;
    assert.equal(inPolygon(cx - 0.2, cz, b.pts), false);
    assert.notEqual(game.map.store.index.buildingAt(cx - 0.2, cz, 0.3), null, `building ${b.id}`); // terraced neighbours may answer first
    assert.equal(blocks(cx - 0.2, cz), true);
  }
});

test('most of the open ground can be reached on foot from the start', () => {
  // flood fill on a half-unit grid; enclosed courtyards are the only unreachable open ground
  const S = 0.5;
  const W = Math.ceil((REGION.x1 - REGION.x0) / S);
  const D = Math.ceil((REGION.z1 - REGION.z0) / S);
  const open = (i, j) => !blocks(REGION.x0 + i * S, REGION.z0 + j * S);
  const seen = new Uint8Array(W * D);
  const start = [Math.round((START[0] - REGION.x0) / S), Math.round((START[1] - REGION.z0) / S)];
  const stack = [start];
  seen[start[1] * W + start[0]] = 1;
  let reached = 0;
  while (stack.length) {
    const [i, j] = stack.pop();
    reached++;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = i + a;
      const v = j + b;
      if (u < 0 || v < 0 || u >= W || v >= D || seen[v * W + u]) continue;
      seen[v * W + u] = 1;
      if (open(u, v)) stack.push([u, v]);
    }
  }
  let total = 0;
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) if (open(i, j)) total++;
  assert.ok(reached / total > 0.9, `reached ${((100 * reached) / total).toFixed(1)} % of the open ground`);
});
