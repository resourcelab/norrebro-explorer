// Game core tests: the world as things, collision, walking, near/far, traffic, places, tiles that stream as you walk,
// and whole game runs headless (no browser, no graphics: the core must never need them).
//   npm test   (packs the world first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WALK, START, REGION, TILES, NEARBY } from '../src/config.js';
import { KINDS } from '../src/core/world.js';
import { createMover } from '../src/core/movement.js';
import { headlessGame, run } from './helpers.mjs';

const { game } = await headlessGame({ pins: REGION }); // the whole play area, as the papercraft style asks for it

test('the core imports nothing from a style or from three.js', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  for (const file of walk(new URL('../src/core', import.meta.url).pathname)) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!/^import[^;]*from '(three|papercraft|[^']*styles\/)/m.test(src), `${file} reaches into a style`);
  }
});

test('only core/geo.js knows about longitude and latitude', () => {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  for (const file of walk(new URL('../src', import.meta.url).pathname).filter((f) => f.endsWith('.js'))) {
    if (file.endsWith('core/geo.js') || file.includes('/data/')) continue;
    assert.ok(!/111320|110574|Math\.cos\(.*lat/.test(readFileSync(file, 'utf8')), `${file} projects lon/lat itself`);
  }
});

test('the world is a list of plain things with unique ids and known kinds', async () => {
  const things = game.things;
  assert.ok(things.length > 1300, `${things.length} things`);
  const ids = new Set(things.map((t) => t.id));
  assert.equal(ids.size, things.length);
  for (const t of things) {
    assert.ok(KINDS.includes(t.kind), t.kind);
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.z), t.id);
    assert.ok(typeof t.tile === 'string', `${t.id} belongs to a tile`);
  }
  assert.deepEqual([...new Set(things.map((t) => t.kind))].sort(), [...KINDS].sort(), 'every kind is used');
  for (const t of things.filter((x) => x.kind === 'church' || x.kind === 'flag')) assert.equal(t.always, true, t.id);
  const again = await headlessGame({ pins: REGION });
  const key = (list) => list.map((t) => t.id + ':' + t.x.toFixed(3)).sort();
  assert.deepEqual(key(again.game.things), key(things), 'the same world every time');
});

test('a tile plans the same whichever tiles are loaded round it', async () => {
  // the start tile, planned with the whole play area loaded and with only its own neighbourhood loaded
  const small = await headlessGame();
  const tile = game.map.store.keyAt(...START);
  const of = (g) => g.things.filter((t) => t.tile === tile).map((t) => t.id + ':' + t.x.toFixed(3)).sort();
  assert.ok(of(game).length > 10);
  assert.deepEqual(of(small.game), of(game));
});

test('solid things block the walker; open ground does not', () => {
  const tree = game.things.find((t) => t.kind === 'tree');
  assert.equal(game.colliders.blocked(tree.x, tree.z), true);
  assert.equal(game.colliders.blocked(...START), false);
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

test('a whole game runs headless: walk, near/far, places, cyclists', async () => {
  const { game: g, input, style } = await headlessGame();
  assert.ok(style.log.built > 100, 'the style was built with what is near');
  const rider = g.state.riders[0];
  const before = [rider.x, rider.z];
  input.set(0, -1); // north, along the open path west of the chapel
  await run(g, 2);
  assert.ok(g.state.hero.z < START[1] - 2, `walked north to ${g.state.hero.z.toFixed(1)}`);
  assert.notDeepEqual([rider.x, rider.z], before, 'the cyclists ride');
  // stand by H.C. Andersen's grave: "where am I?" knows
  const hca = g.things.find((t) => t.kind === 'notable-grave' && t.name === 'H.C. Andersen');
  let placed = false;
  for (let r = 1.2; r < 4 && !placed; r += 0.3) for (let a = 0; a < 6.3 && !placed; a += 0.5) placed = g.place(hca.x + Math.cos(a) * r, hca.z + Math.sin(a) * r);
  assert.ok(placed, 'there is room beside the grave');
  await run(g, 0.5);
  assert.equal(g.state.place?.name, 'H.C. Andersen');
});

test('tiles stream: they load ahead of the walker and drop behind him, and so do their things', async () => {
  const { game: g, input, style, loader } = await headlessGame();
  // start on Jagtvej at the play area's west side, and run north-east along it
  const jagtvej = g.map.features('streets').filter((s) => s.name === 'Jagtvej').sort((a, b) => b.pts[0][1] - a.pts[0][1])[0];
  assert.ok(await g.goTo(...jagtvej.pts[0]), 'stands on Jagtvej');
  await run(g, 0.3);
  assert.equal(g.state.street, 'Jagtvej', 'knows the street');
  const before = new Set(g.map.tiles().map((t) => t.key));
  const reads = loader.reads;
  const [dx, dz] = [jagtvej.pts[1][0] - jagtvej.pts[0][0], jagtvej.pts[1][1] - jagtvej.pts[0][1]];
  input.set(dx, dz, true);
  await run(g, 6);
  const moved = Math.hypot(g.state.hero.x - jagtvej.pts[0][0], g.state.hero.z - jagtvej.pts[0][1]);
  assert.ok(moved > 20, `ran ${moved.toFixed(0)} units`);
  const after = new Set(g.map.tiles().map((t) => t.key));
  assert.ok([...after].some((k) => !before.has(k)) && loader.reads > reads, 'new tiles loaded ahead');
  assert.ok([...before].some((k) => !after.has(k)) && style.log.removed > 0, 'tiles behind were dropped, with their things');
  // everything loaded is within reach, and everything near the walker is on a loaded tile
  const { x, z } = g.state.hero;
  for (const k of after) assert.ok(g.map.store.keysWithin(x, z, TILES.keep).includes(k), `${k} is within keep`);
  for (const k of g.map.store.keysWithin(x, z, NEARBY.radius)) assert.ok(after.has(k), `${k} near the walker is loaded`);
});

test('the walker never steps onto a tile that is not loaded', async () => {
  const { game: g } = await headlessGame();
  const unloaded = g.map.store.manifest.tiles.find((k) => !g.map.store.has(k));
  const r = g.map.store.rectOf(unloaded);
  assert.equal(g.colliders.blocked((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), true);
});
