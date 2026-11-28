/**
 * Find your way home. A child types where they live (an address: core/address.js) or picks a place they know (their
 * school, a church, a park, a bakery: data/home-places.js); the game drops them at another place they know, a walk
 * away, and they find their way back by reading the streets: signs, shops, steeples, the playground. The game is
 * otherwise a free walk: a round runs only when someone starts one.
 *
 *   const round = createRound(game);
 *   const home = await round.homeAt(await book.find('Blågårdsgade 12'));  // the pavement in front of the door
 *   await round.start({ home, level: 'middle' });   // or start({ homeId: 'blaagaards-skole', ... })
 *   round.peek();   // a look at the map, if there are peeks left
 *   round.arrow();  // an arrow toward home for a few seconds, if there are arrows left
 *
 * game.state.round, while a round is on:
 *   home, from        { id, name, en, x, z }: where home is, and where the walk started
 *   level             the level's settings (LEVELS below)
 *   status            'walking' | 'home'
 *   time              seconds walking
 *   peeksLeft, arrowsLeft, peeksUsed, arrowsUsed
 *   arrowUntil        game time until which the arrow shows
 *   jaywalks          times the walker stepped onto a road away from a crossing
 *   path              [[x, z], ...] where he walked, a point every half second
 *   walked            units walked
 *   stars             1-3, when home: three, less one for each peek or arrow used
 *
 * While a round is on, the free zoom is off: Z, the zoom button or the minimap spend a peek instead.
 * Everything here is game logic, no drawing: src/ui/round.js shows it.
 */
import { HOME_PLACES } from '../data/home-places.js';
import { lonLatToUnits } from './geo.js';
import { onRoad } from './plan/street.js';
import { nearestOnPolyline } from './map/math.js';
import { rng, seedOf } from './random.js';
import { REGION } from '../config.js';

/**
 * The levels. spawn: how far from home the walk starts (units, as the crow flies; 20 units = 100 m). minimap: the
 * corner map shows (with home on it). peeks: looks at the map view; arrows: seconds-long arrows toward home.
 */
export const LEVELS = {
  small: { id: 'small', label: 'Lille', en: 'Little', spawn: [20, 55], minimap: true, peeks: 3, arrows: 3 },
  middle: { id: 'middle', label: 'Mellem', en: 'Middle', spawn: [45, 100], minimap: false, peeks: 3, arrows: 2 },
  big: { id: 'big', label: 'Stor', en: 'Big', spawn: [90, 400], minimap: false, peeks: 1, arrows: 0 },
};
const HOME_REACH = 2.4; // units (12 m): this close to home counts as home
const PEEK_SECONDS = 4;
const ARROW_SECONDS = 4;
const PATH_EVERY = 0.5;
const ROAD_CHECK = 0.2;
const CROSSING_NEAR = 1.8; // units: on a road this close to a crossing is crossing properly

/** The places, in units: [{ id, name, en, kind, x, z }]. */
export const PLACES = HOME_PLACES.map((p) => { const [x, z] = lonLatToUnits(...p.lonLat); return { ...p, x, z }; });

/**
 * Whether the walker could get out from (x, z) into the streets: the open ground there, flooded on a half-unit grid
 * inside the play area, runs on past OPEN cells (a closed yard, or a scrap of pavement cut off by the map's edge, is
 * smaller).
 */
const OPEN = 6000;
function opensOut(game, x, z) {
  const S = 0.5;
  const seen = new Set();
  const stack = [[Math.round(x / S), Math.round(z / S)]];
  let n = 0;
  while (stack.length) {
    const [i, j] = stack.pop();
    const key = i * 100000 + j;
    if (seen.has(key)) continue;
    seen.add(key);
    const [px, pz] = [i * S, j * S];
    if (px < REGION.x0 || px > REGION.x1 || pz < REGION.z0 || pz > REGION.z1 || game.colliders.blocked(px, pz)) continue;
    if (++n > OPEN) return true;
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1], [i + 1, j + 1], [i - 1, j - 1], [i + 1, j - 1], [i - 1, j + 1]);
  }
  return false;
}

