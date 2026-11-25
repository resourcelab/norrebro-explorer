// Wayfinding tests: landmarks, corner signs, fingerposts, wider streets, the context ring.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHURCHES, FLAGS, FAR } from '../src/core/map/landmarks.js';
import { REGION, BUILDINGS, buildingAt, STREETS, CONTEXT } from '../src/core/map/neighbourhood.js';
import { planCornerSigns, planFingerposts } from '../src/core/plan/neighbourhood.js';
import { START, SCALE, TOY } from '../src/config.js';

const inRegion = ([x, z]) => x > REGION.x0 && x < REGION.x1 && z > REGION.z0 && z < REGION.z1;

test('every landmark church and flag is inside the walkable area', () => {
  assert.equal(CHURCHES.length, 4);
  for (const c of CHURCHES) assert.ok(inRegion(c.centre), c.name);
  for (const f of FLAGS) assert.ok(inRegion(f.at), f.name);
  // churches are drawn as churches, never also as an ordinary block
  for (const c of CHURCHES) assert.equal(BUILDINGS.find((b) => b.id === c.building).raised, false);
});

test('the far places lie beyond the walkable area, in the right direction', () => {
  const lakes = FAR.find((f) => f.id === 'lakes').pointFrom(...START);
  const superkilen = FAR.find((f) => f.id === 'superkilen').pointFrom(...START);
  assert.ok(!inRegion(lakes) && !inRegion(superkilen));
  assert.ok(lakes[0] > START[0] && lakes[1] > START[1], 'the lakes are south-east');
  assert.ok(superkilen[1] < START[1], 'Superkilen is north');
});

test('corner signs stand on the pavement, never in a building', () => {
  const signs = planCornerSigns();
  assert.ok(signs.length > 20, `${signs.length} signs`);
  for (const s of signs) {
    assert.equal(buildingAt(s.x, s.z, 0), null, s.names.join(' / '));
    assert.ok(s.names.length >= 2);
  }
});

test('fingerposts point to every far place with a sensible distance', () => {
  const posts = planFingerposts(FAR, START);
  const named = new Set(posts.flatMap((p) => p.arms.map((a) => a.name)));
  for (const f of FAR) assert.ok(named.has(f.name), f.name);
  for (const p of posts) for (const a of p.arms) assert.ok(a.metres >= 100 && a.metres <= 3000, `${a.name} ${a.metres} m`);
});

test('streets are drawn wider than mapped; the context ring reaches the lakes', () => {
  const s = STREETS.find((x) => x.width >= 8);
  assert.ok(Math.abs(s.half - (s.width * SCALE * TOY.streetWiden) / 2) < 1e-9);
  assert.ok(CONTEXT.areas.some((a) => a.kind === 'water'));
});
