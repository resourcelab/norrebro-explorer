/**
 * Where children play: playground equipment, schoolyards, the kit on sports pitches, and the fences round them.
 * Planned per tile like the other neighbourhood rules (see plan/neighbourhood.js for the context `t`), from what
 * OpenStreetMap maps, filled in where it maps less than is really there:
 *
 *   playgrounds  equipment mapped inside one (a swing, a slide...) stands where it is mapped. The rest is filled in by
 *                the playground's size: a 70 m² corner gets a spring rider and a sandpit, a 2,600 m² park playground
 *                eight or nine pieces. Pieces keep clear of each other and of the edge.
 *   schoolyards  a kindergarten's yard is a playground for small children; a school's yard gets a hopscotch court
 *                (styles print it), a basketball hoop and a climbing frame; every school and kindergarten a flagpole.
 *                Colleges and academies are left as they are.
 *   pitches      goals at the ends of a football pitch, hoops on a basketball court, a table on a table-tennis
 *                pitch, a ramp at a skate spot (from the pitch's mapped sport and its long axis).
 *   fences       mapped fences, hedges and walls along those places stand up; others (back yards) don't.
 */
import { SCALE } from '../../config.js';
import { inPolygon, polylineDistance, centroid, splitRuns } from '../map/math.js';
import { SOLID } from '../solid.js';
import { freeGround } from './neighbourhood.js';
import { onRoad } from './street.js';

/** OpenStreetMap playground=* -> the game's equipment. */
const MAPPED_KIT = {
  swing: 'swings', baby_swing: 'swings', basketswing: 'basketswing', slide: 'slide', structure: 'climber',
  climbingframe: 'climber', climbing: 'climber', climbingwall: 'climber', sandpit: 'sandpit', springy: 'springy',
  seesaw: 'seesaw', roundabout: 'roundabout', playhouse: 'playhouse', zipwire: 'swings',
};
/** The order equipment is filled in, biggest playgrounds getting the most. Small playgrounds take the small things. */
const FILL = ['sandpit', 'swings', 'slide', 'springy', 'climber', 'seesaw', 'playhouse', 'roundabout', 'basketswing'];
const SMALL_FILL = ['springy', 'sandpit', 'playhouse', 'springy'];
/** Footprint radius (units) each piece needs clear round it. */
export const KIT_ROOM = { swings: 1.7, basketswing: 1.5, slide: 1.6, climber: 1.4, sandpit: 1.2, springy: 0.6, seesaw: 1.2, roundabout: 1.0, playhouse: 1.0 };
const M2_PER_PIECE = 260; // square metres of playground per piece of equipment (a generous Copenhagen playground)
const MAX_PIECES = 9;

const areaM2 = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const [a, b] = [pts[i], pts[(i + 1) % pts.length]]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2) / (SCALE * SCALE); };
const edgeDistance = (x, z, pts) => polylineDistance(x, z, [...pts, pts[0]]);
const owns = ({ rect }, x, z) => x >= rect.x0 && x < rect.x1 && z >= rect.z0 && z < rect.z1;

/** A card's facing for a piece in an area: along the area's long side, turned toward the camera (south). */
function facing(axis) {
  const n = [-Math.sin(axis.angle), Math.cos(axis.angle)]; // the long side's normal (x east, z south)
  const [nx, nz] = n[1] >= 0 ? n : [-n[0], -n[1]];
  return Math.max(-0.9, Math.min(0.9, Math.atan2(nx, nz))); // within ~50° of facing south, so it reads
}

/**
 * Fill an area with equipment: `wanted` kinds in order, each at a free spot inside it, clear of the edge, the pieces
 * already there and the buildings. Spots are tried on a half-unit grid, in the tile's random order.
 */