/**
 * Flood the open ground from `from` (8-way, half-unit grid, out to REACH units) and return the reached spot nearest to
 * `to` that ok(x, z) accepts, or null. throughWalls: look at every spot within 4 units instead, walls or not.
 */
const REACH = 10;
function nearestFrom(game, [fx, fz], [tx, tz], ok, throughWalls = false) {
  const S = 0.5;
  const seen = new Set();
  const stack = [[Math.round(fx / S), Math.round(fz / S)]];
  const reach = throughWalls ? 4 : REACH; // throughWalls: any open spot near (fx, fz), even past a wall
  let best = null;
  while (stack.length) {
    const [i, j] = stack.pop();
    const key = i * 100000 + j;
    if (seen.has(key)) continue;
    seen.add(key);
    const [px, pz] = [i * S, j * S];
    if (Math.hypot(px - fx, pz - fz) > reach) continue;
    const wall = game.colliders.blocked(px, pz);
    if (wall && !throughWalls) continue;
    const d = Math.hypot(px - tx, pz - tz);
    if (!wall && (!best || d < best.d) && ok(px, pz)) best = { x: px, z: pz, d };
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) stack.push([i + a, j + b]);
  }
  return best && [best.x, best.z];
}

export function createRound(game) {
  let round = null;
  let sincePath = 0;
  let sinceRoad = 0;
  let onRoadNow = false;
  let peekBackAt = null;
  let walks = 0;
  const finished = [];

  // the free zoom spends a peek while a round is on
  game.zoomGuard = () => {
    if (!round || round.status !== 'walking') return true;
    api.peek();
    return false;
  };

  game.onFrame((state, dt) => {
    if (!round) return;
    const hero = state.hero;
    if (peekBackAt !== null && state.time >= peekBackAt) { peekBackAt = null; game.toggleZoom(game.settings.zoomOrder[0], { force: true }); }
    if (round.status !== 'walking') return;
    round.time += dt;
    sincePath += dt;
    if (sincePath >= PATH_EVERY) {
      sincePath = 0;
      const last = round.path[round.path.length - 1];
      round.walked += Math.hypot(hero.x - last[0], hero.z - last[1]);
      round.path.push([hero.x, hero.z]);
    }
    sinceRoad += dt;
    if (sinceRoad >= ROAD_CHECK) {
      sinceRoad = 0;
      const road = onRoad(game.map.store.index, hero.x, hero.z);
      const atCrossing = game.things.some((t) => t.kind === 'crossing' && Math.hypot(t.x - hero.x, t.z - hero.z) < CROSSING_NEAR + t.length / 2);
      if (road && !onRoadNow && !atCrossing) { round.jaywalks++; round.lastJaywalk = state.time; }
      onRoadNow = road;
    }
    if (Math.hypot(hero.x - round.home.x, hero.z - round.home.z) < HOME_REACH) {
      round.status = 'home';
      const last = round.path[round.path.length - 1];
      round.walked += Math.hypot(hero.x - last[0], hero.z - last[1]);
      round.path.push([hero.x, hero.z]);
      round.stars = Math.max(1, 3 - round.peeksUsed - round.arrowsUsed);
      round.straight = Math.hypot(round.home.x - round.from.x, round.home.z - round.from.z);
      finished.forEach((fn) => fn(round));
    }
  });

  const api = {
    places: PLACES,
    levels: LEVELS,

    /**
     * Home for an address (from core/address.js): the spot on the pavement in front of it, on its own street, where
     * the walker can stand and walk out from. Loads the tiles there. Resolves to { id, name, en, x, z, address: true },
     * or null (no such spot: its street runs just beyond the map's edge, say).
     */
    async homeAt(address) {
      if (!address || address.outside) return null;
      const streets = game.map.overview.streets.filter((s) => s.name === address.street);
      const [ax, az] = [address.x, address.z];
      let best = null;
      for (const s of streets) {
        const near = nearestOnPolyline(s.pts, ax, az);
        if (!best || near.d < best.d) best = { ...near, half: s.half };
      }
      if (!best) return null;
      // aim for the pavement on the house side, out from the middle of the street toward the door
      const out = best.d > 0.01 ? Math.min(best.half + 0.9, best.d) / best.d : 0;
      const [tx, tz] = [best.x + (ax - best.x) * out, best.z + (az - best.z) * out];
      await game.load(tx, tz);
      // the street there must lead somewhere (not a scrap cut off by the map's edge); then the nearest free pavement
      // that can be walked to from it, so never a closed yard behind the house
      // (the overview's street lines are simplified: start from the open ground nearest the line)
      const road = (a, b) => onRoad(game.map.store.index, a, b);
      const start = nearestFrom(game, [best.x, best.z], [best.x, best.z], road, true);
      if (!start || !opensOut(game, ...start)) return null;
      const spot = nearestFrom(game, start, [tx, tz], (a, b) => !road(a, b));
      if (!spot) return null;
      const [x, z] = spot;
      return { id: `address:${address.label}`, name: address.label, en: address.label, x, z, address: true };
    },

    /**
     * Start a walk home: home is the picked place, the walk starts at another known place within the level's distance
     * (the nearest band that has one, if none is within it). Loads the tiles there and puts the walker on the spot.
     * `seed` picks the start (the same seed, the same walk); each new walk takes the next one.
     */
    async start({ home = null, homeId = null, level = 'small', seed = null }) {
      home ??= PLACES.find((p) => p.id === homeId);
      if (!home) throw new Error(`round: no place "${homeId}"`);
      const L = LEVELS[level] ?? LEVELS.small;
      const r = rng(seed ?? seedOf(`${home.id}:${level}:${walks++}:${Date.now()}`));
      const others = PLACES.filter((p) => p.id !== home.id && Math.hypot(p.x - home.x, p.z - home.z) > HOME_REACH * 3).map((p) => ({ p, d: Math.hypot(p.x - home.x, p.z - home.z) }));
      let pool = others.filter((o) => o.d >= L.spawn[0] && o.d <= L.spawn[1]);
      if (!pool.length) { const mid = (L.spawn[0] + L.spawn[1]) / 2; pool = others.sort((a, b) => Math.abs(a.d - mid) - Math.abs(b.d - mid)).slice(0, 2); }
      const from = pool[Math.floor(r() * pool.length)].p;
      game.toggleZoom(game.settings.zoomOrder[0], { force: true, instant: true });
      if (!(await game.goTo(from.x, from.z))) throw new Error(`round: can't stand at ${from.id}`);
      peekBackAt = null;
      onRoadNow = false;
      round = {
        home, from, level: L, status: 'walking', time: 0,
        peeksLeft: L.peeks, arrowsLeft: L.arrows, peeksUsed: 0, arrowsUsed: 0, arrowUntil: -1,
        jaywalks: 0, lastJaywalk: -Infinity, path: [[from.x, from.z]], walked: 0, stars: 0,
      };
      game.state.round = round;
      return round;
    },

    /** A look at the map view for a few seconds (spends a peek). Returns true if there was one to spend. */
    peek() {
      if (!round || round.status !== 'walking' || round.peeksLeft <= 0 || peekBackAt !== null) return false;
      round.peeksLeft--;
      round.peeksUsed++;
      game.toggleZoom('map', { force: true });
      peekBackAt = game.state.time + PEEK_SECONDS;
      return true;
    },

    /** An arrow toward home for a few seconds (spends an arrow). Returns true if there was one to spend. */
    arrow() {
      if (!round || round.status !== 'walking' || round.arrowsLeft <= 0) return false;
      round.arrowsLeft--;
      round.arrowsUsed++;
      round.arrowUntil = game.state.time + ARROW_SECONDS;
      return true;
    },

    /** Stop the round and walk freely (the free zoom comes back). */
    stop() { round = null; game.state.round = null; peekBackAt = null; },

    onFinish(fn) { finished.push(fn); },
    get current() { return round; },
  };
  return api;
}
