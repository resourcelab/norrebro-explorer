// Placement tests: everything stands where it can really stand (not in a building, on a road or in water, not on top
// of another thing), playgrounds, schoolyards and pitches get their kit, and mapped things stay where OSM maps them.
//   npm test   (packs the world first)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION } from '../src/config.js';
import { inPolygon, polylineDistance, centroid } from '../src/core/map/math.js';
import { onRoad } from '../src/core/plan/street.js';
import { headlessGame } from './helpers.mjs';

const { game } = await headlessGame({ pins: REGION });
const idx = game.map.store.index;
const things = game.things;
const ofKind = (k) => things.filter((t) => t.kind === k);
const BUILT = new Set(['block', 'church', 'chapel', 'shed', 'wall', 'shopfront', 'crossing', 'fence']);
const near = (t, pts, d) => inPolygon(t.x, t.z, pts) || polylineDistance(t.x, t.z, [...pts, pts[0]]) < d;

test('nothing stands in a building, on a road or in water', () => {
  const bad = [];
  for (const t of things) {
    if (BUILT.has(t.kind)) continue;
    if (idx.buildingAt(t.x, t.z, 0)) bad.push(`${t.id} in a building`);
    if (onRoad(idx, t.x, t.z)) bad.push(`${t.id} on a road`);
    if (idx.inWater(t.x, t.z)) bad.push(`${t.id} in water`);
  }
  assert.deepEqual(bad, []);
});

test('solid things never stand on top of each other', () => {
  const solid = things.filter((t) => t.solid);
  const bad = [];
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const [a, b] = [solid[i], solid[j]];
      if (Math.hypot(a.x - b.x, a.z - b.z) < (a.solid + b.solid) * 0.8) bad.push(`${a.id} / ${b.id}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the street furniture OpenStreetMap maps is there: benches, racks, bins, picnic tables, bus stops', () => {
  assert.ok(ofKind('bench').length >= 50, `${ofKind('bench').length} benches`);
  assert.ok(ofKind('bike-rack').length >= 50, `${ofKind('bike-rack').length} bike racks`);
  assert.ok(ofKind('bin').length >= 8, 'bins');
  assert.ok(ofKind('picnic-table').length >= 5, 'picnic tables');
  assert.ok(ofKind('bus-stop').length >= 4, 'bus stops');
});

test('playgrounds get equipment by their size, inside them, and mapped equipment stands where it is mapped', () => {
  const tiles = game.map.tiles();
  const playgrounds = tiles.flatMap((t) => t.plan.playgrounds);
  const yards = game.map.features('areas').filter((a) => a.kind === 'schoolyard');
  const kit = ofKind('playground');
  // filled-in pieces stand in a playground or yard; mapped ones stand where they are mapped, wherever that is
  for (const k of kit.filter((x) => !x.mapped)) assert.ok([...playgrounds, ...yards].some((p) => near(k, p.pts, 2)), `${k.id} (${k.equipment}) is in a playground or yard`);
  const pitches = game.map.features('areas').filter((a) => a.kind === 'pitch');
  for (const k of kit.filter((x) => !x.mapped)) assert.ok(!pitches.some((p) => inPolygon(k.x, k.z, p.pts)), `${k.id} is not on a pitch`);
  const biggest = playgrounds.reduce((a, b) => (b.axis.length * b.axis.width > a.axis.length * a.axis.width ? b : a));
  assert.ok(kit.filter((k) => inPolygon(k.x, k.z, biggest.pts)).length >= 7, 'the biggest playground has seven or more pieces');
  for (const pg of playgrounds) assert.ok(kit.some((k) => near(k, pg.pts, 2)), `every playground has something (${centroid(pg.pts).map((v) => v.toFixed(0))})`);
  const mapped = kit.filter((k) => k.mapped);
  assert.ok(mapped.length >= 3, `${mapped.length} pieces stand where OpenStreetMap maps them`);
  const props = tiles.flatMap((t) => t.props).filter(([, , k]) => k.startsWith('play:'));
  for (const k of mapped) assert.ok(props.some(([x, z]) => Math.hypot(x - k.x, z - k.z) < 0.8), `${k.id} is at its mapped spot`);
});

test('every school and kindergarten yard has a flagpole; schools get hopscotch', () => {
  const flags = ofKind('flagpole');
  assert.ok(flags.length >= 4, `${flags.length} flagpoles`);
  for (const name of ['Nørrebro Park Skole', 'Blågårds Skole', 'Stenurten']) assert.ok(flags.some((f) => f.name === name), name);
  assert.ok(!flags.some((f) => /akademi/i.test(f.name ?? '')), 'not at the business academies');
  assert.ok(game.map.tiles().flatMap((t) => t.plan.schoolyards.hopscotch).length >= 2, 'hopscotch courts');
});

test('pitches get the kit of their sport: goals on football pitches, hoops on basketball courts', () => {
  const kit = ofKind('sport-kit');
  const pitches = game.map.features('areas').filter((a) => a.kind === 'pitch' && a.pts.some(([x, z]) => x > REGION.x0 && x < REGION.x1 && z > REGION.z0 && z < REGION.z1));
  const football = pitches.filter((p) => (p.sport ?? '').split(';').includes('soccer') && p.axis.length > 3 && p.axis.x < REGION.x1);
  assert.ok(football.length >= 3);
  for (const p of football) assert.ok(kit.filter((k) => k.equipment === 'goal' && near(k, p.pts, 1)).length >= 1, `goals on the pitch at ${p.axis.x.toFixed(0)}, ${p.axis.z.toFixed(0)}`);
  assert.ok(kit.some((k) => k.equipment === 'hoop'), 'basketball hoops');
  assert.ok(kit.some((k) => k.equipment === 'table'), 'a table-tennis table');
});

test('crossings lie across roads, and those with signals have traffic lights on the pavement', () => {
  const crossings = ofKind('crossing');
  assert.ok(crossings.length >= 10, `${crossings.length} crossings`);
  for (const c of crossings) assert.ok(onRoad(idx, c.x, c.z), `${c.id} is on a road`);
  const lights = ofKind('traffic-light');
  assert.ok(lights.length >= crossings.filter((c) => c.signals).length, 'a light at each end of most crossings with signals');
  for (const l of lights) assert.ok(!onRoad(idx, l.x, l.z), `${l.id} stands on the pavement`);
});
