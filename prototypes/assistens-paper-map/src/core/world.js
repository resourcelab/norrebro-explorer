/**
 * The world as a list of THINGS: everything that stands on the map, described by what it is, never by how it looks.
 * Things are the contract between the game core and the styles: a style is told when things arrive and leave and
 * decides how each kind looks (a paper card, a pixel sprite, a flat icon). Every thing is plain data:
 *
 *   { id, kind, category, x, z, tile, solid?, always?, ...fields of its kind }
 *
 *   id      stable string ('tree-6_7-12'), the same on every load, used to say it has come near or gone far
 *   x, z    where it stands (world units; x east, z south). Long things (wall runs) also give a and b.
 *   category  what sort of thing it is (core/kinds.js): a style that doesn't know the kind draws it by this
 *   tile    the tile it belongs to (the one its position falls in), or 'world' for things that are always there
 *   solid   radius (units) the walker cannot enter, or absent. core/colliders.js builds collision from it.
 *   always  true for landmarks: always "near", so a style keeps them standing to steer by
 *
 * Kinds and their fields:
 *   chapel        pts (footprint), yaw                   shed         pts
 *   wall          a, b, wall: 'wall' | 'hedge'           gate-post    -
 *   tree          species, size, seed                    grave        variant, size
 *                 (size: this one's height against the usual for its kind, TOY.heights in config.js: 0.85-1.27)
 *   notable-grave name, index, tall                       bench, lamp, tap
 *   critter       species: 'crow' | 'squirrel'           block        pts, levels, buildingId
 *   playground    equipment: swings | basketswing | slide | climber | sandpit | springy | seesaw | roundabout |
 *                 playhouse; yaw; mapped (true where OpenStreetMap maps it, false where filled in by size)
 *   sport-kit     equipment: goal | hoop | table | ramp; yaw (goals and hoops face down the pitch)
 *   flagpole      name (the school or kindergarten)           fence     a, b, style: fence | hedge | wall
 *   bin, picnic-table (yaw), bus-stop (yaw), traffic-light (yaw)
 *   crossing      a zebra crossing: angle (across the road), along (the road's direction), length (its width),
 *                 signals
 *   bike-rack     -                                      corner-sign  names
 *   fingerpost    arms: [{ name, dx, metres }]          flag         name, color
 *   church        name, pts, tower: [x, z]
 *   shopfront     name, place (OSM type: bakery, cafe...), group (food | shop | everyday | culture), label (the type
 *                 in words), a, b (its two ends on the facade), yaw (the way it faces), height (the shop floor),
 *                 footprint (the block's outline), buildingId
 * Cyclists move, so they are not things: core/traffic.js keeps them in the game state.
 *
 * Where things come from:
 *   describeTile     a tile's own things (blocks, shopfronts, street trees, playground kit, racks, benches, corner
 *                    signs), planned
 *                    from that tile alone with its own random stream
 *   describeSite     a site's things (Assistens: the chapel, walls, graves...), planned once, then handed out to the
 *                    tiles they stand on
 *   describeLandmarks  churches, flags and fingerposts: always there, whatever is loaded
 *
 * Sizes: a style draws each kind at its TOY.heights (config.js), times a thing's own `size` where it has one, so every
 * style keeps the same proportions.
 */
import { SOLID } from './solid.js';
import { KINDS, KIND_CATEGORY } from './kinds.js';
import { rng, seedOf } from './random.js';
import { planStreetTrees, planPlaygrounds, planCornerSigns, freeGround } from './plan/neighbourhood.js';
import { planPlaygroundKit, planSchoolyards, planPitchKit, planFences } from './plan/play.js';
import { planStreetFurniture, planCrossings, onRoad } from './plan/street.js';
import { planShopfronts } from './plan/shops.js';

export { KINDS };

/** A thing maker: add(kind, fields) -> thing, with ids `${kind}-${prefix}-${n}` (or `${kind}-${n}` with no prefix). */
export function thingMaker(prefix, tile) {
  const things = [];
  const counters = {};
  const add = (kind, fields) => {
    counters[kind] = (counters[kind] ?? 0) + 1;
    if (!KIND_CATEGORY[kind]) throw new Error(`world: unknown kind "${kind}" (add it to core/kinds.js)`);
    const thing = { id: prefix ? `${kind}-${prefix}-${counters[kind]}` : `${kind}-${counters[kind]}`, kind, category: KIND_CATEGORY[kind], tile, ...fields };
    things.push(thing);
    return thing;
  };
  return { things, add };
}

/**
 * A tile's plan and things. Seeded by the tile's key: the same tile always plans the same.
 * @param tile a loaded tile (core/world/store.js)
 * @param inRegion (x, z) -> inside the play area
 * @returns {{ plan: { streetTrees, playgrounds, playgroundKit, schoolyards, pitchKit, fences, furniture, crossings,
 *   cornerSigns, shopfronts }, things }}
 */
