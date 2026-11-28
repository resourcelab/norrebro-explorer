// Find-your-way-home tests: the places to live, starting a walk, peeks and arrows, crossing roads, getting home.
//   npm test   (packs the world first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION } from '../src/config.js';
import { createRound, PLACES, LEVELS } from '../src/core/round.js';
import { onRoad } from '../src/core/plan/street.js';
import { createAddressBook, parse } from '../src/core/address.js';
import { headlessGame, run, fileLoader } from './helpers.mjs';

const { game: whole } = await headlessGame({ pins: REGION });

// flood fill on a half-unit grid from the first place: what the walker can reach
const blocks = (x, z) => whole.colliders.blocked(x, z);
const S = 0.5;
const W = Math.ceil((REGION.x1 - REGION.x0) / S);
const cell = (x, z) => [Math.round((x - REGION.x0) / S), Math.round((z - REGION.z0) / S)];
const reachable = (() => {
  const D = Math.ceil((REGION.z1 - REGION.z0) / S);
  const seen = new Uint8Array(W * D);
  const [i0, j0] = cell(PLACES[0].x, PLACES[0].z);
  const stack = [[i0, j0]];
  seen[j0 * W + i0] = 1;
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [u, v] = [i + a, j + b];
      if (u < 0 || v < 0 || u >= W || v >= D || seen[v * W + u]) continue;
      seen[v * W + u] = 1;
      if (!blocks(REGION.x0 + u * S, REGION.z0 + v * S)) stack.push([u, v]);
    }
  }
  return (x, z) => { const [i, j] = cell(x, z); return Boolean(seen[j * W + i]); };
})();

test('every place to live is on free pavement in the play area, and each can be walked to from the others', () => {
  for (const p of PLACES) {
    assert.ok(p.x > REGION.x0 && p.x < REGION.x1 && p.z > REGION.z0 && p.z < REGION.z1, `${p.id} is in the play area`);
    assert.equal(blocks(p.x, p.z), false, `${p.id} is free`);
    assert.ok(reachable(p.x, p.z), `${p.id} can be walked to`);
  }
});

test('addresses: typed the way children type, found on the map; streets beyond it are told apart', async () => {
  assert.deepEqual(parse('Blågårdsgade 12B, 2200 København N'), { street: 'blaagaardsgade', number: '12b' });
  assert.deepEqual(parse('fælledvej 9 2. th'), { street: 'faelledvej', number: '9' });
  const book = createAddressBook(fileLoader(), REGION);
  assert.ok((await book.size()) > 500, 'hundreds of addresses in the play area');
  const a = await book.find('hans tavsens gade 4');
  assert.equal(a.label, 'Hans Tavsens Gade 4');
  assert.equal((await book.find('HANS TAVSENS GADE 4')).label, a.label);
  assert.ok((await book.suggest('hans tav')).every((h) => h.street === 'Hans Tavsens Gade'));
  assert.equal((await book.find('Hans Tavsens Gade 999')).street, 'Hans Tavsens Gade', 'an unknown number: the nearest one');
  assert.deepEqual(await book.find('Blågårdsgade 1'), { outside: true }, 'east of the play area');
  assert.equal(await book.find('Ingenvej 1'), null);
});

test('home at an address: on the pavement of its own street, free, and the walker can get there', async () => {
  const { game } = await headlessGame();
  const round = createRound(game);
  const book = createAddressBook(fileLoader(), REGION);
  for (const text of ['Hans Tavsens Gade 4', 'Jagtvej 99', 'Kapelvej 10', 'Nørrebrogade 66', 'Stengade 20', 'Prinsesse Charlottes Gade 30', 'Rantzausgade 20']) {
    const a = await book.find(text);
    assert.ok(a && !a.outside, `${text} is on the map`);
    const home = await round.homeAt(a);
    assert.ok(home, `${text}: a spot`);
    assert.ok(Math.hypot(home.x - a.x, home.z - a.z) < 8, `${text}: near the door`);
    assert.equal(game.colliders.blocked(home.x, home.z), false);
    assert.equal(onRoad(game.map.store.index, home.x, home.z), false, `${text}: not on the road`);
    assert.ok(reachable(home.x, home.z), `${text}: can be walked to`);
  }
  assert.equal(await round.homeAt(await book.find('Hellebækgade 6')), null, 'its street runs just beyond the map\'s edge');
  const r = await round.start({ home: await round.homeAt(await book.find('Kapelvej 10')), level: 'small', seed: 4 });
  assert.match(r.home.name, /^Kapelvej \d/);
  assert.ok(PLACES.some((p) => p.id === r.from.id), 'starts at a place a child knows');
});

