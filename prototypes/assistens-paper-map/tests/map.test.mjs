// Map tests: pure geometry and the walking rules. They import src/map/ directly (no browser, no three.js).
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inPolygon, segmentDistance, signedArea, convexHull, pointAlong, polylineLengths } from '../src/core/map/math.js';
import { GATES, insideCemetery, wallBlocks } from '../src/core/map/cemetery.js';
import { REGION, BUILDINGS, buildingAt } from '../src/core/map/neighbourhood.js';
import { blocksWalker } from '../src/core/map/walk.js';
import { START } from '../src/config.js';

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

test('the walker starts on open ground inside the cemetery', () => {
  assert.equal(insideCemetery(...START), true);
  assert.equal(blocksWalker(...START), false);
});

test('every gate is open', () => {
  for (const [x, z] of GATES) assert.equal(wallBlocks(x, z), false, `gate at ${x.toFixed(1)}, ${z.toFixed(1)}`);
});

test('buildings block the walker, with a little clearance round their walls', () => {
  for (const b of BUILDINGS.filter((x) => x.raised).slice(0, 20)) {
    // the corner furthest west, and a point 0.2 units further west of it
    const [cx, cz] = b.pts.reduce((best, p) => (p[0] < best[0] ? p : best));
    assert.equal(inPolygon(cx - 0.2, cz, b.pts), false);
    assert.notEqual(buildingAt(cx - 0.2, cz, 0.3), null, `building ${b.id}`); // terraced neighbours may answer first
    assert.equal(blocksWalker(cx - 0.2, cz), true);
  }
});

test('most of the open ground can be reached on foot from the start', () => {
  // flood fill on a half-unit grid; enclosed courtyards are the only unreachable open ground
  const S = 0.5;
  const W = Math.ceil((REGION.x1 - REGION.x0) / S);
  const D = Math.ceil((REGION.z1 - REGION.z0) / S);
  const open = (i, j) => !blocksWalker(REGION.x0 + i * S, REGION.z0 + j * S);
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
