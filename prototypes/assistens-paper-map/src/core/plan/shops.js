/**
 * Shopfronts: every named shop, café, bakery, school or library OpenStreetMap places in a block gets a shopfront on
 * that block's ground floor, on the facade that faces the street, as near to the mapped point as the facade allows.
 * Planned per tile, like the other neighbourhood rules (see plan/neighbourhood.js for the context `t`).
 *
 * OpenStreetMap maps a shop as a point, usually inside its building or on its front wall, so:
 *   1. the building: the one the point is in, or the nearest within reach (an entrance mapped on the pavement)
 *   2. the facade: the building's edges that face open ground with a street close by (not a courtyard, not the
 *      neighbour's wall); of those, the one nearest the point
 *   3. the place on it: the point slid onto that edge, the shopfront kept on the edge and clear of the other
 *      shopfronts on the same block
 */
import { SCALE, TOY } from '../../config.js';
import { segmentDistance, inPolygon } from '../map/math.js';
import { siteAt } from '../sites/index.js';
import { PLACE_TYPES, PLACE_GROUPS, SHOP_GROUPS, NOT_A_SHOPFRONT } from '../../data/places.js';

/** How wide a shopfront is (units): 8 m, a shop window and a door. */
export const SHOPFRONT_WIDTH = 8 * SCALE;
const FIND_BUILDING = 1.6; // units (8 m): a point this close to a block belongs to it
const FACADE_MIN = 1.0; // units: shorter edges (corners, bays) don't take a shopfront
const OPEN_GROUND = 0.8; // units out from a facade that must be open ground (not a building)
const STREET_NEAR = 4; // units: a facade faces a street when one is this close in front of it

/** What the game calls a place: its type in words, or its group. */
export const placeLabel = (type, group) => PLACE_TYPES[type] ?? PLACE_GROUPS[group] ?? '';

/** Outward unit normal of edge a -> b of a polygon (whichever side is outside). */
function outward(a, b, pts) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz);
  const n = [dz / L, -dx / L];
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  return inPolygon(mx + n[0] * 0.05, mz + n[1] * 0.05, pts) ? [-n[0], -n[1]] : n;
}

/** The facades of a building that face the street: [{ a, b, n, length }]. */
function streetFacades(t, b) {
  const out = [];
  for (let i = 0; i < b.pts.length; i++) {
    const a = b.pts[i];
    const c = b.pts[(i + 1) % b.pts.length];
    const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (length < FACADE_MIN) continue;
    const n = outward(a, c, b.pts);
    const mx = (a[0] + c[0]) / 2;
    const mz = (a[1] + c[1]) / 2;
    const { reach } = t.tile; // beyond its reach a tile can't tell a street from a yard
    if (mx < reach.x0 + STREET_NEAR || mx > reach.x1 - STREET_NEAR || mz < reach.z0 + STREET_NEAR || mz > reach.z1 - STREET_NEAR) continue;
    const [ox, oz] = [mx + n[0] * OPEN_GROUND, mz + n[1] * OPEN_GROUND];
    if (t.tile.index.buildingAt(ox, oz, 0) || siteAt(ox, oz)) continue; // a neighbour's wall or a courtyard
    if (t.tile.index.streetDistance(mx + n[0] * 1.5, mz + n[1] * 1.5) > STREET_NEAR) continue; // a yard, not a street
    out.push({ a, b: c, n, length });
  }
  return out;
}

/**
 * Returns [{ x, z, a, b, yaw, name, place, group, label, height, footprint, buildingId }]: x, z the middle of the
 * shopfront on the facade, a and b its two ends, yaw the way it faces (radians, 0 = south, π/2 = east, like the
 * walker's heading), footprint the block's outline (a style that draws blocks simplified can move the front onto
 * its own facade).
 */
export function planShopfronts(t) {
  // every place the tile can see (its own and its neighbours' within the margin), in a fixed order, so neighbouring
  // tiles share out a block's facade the same way; then only the tile's own are kept
  const { rect, reach } = t.tile;
  const owns = (p) => p.x >= rect.x0 && p.x < rect.x1 && p.z >= rect.z0 && p.z < rect.z1;
  const fronts = [];
  const pois = t.tile.pois
    .filter((p) => p.x >= reach.x0 && p.x <= reach.x1 && p.z >= reach.z0 && p.z <= reach.z1)
    .filter((p) => SHOP_GROUPS.has(p.category) && !NOT_A_SHOPFRONT.has(p.type) && t.inRegion(p.x, p.z) && !siteAt(p.x, p.z))
    .sort((p, q) => p.x - q.x || p.z - q.z || (p.name < q.name ? -1 : 1));
  for (const p of pois) {
    const b = t.tile.index.buildingAt(p.x, p.z, 0) ?? t.tile.index.buildingAt(p.x, p.z, FIND_BUILDING);
    if (!b || !b.raised) continue; // a kiosk or a booth: no block to put a front on
    let best = null;
    for (const f of streetFacades(t, b)) {
      const d = segmentDistance(p.x, p.z, f.a, f.b);
      if (!best || d < best.d) best = { ...f, d };
    }
    if (!best) continue;
    const { a, b: c, n, length } = best;
    const u = [(c[0] - a[0]) / length, (c[1] - a[1]) / length];
    const w = Math.min(SHOPFRONT_WIDTH, length * 0.9);
    // slide the point onto the facade and keep the front on it; if another front on this block (facing the same way:
    // a facade may be several straight pieces) is in the way, try a shop's width to either side, nearest first
    const at = (k) => [a[0] + u[0] * k, a[1] + u[1] * k];
    const yaw = Math.atan2(n[0], n[1]);
    const neighbours = fronts.filter((f) => f.buildingId === b.id && Math.abs(Math.atan2(Math.sin(f.yaw - yaw), Math.cos(f.yaw - yaw))) < 0.35);
    const s0 = Math.max(w / 2, Math.min(length - w / 2, (p.x - a[0]) * u[0] + (p.z - a[1]) * u[1]));
    // open ground and a street in front of the shop itself, not only of the facade's middle
    const faces = (k) => {
      const [fx, fz] = at(k);
      return !t.tile.index.buildingAt(fx + n[0] * OPEN_GROUND, fz + n[1] * OPEN_GROUND, 0)
        && t.tile.index.streetDistance(fx + n[0] * 1.5, fz + n[1] * 1.5) <= STREET_NEAR;
    };
    const s = [0, 1, -1, 2, -2, 3, -3].map((k) => s0 + k * w)
      .find((k) => k >= w / 2 - 1e-6 && k <= length - w / 2 + 1e-6 && faces(k) && neighbours.every((f) => Math.hypot(at(k)[0] - f.x, at(k)[1] - f.z) >= w * 0.95));
    if (s === undefined) continue; // the facade is full
    const [x, z] = at(s);
    fronts.push({
      x: x + n[0] * 0.02, z: z + n[1] * 0.02, a: at(s - w / 2), b: at(s + w / 2), yaw,
      name: p.name, place: p.type, group: p.category, label: placeLabel(p.type, p.category), buildingId: b.id,
      height: TOY.groundFloor, footprint: b.pts, own: owns(p),
    });
  }
  return fronts.filter((f) => f.own).map(({ own: _own, ...f }) => f);
}
