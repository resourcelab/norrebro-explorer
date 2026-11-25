// Game core tests: the world as things, collision, walking, near/far, traffic, places, and a whole game run headless
// (no browser, no graphics: the core must never need them).
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WALK, START, NEARBY } from '../src/config.js';
import { planWorld } from '../src/core/plan/index.js';
import { describeWorld, KINDS } from '../src/core/world.js';
import { createColliders } from '../src/core/colliders.js';
import { createMover } from '../src/core/movement.js';
import { createNearby } from '../src/core/nearby.js';
import { createGame } from '../src/core/game.js';
import { createScriptedInput } from '../src/core/input.js';

const plan = planWorld();
const things = describeWorld(plan);

test('the core imports nothing from a style or from three.js', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  for (const file of walk(new URL('../src/core', import.meta.url).pathname)) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!/^import[^;]*from '(three|papercraft|[^']*styles\/)/m.test(src), `${file} reaches into a style`);
  }
});

test('the world is a list of plain things with unique ids and known kinds', () => {
  assert.ok(things.length > 1000, `${things.length} things`);
  const ids = new Set(things.map((t) => t.id));
  assert.equal(ids.size, things.length);
  for (const t of things) {
    assert.ok(KINDS.includes(t.kind), t.kind);
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.z), t.id);
  }
  assert.deepEqual([...new Set(things.map((t) => t.kind))].sort(), [...KINDS].sort(), 'every kind is used');
  for (const t of things.filter((x) => x.kind === 'church' || x.kind === 'flag')) assert.equal(t.always, true, t.id);
  assert.deepEqual(describeWorld(planWorld()).map((t) => t.id + t.x), things.map((t) => t.id + t.x), 'the same world every time');
});

test('solid things block the walker; open ground does not', () => {
  const c = createColliders(things, WALK.radius);
  const tree = things.find((t) => t.kind === 'tree');
  assert.equal(c.blocked(tree.x, tree.z), true);
  assert.equal(c.blocked(...START), false);
});

test('walking: 2.5 units a second on open ground, faster running, and he slides along walls', () => {
  const m = createMover(WALK, [0, 0]);
  const open = () => false;
  for (let i = 0; i < 120; i++) m.step(1 / 60, { x: 1, z: 0 }, open); // 2 s east
  assert.ok(Math.abs(m.state.x - 2 * WALK.speed) < 0.3, `walked ${m.state.x.toFixed(2)}`);
  assert.ok(Math.abs(m.state.heading - Math.PI / 2) < 0.05, 'faces east');
  const r = createMover(WALK, [0, 0]);
  for (let i = 0; i < 60; i++) r.step(1 / 60, { x: 1, z: 0, run: true }, open);
  assert.ok(r.state.x > 1.9 * WALK.speed, 'running is faster');
  const wall = (x) => x > 1; // a wall at x = 1: walking north-east slides north along it
  const s = createMover(WALK, [0, 0]);
  for (let i = 0; i < 120; i++) s.step(1 / 60, { x: 1, z: -1 }, (x) => wall(x));
  assert.ok(s.state.x <= 1 && s.state.z < -2, `slid to ${s.state.x.toFixed(2)}, ${s.state.z.toFixed(2)}`);
});

test('near and far: things come near and go far as the walker moves; landmarks are always near', () => {
  const n = createNearby(things, NEARBY);
  const first = n.check(...START);
  const landmark = things.find((t) => t.always);
  assert.ok(first.came.includes(landmark.id));
  const far = things.find((t) => Math.hypot(t.x - START[0], t.z - START[1]) > NEARBY.radius + 20 && !t.always);
  assert.ok(!n.near.has(far.id));
  const moved = n.check(far.x, far.z);
  assert.ok(moved.came.includes(far.id));
  assert.ok(n.near.has(landmark.id), 'landmarks stay near');
});

test('a whole game runs headless: walking, collision, places, near/far, traffic', () => {
  const input = createScriptedInput();
  const game = createGame({ input });
  const events = { came: 0, went: 0 };
  const style = { build() {}, start() {}, near(c) { events.came += c.came.length; events.went += c.went.length; }, zoom() {} };
  game.attach(style);
  const step = (sec) => { for (let i = 0; i < sec * 60; i++) game.step(1 / 60); };
  const x0 = game.state.hero.x;
  input.set(0, -1); // walk north for 3 s
  step(3);
  assert.ok(game.state.hero.z < START[1] - 3, 'he walked north');
  input.set(0, 0);
  step(0.5);
  assert.ok(Math.abs(game.state.hero.x - x0) < 3);
  // teleport to the far side of the area: near/far reports changes
  assert.equal(game.place(-40, 40), true);
  step(0.5);
  assert.ok(events.came > 0 && events.went > 0, JSON.stringify(events));
  assert.equal(game.place(things.find((t) => t.kind === 'tree').x, things.find((t) => t.kind === 'tree').z), false, 'not into a tree');
  // the place and street lookups
  game.place(-20, -74);
  step(0.3);
  assert.equal(game.state.place?.name, 'Nørrebros Runddel');
  // cyclists move
  const r0 = { ...game.state.riders[0] };
  step(1);
  assert.notDeepEqual([r0.x, r0.z], [game.state.riders[0].x, game.state.riders[0].z]);
  game.toggleZoom();
  assert.equal(game.state.zoom, 'map');
});