function fillArea(t, pts, wanted, placed, { avoidPlaygrounds = false } = {}) {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const spots = [];
  for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.5) for (let z = Math.min(...zs) + 0.25; z < Math.max(...zs); z += 0.5) if (inPolygon(x, z, pts)) spots.push([x, z]);
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(t.rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  // pitches mapped inside a playground or yard are for ball games: equipment keeps off them (and a little clear)
  const pitches = t.tile.areas.filter((a) => a.kind === 'pitch' || (avoidPlaygrounds && a.kind === 'playground'));
  const onPitch = (x, z, r) => pitches.some((p) => inPolygon(x, z, p.pts) || edgeDistance(x, z, p.pts) < r * 0.5);
  const out = [];
  for (const kind of wanted) {
    const r = KIT_ROOM[kind];
    const spot = spots.find(([x, z]) => edgeDistance(x, z, pts) > r * 0.6 && !onPitch(x, z, r) && freeGround(t, x, z, r * 0.5) && !onRoad(t.tile.index, x, z)
      && [...placed, ...out].every((p) => Math.hypot(p.x - x, p.z - z) > r + KIT_ROOM[p.kind] * 0.8));
    if (spot) out.push({ x: spot[0], z: spot[1], kind });
  }
  return out;
}

/**
 * The equipment OpenStreetMap maps in this tile (props "play:*"), wherever it is: [{ x, z, kind, mapped }]. A swing
 * set mapped as a point per seat becomes one piece. It stands where it is mapped, unless that is inside a building
 * (indoor play) or on a road.
 */
function allMappedKit(t) {
  const out = [];
  for (const [x, z, k] of t.tile.props) {
    const kind = MAPPED_KIT[k.slice(5)];
    if (!k.startsWith('play:') || !kind || !t.inRegion(x, z) || t.tile.index.buildingAt(x, z, 0.1) || onRoad(t.tile.index, x, z)) continue;
    const same = out.find((o) => o.kind === kind && Math.hypot(o.x - x, o.z - z) < 1.2);
    if (same) { same.n++; same.x += (x - same.x) / same.n; same.z += (z - same.z) / same.n; } else out.push({ x, z, kind, mapped: true, n: 1 });
  }
  return out.map(({ n: _n, ...k }) => k);
}

/**
 * Equipment for the playgrounds this tile owns (plan/neighbourhood.js planPlaygrounds) and the kindergarten yards.
 * Returns [{ x, z, kind, yaw, mapped, area }].
 */
export function planPlaygroundKit(t, playgrounds) {
  const out = [];
  const places = [
    ...playgrounds.map((pg) => ({ pts: pg.pts, axis: pg.axis, small: false })),
    ...kidsYards(t).filter((y) => y.of !== 'school').map((y) => ({ pts: y.pts, axis: y.axis, small: true })),
  ];
  const mappedHere = allMappedKit(t);
  const used = new Set();
  for (const place of places) {
    const mapped = mappedHere.filter((k) => inPolygon(k.x, k.z, place.pts) || edgeDistance(k.x, k.z, place.pts) < 2);
    for (const k of mapped) used.add(k);
    const m2 = areaM2(place.pts);
    const n = Math.max(1, Math.min(MAX_PIECES, Math.round(m2 / M2_PER_PIECE)));
    const fillFrom = m2 < 200 || place.small ? SMALL_FILL : FILL;
    const have = new Set(mapped.map((k) => k.kind));
    const wanted = fillFrom.filter((k) => !have.has(k) || k === 'springy').slice(0, Math.max(0, n - mapped.length));
    const filled = fillArea(t, place.pts, wanted, mapped);
    const yaw = place.axis ? facing(place.axis) : 0;
    for (const k of [...mapped, ...filled]) out.push({ ...k, yaw, mapped: Boolean(k.mapped) });
  }
  // mapped equipment outside any mapped playground (a swing set in a school yard or a park) stands where it is mapped
  for (const k of mappedHere) if (!used.has(k)) out.push({ ...k, yaw: 0 });
  return out;
}

/** Schoolyards (school, kindergarten, childcare) this tile owns, in the play area; academies and colleges are not. */
function kidsYards(t) {
  return t.tile.areas.filter((a) => a.kind === 'schoolyard' && owns(t.tile, ...centroid(a.pts)) && a.pts.some(([x, z]) => t.inRegion(x, z))
    && (a.of !== 'school' || !a.name || /skole/i.test(a.name)) && !/akademi|erhverv|gymnasium|college/i.test(a.name ?? ''));
}

/**
 * Schoolyards: a flagpole in every school and kindergarten yard, and for schools a basketball hoop and a climbing
 * frame (unless the yard already has a mapped pitch or playground). Returns { flagpoles, kit, hopscotch } with
 * hopscotch the courts for a style to print: [{ x, z, angle }].
 */
