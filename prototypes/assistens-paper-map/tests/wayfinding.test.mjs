// Wayfinding tests: landmarks, corner signs, fingerposts, wider streets, the overview round the play area.
//   npm test   (packs the world first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START, REGION, SCALE, TOY } from '../src/config.js';
import { headlessGame } from './helpers.mjs';

const { game } = await headlessGame({ pins: REGION });
const { churches, flags, far } = game.map.landmarks;
const inRegion = ([x, z]) => x > REGION.x0 && x < REGION.x1 && z > REGION.z0 && z < REGION.z1;
const ofKind = (kind) => game.things.filter((t) => t.kind === kind);

test('every landmark church and flag is inside the walkable area', () => {
  assert.equal(churches.length, 4);
  for (const c of churches) assert.ok(inRegion(c.centre), c.name);
  for (const f of flags) assert.ok(inRegion(f.at), f.name);
  // churches are drawn as churches, never also as an ordinary block
  const buildings = game.map.features('buildings');
  for (const c of churches) assert.equal(buildings.find((b) => b.id === c.building)?.raised, false, c.name);
  assert.ok(!ofKind('block').some((b) => churches.some((c) => c.building === b.buildingId)));
});

test('the far places lie beyond the walkable area, in the right direction', () => {
  const lakes = far.find((f) => f.id === 'lakes').pointFrom(...START);
  const superkilen = far.find((f) => f.id === 'superkilen').pointFrom(...START);
  assert.ok(!inRegion(lakes) && !inRegion(superkilen));
  assert.ok(lakes[0] > START[0] && lakes[1] > START[1], 'the lakes are south-east');
  assert.ok(superkilen[1] < START[1], 'Superkilen is north');
});

test('corner signs stand on the pavement, never in a building', () => {
  const signs = ofKind('corner-sign');
  assert.ok(signs.length > 30, `${signs.length} signs`);
  for (const s of signs) {
    assert.equal(game.map.store.index.buildingAt(s.x, s.z, 0), null, s.names.join(' / '));
    assert.ok(s.names.length >= 2);
  }
});

test('one sign per corner, even where a corner lies on the edge between two tiles', () => {
  const signs = ofKind('corner-sign');
  for (const a of signs) {
    for (const b of signs) {
      if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 6, `${a.names.join('/')} at ${a.tile} and ${b.names.join('/')} at ${b.tile}`);
    }
  }
});

test('cyclists ride whole streets, spread out along them', () => {
  const riders = game.state.riders;
  assert.ok(riders.length >= 4, `${riders.length} riders`);
  let close = 0;
  for (const a of riders) for (const b of riders) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < 3) close++;
  assert.ok(close / 2 <= 2, `${close / 2} pairs of riders on top of each other`);
});

test('fingerposts point to every far place with a sensible distance', () => {
  const posts = ofKind('fingerpost');
  const named = new Set(posts.flatMap((p) => p.arms.map((a) => a.name)));
  for (const f of far) assert.ok(named.has(f.name), f.name);
  for (const p of posts) for (const a of p.arms) assert.ok(a.metres >= 100 && a.metres <= 3000, `${a.name} ${a.metres} m`);
});

test('streets are drawn wider than mapped; the overview reaches the lakes', () => {
  const s = game.map.features('streets').find((x) => x.width >= 8);
  assert.ok(Math.abs(s.half - (s.width * SCALE * TOY.streetWiden) / 2) < 1e-9);
  assert.ok(game.map.overview.areas.some((a) => a.kind === 'water'));
  const b = game.map.bounds;
  assert.ok(b.x0 < REGION.x0 && b.z0 < REGION.z0 && b.x1 > REGION.x1 && b.z1 > REGION.z1, 'the overview surrounds the play area');
});
