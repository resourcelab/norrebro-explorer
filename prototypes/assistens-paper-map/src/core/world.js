/**
 * The world as a list of THINGS: everything that stands on the map, described by what it is, never by how it looks.
 * Things are the contract between the game core and the styles: a style is told when things arrive and leave and
 * decides how each kind looks (a paper card, a pixel sprite, a flat icon). Every thing is plain data:
 *
 *   { id, kind, x, z, tile, solid?, always?, ...fields of its kind }
 *
 *   id      stable string ('tree-6_7-12'), the same on every load, used to say it has come near or gone far
 *   x, z    where it stands (world units; x east, z south). Long things (wall runs) also give a and b.
 *   tile    the tile it belongs to (the one its position falls in), or 'world' for things that are always there
 *   solid   radius (units) the walker cannot enter, or absent. core/colliders.js builds collision from it.
 *   always  true for landmarks: always "near", so a style keeps them standing to steer by
 *
 * Kinds and their fields:
 *   chapel        pts (footprint), yaw                   shed         pts
 *   wall          a, b, wall: 'wall' | 'hedge'           gate-post    -
 *   tree          species, size (scale), seed            grave        variant, size
 *   notable-grave name, index, tall                       bench, lamp, tap
 *   critter       species: 'crow' | 'squirrel'           block        pts, levels, buildingId
 *   playground    equipment: swings | slide | climber | seesaw
 *   bike-rack     -                                      corner-sign  names
 *   fingerpost    arms: [{ name, dx, metres }]          flag         name, color
 *   church        name, pts, tower: [x, z]
 * Cyclists move, so they are not things: core/traffic.js keeps them in the game state.
 *
 * Where things come from:
 *   describeTile     a tile's own things (blocks, street trees, playground kit, racks, benches, corner signs), planned
 *                    from that tile alone with its own random stream
 *   describeSite     a site's things (Assistens: the chapel, walls, graves...), planned once, then handed out to the
 *                    tiles they stand on
 *   describeLandmarks  churches, flags and fingerposts: always there, whatever is loaded
 *
 * Sizes are TOY scale (config.js): what a style draws should honour them, so every style reads the same way.
 */
import { TOY } from '../config.js';
import { SOLID } from './solid.js';
import { rng, seedOf } from './random.js';
import { planStreetTrees, planPlaygrounds, planPlaygroundKit, planStreetFurniture, planCornerSigns } from './plan/neighbourhood.js';

/** Every kind of thing; a style should know how to draw each (tests/core.test.mjs checks the list stays honest). */
export const KINDS = [
  'chapel', 'shed', 'wall', 'gate-post', 'tree', 'grave', 'notable-grave', 'bench', 'lamp', 'tap', 'critter', 'block',
  'playground', 'bike-rack', 'church', 'flag', 'corner-sign', 'fingerpost',
];

/** A thing maker: add(kind, fields) -> thing, with ids `${kind}-${prefix}-${n}` (or `${kind}-${n}` with no prefix). */
export function thingMaker(prefix, tile) {
  const things = [];
  const counters = {};
  const add = (kind, fields) => {
    counters[kind] = (counters[kind] ?? 0) + 1;
    const thing = { id: prefix ? `${kind}-${prefix}-${counters[kind]}` : `${kind}-${counters[kind]}`, kind, tile, ...fields };
    things.push(thing);
    return thing;
  };
  return { things, add };
}

/**
 * A tile's plan and things. Seeded by the tile's key: the same tile always plans the same.
 * @param tile a loaded tile (core/world/store.js)
 * @param inRegion (x, z) -> inside the play area
 * @returns {{ plan: { streetTrees, playgrounds, playgroundKit, racks, benches, cornerSigns }, things }}
 */
export function describeTile(tile, inRegion) {
  const rnd = rng(seedOf(tile.key));
  const t = { tile, rnd, inRegion };
  const between = (a, b) => a + rnd() * (b - a);
  const streetTrees = planStreetTrees(t);
  const playgrounds = planPlaygrounds(t);
  const playgroundKit = planPlaygroundKit(t, playgrounds);
  const { racks, benches } = planStreetFurniture(t);
  const cornerSigns = planCornerSigns(t);

  const { things, add } = thingMaker(tile.key, tile.key);
  // a block belongs to the tile its middle is in (every tile it touches lists it)
  for (const b of tile.buildings) {
    if (!b.raised) continue;
    const [x0, z0, x1, z1] = b.box;
    const [x, z] = [(x0 + x1) / 2, (z0 + z1) / 2];
    if (x < tile.rect.x0 || x >= tile.rect.x1 || z < tile.rect.z0 || z >= tile.rect.z1 || !inRegion(x, z)) continue;
    add('block', { x, z, pts: b.pts, levels: b.levels, buildingId: b.id });
  }
  for (const s of streetTrees) {
    const size = TOY.tree * between(0.85, 1.05);
    add('tree', { x: s.x, z: s.z, species: s.kind, size, seed: Math.floor(rnd() * 1e6), solid: SOLID.tree, area: 'street' });
  }
  for (const e of playgroundKit) add('playground', { x: e.x, z: e.z, equipment: e.kind, solid: SOLID.playground });
  for (const [x, z] of racks) add('bike-rack', { x, z, solid: SOLID.rack });
  for (const [x, z] of benches) add('bench', { x, z, solid: SOLID.bench });
  for (const s of cornerSigns) add('corner-sign', { x: s.x, z: s.z, names: s.names, solid: SOLID.sign });
  return { plan: { streetTrees, playgrounds, playgroundKit, racks, benches, cornerSigns }, things };
}

/**
 * A site's plan and things, each thing tagged with the tile it stands on.
 * @param site from core/sites/; @param keep shared keep-out zones; @param keyAt (x, z) -> tile key
 */
export function describeSite(site, keep, keyAt) {
  const rnd = rng(seedOf(site.id));
  const plan = site.plan(keep, rnd);
  const { things, add } = thingMaker(site.id, null);
  site.things(plan, rnd, add);
  for (const t of things) t.tile = keyAt(t.x, t.z);
  return { plan, things };
}

/** Churches, flags and fingerposts: always there (tile 'world'). */
export function describeLandmarks(landmarks, fingerposts) {
  const { things, add } = thingMaker(null, 'world');
  for (const c of landmarks.churches) add('church', { x: c.centre[0], z: c.centre[1], name: c.name, pts: c.pts, tower: c.tower, always: true, landmarkId: c.id });
  for (const f of landmarks.flags) add('flag', { x: f.at[0], z: f.at[1], name: f.name, color: f.color, always: true });
  for (const p of fingerposts) add('fingerpost', { x: p.x, z: p.z, arms: p.arms, solid: SOLID.fingerpost });
  return things;
}