export function planSchoolyards(t) {
  const flagpoles = [];
  const kit = [];
  const hopscotch = [];
  for (const yard of kidsYards(t)) {
    const placedHere = [];
    // a school's own things keep out of the playgrounds and pitches mapped inside its yard (those have their own kit)
    const opts = { avoidPlaygrounds: true };
    const [flag] = fillArea(t, yard.pts, ['springy'], placedHere, opts); // a small free spot: springy's room fits a pole
    if (flag) { flagpoles.push({ x: flag.x, z: flag.z, name: yard.name }); placedHere.push(flag); }
    if (yard.of !== 'school') continue;
    const busy = t.tile.areas.some((a) => (a.kind === 'pitch' || a.kind === 'playground') && inPolygon(...centroid(a.pts), yard.pts));
    if (!busy) {
      for (const k of fillArea(t, yard.pts, ['climber', 'swings'], placedHere, opts)) { kit.push({ ...k, yaw: facing(yard.axis), mapped: false }); placedHere.push(k); }
      const [hoop] = fillArea(t, yard.pts, ['roundabout'], placedHere, opts);
      if (hoop) { kit.push({ x: hoop.x, z: hoop.z, kind: 'hoop', yaw: facing(yard.axis), sport: true }); placedHere.push(hoop); }
    }
    const [court] = fillArea(t, yard.pts, ['seesaw'], placedHere, opts); // a seesaw's room is a hopscotch court's
    if (court) hopscotch.push({ x: court.x, z: court.z, angle: yard.axis.angle });
  }
  return { flagpoles, kit, hopscotch };
}

/**
 * Kit on the pitches this tile owns, by sport. Returns [{ x, z, kind: goal | hoop | table | ramp, yaw }]; goals and
 * hoops face each other down the pitch.
 */
export function planPitchKit(t) {
  const out = [];
  for (const p of t.tile.areas) {
    if (p.kind !== 'pitch' || !owns(t.tile, p.axis.x, p.axis.z) || !t.inRegion(p.axis.x, p.axis.z)) continue;
    const sports = (p.sport ?? '').split(';');
    const { x, z, angle, length } = p.axis;
    const [ux, uz] = [Math.cos(angle), Math.sin(angle)];
    const ends = (inset, kind) => {
      for (const s of [-1, 1]) {
        const [ex, ez] = [x + ux * s * (length / 2 - inset), z + uz * s * (length / 2 - inset)];
        if (freeGround(t, ex, ez, 0.2)) out.push({ x: ex, z: ez, kind, yaw: Math.atan2(-ux * s, -uz * s) });
      }
    };
    if (sports.some((s) => ['soccer', 'multi', 'five-a-side'].includes(s)) && length > 3) ends(0.35, 'goal');
    else if (sports.includes('basketball') && length > 2) ends(0.6, 'hoop');
    else if (sports.includes('table_tennis') && freeGround(t, x, z, 0.3)) out.push({ x, z, kind: 'table', yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)) });
    else if (sports.includes('skateboard') && freeGround(t, x, z, 0.3)) out.push({ x, z, kind: 'ramp', yaw: 0 });
  }
  return out;
}

/**
 * Mapped fences, hedges and walls round playgrounds, schoolyards and pitches, cut into straight runs. A run belongs to
 * the tile its middle is in. Returns [{ a, b, x, z, style }].
 */
export function planFences(t) {
  const places = t.tile.areas.filter((a) => ['playground', 'schoolyard', 'pitch'].includes(a.kind));
  const out = [];
  for (const b of t.tile.barriers) {
    for (const [a, c] of splitRuns(b.pts, { maxLen: 3 })) {
      const [mx, mz] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      if (!owns(t.tile, mx, mz) || !t.inRegion(mx, mz) || t.tile.index.buildingAt(mx, mz, 0.1) || onRoad(t.tile.index, mx, mz)) continue;
      if (!places.some((p) => inPolygon(mx, mz, p.pts) || edgeDistance(mx, mz, p.pts) < 1.2)) continue;
      out.push({ a, b: c, x: mx, z: mz, style: b.kind });
    }
  }
  return out;
}

export const KIT_SOLID = SOLID.kit;
