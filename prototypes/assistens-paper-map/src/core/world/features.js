/**
 * Packed tile data (metres, see scripts/pack-world.mjs) -> map features in world units, with what the game needs to
 * know about each:
 *
 *   building  { type, id, kind, levels, name, pts, box, area, raised, landmark }
 *             raised: it stands up as a block when near (big enough, a real building, not too ragged, not a landmark);
 *             pts are wound with negative signed area, so the shape lies behind its first edge (what folds expect)
 *   street    { type, id, name, kind, width, pts, box, half }   half: the DRAWN half width (units), a little wider than
 *             life (TOY.streetWiden) so the streets read as the way through
 *   area      { type, id, kind, name, pts, box }                 park, grass, garden, pitch, playground, square,
 *             schoolyard, parking, flowerbed, water, wood, scrub (cemetery areas are left to the site that owns them)
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
    return { type: 'area', id: a.id, kind: a.kind, name: a.name, pts, box: box(pts) };
  });
  return {
    buildings, streets, areas,
    trees: raw.trees.map(toUnits),
    props: raw.props.map(([x, z, kind]) => [...toUnits([x, z]), kind]),
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