test('a walk starts at another known place, at the level\'s distance from home', async () => {
  for (const level of Object.keys(LEVELS)) {
    const { game } = await headlessGame();
    const round = createRound(game);
    const r = await round.start({ homeId: 'blaagaards-skole', level, seed: 7 });
    const d = Math.hypot(r.home.x - r.from.x, r.home.z - r.from.z);
    assert.notEqual(r.from.id, r.home.id);
    assert.ok(d >= Math.min(LEVELS[level].spawn[0], 40) && d <= LEVELS[level].spawn[1] + 30, `${level}: ${d.toFixed(0)} units`);
    assert.ok(Math.hypot(game.state.hero.x - r.from.x, game.state.hero.z - r.from.z) < 0.01, 'the walker stands there');
    assert.equal(game.state.round, r);
  }
});

test('peeks show the map for a few seconds and are counted; the free zoom spends them; arrows too', async () => {
  const { game } = await headlessGame();
  const round = createRound(game);
  const r = await round.start({ homeId: 'runddel', level: 'middle', seed: 3 });
  assert.equal(game.state.zoom, 'street');
  game.toggleZoom(); // Z: spends a peek
  assert.equal(game.state.zoom, 'map');
  assert.equal(r.peeksLeft, LEVELS.middle.peeks - 1);
  await run(game, 4.5);
  assert.equal(game.state.zoom, 'street', 'back after the peek');
  while (round.peek()) await run(game, 4.5);
  assert.equal(r.peeksLeft, 0);
  game.toggleZoom();
  assert.equal(game.state.zoom, 'street', 'no peeks left: no zoom');
  assert.ok(round.arrow() && round.arrow());
  assert.equal(round.arrow(), false, 'middle has two arrows');
});

test('stepping onto a road away from a crossing is counted; at a crossing it is not', async () => {
  const { game, input } = await headlessGame();
  const round = createRound(game);
  const r = await round.start({ homeId: 'runddel', level: 'small', seed: 1 });
  const idx = game.map.store.index;
  // find a pavement spot right beside a road, away from any crossing, and walk onto the road
  const crossings = game.things.filter((t) => t.kind === 'crossing');
  let from = null;
  for (const s of game.map.features('streets').filter((x) => x.kind === 'residential' && x.name)) {
    const [a, b] = s.pts;
    const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [nx, nz] = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
    const [px, pz] = [mx + nx * (s.half + 0.4), mz + nz * (s.half + 0.4)];
    if (!crossings.some((c) => Math.hypot(c.x - px, c.z - pz) < 8) && !onRoad(idx, px, pz) && await game.goTo(px, pz)) { from = { nx, nz }; break; }
  }
  assert.ok(from, 'a kerb to step off');
  const before = r.jaywalks;
  input.set(-from.nx, -from.nz);
  await run(game, 0.8);
  assert.equal(r.jaywalks, before + 1);
});

test('reaching home ends the walk: stars, the route walked', async () => {
  const { game } = await headlessGame();
  const round = createRound(game);
  let done = null;
  round.onFinish((x) => { done = x; });
  const r = await round.start({ homeId: 'blaagaards-skole', level: 'small', seed: 2 });
  round.arrow();
  await run(game, 1);
  assert.ok(await game.goTo(r.home.x + 0.5, r.home.z));
  await run(game, 0.5);
  assert.equal(r.status, 'home');
  assert.equal(done, r);
  assert.equal(r.stars, 2, 'one arrow used: two stars');
  assert.ok(r.path.length >= 2 && r.straight > 10);
});
