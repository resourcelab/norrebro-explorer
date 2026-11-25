// Wayfinding tests: landmarks, signs, fingerposts and the near/far stream (with a stand-in for the harness).
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHURCHES, FLAGS, FAR } from '../src/map/landmarks.js';
import { REGION, BUILDINGS, buildingAt, STREETS, CONTEXT } from '../src/map/neighbourhood.js';
import { planCornerSigns, planFingerposts } from '../src/plan/neighbourhood.js';
import { createStream } from '../src/world/stream.js';
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

test('the stream stands near pieces, builds lazy ones once, and hides far ones', () => {
  // a stand-in harness: a hero to move, and a step hook to drive
  const hooks = [];
  const hero = { group: { position: { x: 0, z: 0 } } };
  const H = { hero, onStep: (fn) => hooks.push(fn) };
  const hinge = (x, z) => ({ x, z, p: 1, jit: 0, group: { visible: true }, set(o) { this.p = o; }, reset(p) { this.p = p; } });
  const stream = createStream(H, { radius: 10, hysteresis: 1, checkEvery: 0.1, buildPerStep: 10, budgetMs: 100 });
  const near = stream.add(hinge(2, 0), { x: 2, z: 0 });
  const far = stream.add(hinge(50, 0), { x: 50, z: 0 });
  const tower = stream.add(hinge(80, 0), { x: 80, z: 0, node: true, always: true });
  let builds = 0;
  stream.lazy(30, 0, () => { builds++; return hinge(30, 0); });
  stream.start();
  const step = (dt = 0.11) => hooks.forEach((fn) => fn(0, dt));
  assert.equal(near.group.visible, true);
  assert.equal(far.group.visible, false, 'far pieces are hidden at the start');
  assert.equal(tower.group.visible, true, 'landmarks always stand');
  assert.equal(builds, 0, 'lazy pieces wait until the walker comes near');
  hero.group.position.x = 28; // walk east
  step(); step();
  assert.equal(builds, 1);
  assert.equal(near.p, 0, 'the piece left behind folds flat');
  hero.group.position.x = 0; // and back: the lazy piece is not built twice
  step(); step(); step();
  hero.group.position.x = 28;
  step(); step();
  assert.equal(builds, 1);
  assert.deepEqual(stream.stats(), { pieces: 4, built: 4, standing: 2, waiting: 0 });
});
