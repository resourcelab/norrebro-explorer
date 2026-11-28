/**
 * Packed tile data (metres, see scripts/pack-world.mjs) -> map features in world units, with what the game needs to
 * know about each:
 *
 *   building  { type, id, kind, levels, name, pts, box, area, raised, landmark }
 *             raised: it stands up as a block when near (big enough, a real building, not too ragged, not a landmark);
 *             pts are wound with negative signed area, so the shape lies behind its first edge (what folds expect)
 *   street    { type, id, name, kind, width, pts, box, half }   half: the DRAWN half width (units), a little wider than
 *             life (TOY.streetWiden) so the streets read as the way through
 *   area      { type, id, kind, name, sport, pts, box, axis }    park, grass, garden, pitch, playground, square,
 *             schoolyard, parking, flowerbed, water, wood, scrub (cemetery areas are left to the site that owns them).
 *             sport: a pitch's (soccer, basketball, table_tennis, skateboard...); of: a schoolyard's (school,
 *             kindergarten, childcare); axis: the area's oriented box
 *             { x, z, angle, length, width } (angle: its long side, radians), for goals at the ends and line markings
 *   barrier   { id, kind, pts }                                   fence, hedge, wall (a line)
 *
 * Buildings inside a site (the cemetery's chapel and sheds) are left out: the site draws its own.
 */
import { SCALE, TOY } from '../../config.js';
import { toUnits } from '../geo.js';
import { signedArea, boundsOf } from '../map/math.js';

/** Smallest footprint that stands up (units², 4 = 100 m²); smaller ones are sheds and booths. */
const MIN_RAISED_AREA = 4;
/** Untagged ("yes") buildings need this much floor (units², 250 m²) or a mapped storey count to stand up. */
const MIN_UNTAGGED_AREA = 10;
/** Building kinds that never stand up: outbuildings and structures without walls worth folding. */
const NEVER_RAISED = new Set(['garage', 'garages', 'shed', 'kiosk', 'roof', 'carport', 'service', 'toilets']);
/** Footprints with more corners than this are printed flat (prism folds of very ragged outlines look messy). */
const MAX_RAISED_CORNERS = 40;

export const drawnHalf = (widthMetres) => (widthMetres * SCALE * TOY.streetWiden) / 2;

/**
 * The smallest box round a shape, turned to fit it (tried along each edge's direction): { x, z, angle, length,
 * width }, with length along `angle` and length >= width.
 */
export function axisOf(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const a = Math.atan2(bz - az, bx - ax);
    const [c, s] = [Math.cos(a), Math.sin(a)];
    let u0 = Infinity; let u1 = -Infinity; let v0 = Infinity; let v1 = -Infinity;
    for (const [x, z] of pts) { const u = x * c + z * s; const v = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const [um, vm] = [(u0 + u1) / 2, (v0 + v1) / 2];
      const long = u1 - u0 >= v1 - v0;
      best = { area, x: um * c - vm * s, z: um * s + vm * c, angle: long ? a : a + Math.PI / 2, length: Math.max(u1 - u0, v1 - v0), width: Math.min(u1 - u0, v1 - v0) };
    }
  }
  const { area: _area, ...axis } = best;
  return axis;
}
const box = (pts) => { const b = boundsOf(pts); return [b.x0, b.z0, b.x1, b.z1]; };

/**
 * @param raw a packed tile
 * @param ctx { landmarkIds: Set, insideSite(pts) -> boolean }
 */
export function prepareTile(raw, { landmarkIds, insideSite }) {
  const buildings = [];
  for (const b of raw.buildings) {
    let pts = b.pts.map(toUnits);
    if (signedArea(pts) > 0) pts = pts.slice().reverse();
    if (insideSite(pts)) continue;
    const area = Math.abs(signedArea(pts));
    const bigEnough = area >= MIN_RAISED_AREA && (b.kind !== 'yes' || b.levels || area >= MIN_UNTAGGED_AREA);
    const landmark = landmarkIds.has(b.id);
    const raised = !landmark && bigEnough && !NEVER_RAISED.has(b.kind) && pts.length <= MAX_RAISED_CORNERS;
    buildings.push({ type: 'building', id: b.id, kind: b.kind, levels: b.levels, name: b.name, pts, box: box(pts), area, raised, landmark });
  }
  const streets = raw.streets.map((s) => {
    const pts = s.pts.map(toUnits);
    const half = drawnHalf(s.width);
    return { type: 'street', id: s.id, name: s.name, kind: s.kind, width: s.width, pts, box: box(pts), half };
  });
  const areas = raw.areas.filter((a) => a.kind !== 'cemetery').map((a) => {
    const pts = a.pts.map(toUnits);
    return { type: 'area', id: a.id, kind: a.kind, name: a.name, sport: a.sport ?? null, of: a.of ?? null, pts, box: box(pts), axis: axisOf(pts) };
  });
  const barriers = (raw.barriers ?? []).map((b) => ({ id: b.id, kind: b.kind, pts: b.pts.map(toUnits) }));
  return {
    buildings, streets, areas, barriers,
    trees: raw.trees.map(toUnits),
    // [x, z, kind, angle?, length?]: angle in radians, length in units, for props mapped as a strip
    props: raw.props.map(([x, z, kind, angle, length]) => (angle === undefined ? [...toUnits([x, z]), kind] : [...toUnits([x, z]), kind, angle, length * SCALE])),
    pois: raw.pois.map(([x, z, name, category, type]) => ({ x: x * SCALE, z: z * SCALE, name, category, type: type ?? null })),
  };
}

/** The overview (whole area, flat): { bounds: {x0, z0, x1, z1}, streets, areas, buildings: pts[], landmarks: id -> pts }. */
export function prepareOverview(raw) {
  const [x0, z0, x1, z1] = raw.bounds.map((v) => v * SCALE);
  return {
    bounds: { x0, z0, x1, z1 },
    streets: raw.streets.map((s) => { const pts = s.pts.map(toUnits); return { type: 'street', ...s, pts, box: box(pts), half: drawnHalf(s.width) }; }),
    areas: raw.areas.map((a) => { const pts = a.pts.map(toUnits); return { type: 'area', ...a, pts, box: box(pts) }; }),
    buildings: raw.buildings.map((pts) => pts.map(toUnits)),
    landmarks: Object.fromEntries(Object.entries(raw.landmarks).map(([id, pts]) => {
      let p = pts.map(toUnits);
      if (signedArea(p) > 0) p = p.slice().reverse();
      return [id, p];
    })),
  };
}