export function describeTile(tile, inRegion) {
  const rnd = rng(seedOf(tile.key));
  const t = { tile, rnd, inRegion };
  const between = (a, b) => a + rnd() * (b - a);
  const streetTrees = planStreetTrees(t);
  const playgrounds = planPlaygrounds(t);
  const playgroundKit = planPlaygroundKit(t, playgrounds);
  const schoolyards = planSchoolyards(t);
  const pitchKit = planPitchKit(t);
  const fences = planFences(t);
  const furniture = planStreetFurniture(t);
  const crossings = planCrossings(t);
  const cornerSigns = planCornerSigns(t);
  const shopfronts = planShopfronts(t);

  const { things: made, add } = thingMaker(tile.key, tile.key);
  // a block belongs to the tile its middle is in (every tile it touches lists it)
  for (const b of tile.buildings) {
    if (!b.raised) continue;
    const [x0, z0, x1, z1] = b.box;
    const [x, z] = [(x0 + x1) / 2, (z0 + z1) / 2];
    if (x < tile.rect.x0 || x >= tile.rect.x1 || z < tile.rect.z0 || z >= tile.rect.z1 || !inRegion(x, z)) continue;
    add('block', { x, z, pts: b.pts, levels: b.levels, buildingId: b.id });
  }
  for (const s of streetTrees) {
    const size = between(0.85, 1.05);
    add('tree', { x: s.x, z: s.z, species: s.kind, size, seed: Math.floor(rnd() * 1e6), solid: SOLID.tree, area: 'street' });
  }
  for (const e of [...playgroundKit, ...schoolyards.kit.filter((k) => !k.sport)]) {
    add('playground', { x: e.x, z: e.z, equipment: e.kind, yaw: e.yaw, mapped: e.mapped, solid: SOLID.kit[e.kind] || undefined });
  }
  const KIT = { goal: SOLID.goal, hoop: SOLID.hoop, table: SOLID.table, ramp: SOLID.ramp };
  for (const e of [...pitchKit, ...schoolyards.kit.filter((k) => k.sport)]) add('sport-kit', { x: e.x, z: e.z, equipment: e.kind, yaw: e.yaw, solid: KIT[e.kind] });
  for (const f of schoolyards.flagpoles) add('flagpole', { x: f.x, z: f.z, name: f.name, solid: SOLID.flagpole });
  for (const f of fences) add('fence', { x: f.x, z: f.z, a: f.a, b: f.b, style: f.style }); // decoration: gates are rarely mapped
  for (const r of furniture.racks) add('bike-rack', { x: r.x, z: r.z, yaw: r.yaw, solid: SOLID.rack });
  for (const b of furniture.benches) add('bench', { x: b.x, z: b.z, yaw: b.yaw, solid: SOLID.bench });
  for (const b of furniture.bins) add('bin', { x: b.x, z: b.z, solid: SOLID.bin });
  for (const p of furniture.picnics) add('picnic-table', { x: p.x, z: p.z, yaw: p.yaw, solid: SOLID.picnic });
  for (const p of furniture.taps) add('tap', { x: p.x, z: p.z, solid: SOLID.tap });
  for (const p of furniture.lamps) add('lamp', { x: p.x, z: p.z, solid: SOLID.lamp });
  for (const p of furniture.busStops) add('bus-stop', { x: p.x, z: p.z, yaw: p.yaw, solid: SOLID.busStop });
  for (const c of crossings) {
    add('crossing', { x: c.x, z: c.z, angle: c.angle, along: c.along, length: c.length, signals: c.signals });
    for (const [x, z] of c.lights) add('traffic-light', { x, z, yaw: c.along, solid: SOLID.light });
  }
  for (const s of cornerSigns) add('corner-sign', { x: s.x, z: s.z, names: s.names, solid: SOLID.sign });
  for (const f of shopfronts) add('shopfront', f); // on the block's wall: the block is the solid part
  const things = spreadOut(made, (x, z) => freeGround(t, x, z, 0.2) && !onRoad(tile.index, x, z));
  return { plan: { streetTrees, playgrounds, playgroundKit, schoolyards, pitchKit, fences, furniture, crossings, cornerSigns, shopfronts }, things };
}

/** Which solid things give way to which when two crowd each other: earlier in the list stays put. */
const STAYS = ['playground', 'sport-kit', 'corner-sign', 'traffic-light', 'bus-stop', 'flagpole', 'tree', 'bench', 'picnic-table', 'bike-rack', 'bin', 'tap', 'lamp'];

/**
 * Solid things that crowd each other (a bench against a tree trunk, a bin in a bike rack) are nudged apart: the one
 * lower in STAYS steps up to 0.7 units to the nearest free spot, or is left out if there is none.
 */
function spreadOut(things, free) {
  const order = (t) => { const i = STAYS.indexOf(t.kind); return i < 0 ? -1 : i; };
  const solid = things.filter((t) => t.solid && order(t) >= 0).sort((a, b) => order(a) - order(b));
  const kept = [];
  const dropped = new Set();
  const clear = (t, x, z) => kept.every((o) => Math.hypot(o.x - x, o.z - z) >= (o.solid + t.solid) * 0.85);
  for (const t of solid) {
    if (clear(t, t.x, t.z)) { kept.push(t); continue; }
    let spot = null;
    for (let r = 0.15; r <= 0.7 && !spot; r += 0.15) {
      for (let k = 0; k < 12 && !spot; k++) {
        const [x, z] = [t.x + Math.cos((k / 12) * 2 * Math.PI) * r, t.z + Math.sin((k / 12) * 2 * Math.PI) * r];
        if (clear(t, x, z) && free(x, z)) spot = [x, z];
      }
    }
    if (spot) { [t.x, t.z] = spot; kept.push(t); } else dropped.add(t);
  }
  return things.filter((t) => !dropped.has(t));
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
