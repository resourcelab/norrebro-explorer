// Shopfront tests: named shops, cafés and schools from OpenStreetMap stand on their block's street facade.
//   npm test   (packs the world first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION, TOY, SCALE } from '../src/config.js';
import { inPolygon } from '../src/core/map/math.js';
import { headlessGame, run } from './helpers.mjs';

const { game } = await headlessGame({ pins: REGION });
const fronts = game.things.filter((t) => t.kind === 'shopfront');

test('the high streets get their shops: over a hundred fronts, with the bakeries', () => {
  assert.ok(fronts.length > 100, `${fronts.length} shopfronts`);
  for (const name of ['Lagkagehuset', 'Meyers Bageri', 'Andersen og Maillard']) assert.ok(fronts.some((f) => f.name === name), name);
  assert.equal(fronts.find((f) => f.name === 'Lagkagehuset').label, 'Bageri · bakery');
});

test('a shopfront stands on its block, facing open ground and a street', () => {
  const blocks = new Map(game.map.features('buildings').map((b) => [b.id, b]));
  for (const f of fronts) {
    const b = blocks.get(f.buildingId);
    assert.ok(b?.raised, `${f.name} is on a standing block`);
    const [nx, nz] = [Math.sin(f.yaw), Math.cos(f.yaw)];
    assert.ok(!inPolygon(f.x + nx * 0.5, f.z + nz * 0.5, b.pts), `${f.name} faces out of its block`);
    assert.equal(game.map.store.index.buildingAt(f.x + nx * 0.8, f.z + nz * 0.8, 0), null, `${f.name} faces open ground`);
    assert.ok(game.map.store.index.streetDistance(f.x + nx * 1.5, f.z + nz * 1.5) < 4.1, `${f.name} faces a street`);
    assert.ok(Math.abs(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) - 8 * SCALE) < 1e-6 || Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) < 8 * SCALE, 'at most 8 m wide');
    assert.equal(f.height, TOY.groundFloor);
  }
});

test('shopfronts on the same facade never overlap', () => {
  for (const f of fronts) {
    for (const g of fronts) {
      if (f === g || f.buildingId !== g.buildingId || Math.abs(f.yaw - g.yaw) > 1e-6) continue;
      const w = Math.min(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]));
      assert.ok(Math.hypot(f.x - g.x, f.z - g.z) > w * 0.85, `${f.name} and ${g.name}`);
    }
  }
});

test('standing in front of a shop, "where am I?" names it', async () => {
  const { game: g } = await headlessGame();
  const f = fronts.find((x) => x.name === 'Lagkagehuset');
  const [nx, nz] = [Math.sin(f.yaw), Math.cos(f.yaw)];
  assert.ok(await g.goTo(f.x + nx * 0.9, f.z + nz * 0.9), 'there is room on the pavement');
  await run(g, 0.4);
  assert.equal(g.state.place?.name, 'Lagkagehuset');
  assert.equal(g.state.place?.about, 'Bageri · bakery');
});

test('the walker stands under the shop sign: people 2 × life, the shop floor taller than him', () => {
  assert.ok(TOY.heights.walker < TOY.groundFloor / SCALE - 1, `${TOY.heights.walker} m under a ${TOY.groundFloor / SCALE} m shop floor`);
  assert.ok(TOY.heights.walker > 3, 'still easy to see');
});
