/**
 * The game: everything that happens, with no graphics. It opens the world, loads the tiles round the walker as he
 * walks (and drops the far ones), plans each tile into things, moves the walker (input, walking, collision), keeps the
 * cyclists riding, decides what is near, and knows where you are. A style (src/styles/) is handed the game, draws it,
 * and runs the frame loop; the overlays (src/ui/) read game.state and game.map.
 *
 *   const game = await createGame({ loader });        // loader: where the packed world comes from (main.js)
 *   await game.attach(createSomeStyle(game));          // loads the first tiles, builds the style, starts the loop
 *
 * game.state, updated every step:
 *   hero    { x, z, heading, speed, maxSpeed }  heading: radians, 0 faces south (+z), π/2 faces east
 *   riders  [{ id, x, z, dx, dz }]             the cyclists
 *   zoom    'street' | 'neighbourhood' | 'map' (config.js ZOOMS)
 *   view    { yaw }                            the style's camera turn (degrees), for the compass
 *   place   { name, about, kind } | null        where you are (a notable grave, a landmark)
 *   street  string | null                      the street you are on
 *   time    seconds since the start
 *
 * game.things is every thing present now (it changes as tiles load and unload); game.map is the map for drawing
 * (see the end of this file).
 */
import { WALK, NEARBY, START, ZOOMS, ZOOM_ORDER, REGION, TILES } from '../config.js';
import { openWorld } from './world/store.js';
import { createSpatialIndex } from './world/index.js';
import { boundsOf } from './map/math.js';
import { createLandmarks, LANDMARK_BUILDINGS } from './map/landmarks.js';
import { createWalkRules } from './map/walk.js';
import { SITES, insideSite } from './sites/index.js';
import { createKeepOut } from './plan/keep-out.js';
import { createWayfinding } from './plan/wayfinding.js';
import { describeTile, describeSite, describeLandmarks } from './world.js';
import { onRoad } from './plan/street.js';
import { rng } from './random.js';
import { createColliders } from './colliders.js';
import { createMover } from './movement.js';
import { createNearby } from './nearby.js';
import { createTraffic } from './traffic.js';
import { createPlaces } from './places.js';
import { createKeyboard } from './input.js';

const PLACES_EVERY = 0.2; // seconds between "where am I?" lookups
export const inRegion = (x, z) => x > REGION.x0 && x < REGION.x1 && z > REGION.z0 && z < REGION.z1;

/**
 * @param loader { manifest(), overview(), tile(key) }: async, each returns parsed JSON (see core/world/store.js)
 * @param input an input source with read() and clear(); default: the keyboard
 */
export async function createGame({ loader, input = null } = {}) {
  const store = await openWorld(loader, { landmarkIds: LANDMARK_BUILDINGS, insideSite });
  const { overview } = store;

  // the overview's own index: for plans that span the map (fingerposts) and for landmarks
  const overviewIndex = createSpatialIndex();
  for (const s of overview.streets) overviewIndex.add(s);
  for (const a of overview.areas) if (a.kind === 'water') overviewIndex.add(a);
  for (const pts of overview.buildings) { const b = boundsOf(pts); overviewIndex.add({ type: 'building', pts, box: [b.x0, b.z0, b.x1, b.z1] }); }

  const landmarks = createLandmarks(overview, overviewIndex);
  const wayfinding = createWayfinding({ overview, overviewIndex, inRegion });

  // sites are planned once (seeded); their things wait for their tiles
  const keep = createKeepOut();
  keep.add(START[0], START[1], 2.6); // nothing may crowd the walker's start
  const sitePlans = {};
  const waiting = new Map(); // tile key -> site things on it
  for (const site of SITES) {
    const { plan, things } = describeSite(site, keep, store.keyAt);
    sitePlans[site.id] = plan;
    for (const t of things) { if (!waiting.has(t.tile)) waiting.set(t.tile, []); waiting.get(t.tile).push(t); }
  }
  const always = describeLandmarks(landmarks, wayfinding.planFingerposts(landmarks.far, START));
  const notable = Object.values(sitePlans).flatMap((p) => p.notable ?? []);

  const mapBlocks = createWalkRules(store, inRegion);
  const colliders = createColliders(mapBlocks, WALK.radius);
  const mover = createMover(WALK, START);
  const nearby = createNearby(NEARBY);
  const traffic = createTraffic(wayfinding.planCycleRoutes(), rng(5));
  const places = createPlaces(notable, landmarks.named, store.index);
  const state = { hero: mover.state, riders: traffic.riders, zoom: ZOOM_ORDER[0], view: { yaw: 0 }, place: null, street: null, time: 0 };
  const frameHooks = [];
  const zoomHooks = [];
  const tileHooks = [];
  const live = new Map(); // id -> thing: everything present now
  const pinned = new Set(); // tile keys a style asked to keep
  let thingsList = null;
  let style = null;
  let sincePlaces = Infinity;
  let sinceTiles = Infinity;
  let loading = null;

  function addThings(list) {
    for (const t of list) live.set(t.id, t);
    colliders.add(list);
    nearby.add(list);
    places.add(list);
    thingsList = null;
  }
  function removeThings(list) {
    for (const t of list) live.delete(t.id);
    colliders.remove(list);
    nearby.remove(list);
    places.remove(list);
    thingsList = null;
  }

  /**
   * Who gives way when a tile arrives. A site's plan doesn't know the streets, so its loose things (trees, graves,
   * benches) give way to the roads and buildings the tile has; and every solid thing gives way to the fingerposts and
   * other things that are always there.
   */
  const SITE_FIXED = new Set(['wall', 'chapel', 'shed']);
  function givesWay(t, tile) {
    if (t.solid && always.some((a) => a.solid && Math.hypot(a.x - t.x, a.z - t.z) < (a.solid + t.solid) * 0.85)) return true;
    if (t.tile === tile.key && !t.id.includes(`-${tile.key}-`) && !SITE_FIXED.has(t.kind)) {
      return onRoad(tile.index, t.x, t.z) || tile.index.buildingAt(t.x, t.z, 0) !== null;
    }
    return false;
  }

  /** New tiles: plan them, add their things (and the site things waiting for them), tell the style. */
  function attachTiles(tiles) {
    const added = [];
    for (const tile of tiles) {
      const { plan, things } = describeTile(tile, inRegion);
      tile.plan = plan;
      tile.things = [...things, ...(waiting.get(tile.key) ?? [])].filter((t) => !givesWay(t, tile));
      added.push(...tile.things);
    }
    addThings(added);
    if (added.length) style?.add?.(added);
    for (const fn of tileHooks) fn({ added: tiles, removed: [] });
  }
  function detachTiles(keys) {
    const gone = store.unload(keys);
    const removed = gone.flatMap((t) => t.things);
    removeThings(removed);
    if (removed.length) style?.remove?.(removed.map((t) => t.id));
    for (const fn of tileHooks) fn({ added: [], removed: gone });
  }

  /** Load what is wanted round (x, z) and drop what is far. Resolves when the loads are done. */
  function stream(x, z) {
    const far = [...store.tiles.keys()].filter((k) => !pinned.has(k) && !store.keysWithin(x, z, TILES.keep).includes(k));
    if (far.length) detachTiles(far);
    const wanted = store.keysWithin(x, z, TILES.load).filter((k) => !store.has(k));
    if (!wanted.length || loading) return loading ?? Promise.resolve();
    loading = store.load(wanted).then(attachTiles).finally(() => { loading = null; });
    return loading;
  }

  const game = {
    state, colliders,
    get things() { return (thingsList ??= [...live.values()]); },
    settings: { walk: WALK, nearby: NEARBY, zooms: ZOOMS, start: START, tiles: TILES },
    input: input ?? createKeyboard({ onZoom: () => game.toggleZoom() }),

    /** One step of the game (the style's loop calls it every frame, before drawing). */
    step(dt) {
      state.time += dt;
      mover.step(dt, game.input.read(), colliders.blocked);
      traffic.step(dt);
      sinceTiles += dt;
      if (sinceTiles >= TILES.checkEvery) { sinceTiles = 0; stream(state.hero.x, state.hero.z); }
      const changes = nearby.update(dt, state.hero.x, state.hero.z);
      if (changes && (changes.came.length || changes.went.length)) style?.near(changes);
      sincePlaces += dt;
      if (sincePlaces >= PLACES_EVERY) {
        sincePlaces = 0;
        state.place = places.placeAt(state.hero.x, state.hero.z);
        state.street = places.streetAt(state.hero.x, state.hero.z);
      }
      for (const fn of frameHooks) fn(state, dt);
    },

    /** Put the walker at (x, z) if he may stand there (tiles there must be loaded: see goTo). Returns true if he moved. */
    place(x, z) {
      if (colliders.blocked(x, z)) return false;
      mover.place(x, z);
      nearby.poke();
      sincePlaces = Infinity;
      sinceTiles = Infinity;
      return true;
    },

    /** Load the tiles round (x, z), then put the walker there. Resolves to true if he moved. */
    async goTo(x, z) {
      await stream(x, z);
      await stream(x, z); // a load already running when we asked covered the old spot
      return game.place(x, z);
    },

    /** Back to the start. */
    reset() {
      mover.place(START[0], START[1], 0);
      game.input.clear();
      nearby.poke();
      sincePlaces = Infinity;
      sinceTiles = Infinity;
    },

    /** Step to the next zoom (street → neighbourhood → map → street), or to the one given. */
    toggleZoom(to = ZOOM_ORDER[(ZOOM_ORDER.indexOf(state.zoom) + 1) % ZOOM_ORDER.length], opts = {}) {
      state.zoom = to;
      style?.zoom(to, opts);
      for (const fn of zoomHooks) fn(to);
    },

    onFrame(fn) { frameHooks.push(fn); },
    onZoom(fn) { zoomHooks.push(fn); },

    /** Wait for any tile loads in flight (tests, captures). */
    settle: () => loading ?? Promise.resolve(),

    /**
     * Hand the game to a style: load the tiles round the start (and any the style pins), then it builds the world and
     * runs the loop. A style pins tiles with `pins: { x0, z0, x1, z1 }` (units): they are loaded first and never dropped.
     */
    async attach(s) {
      style = s;
      for (const k of s.pins ? store.keysIn(s.pins) : []) pinned.add(k);
      const first = [...new Set([...pinned, ...store.keysWithin(START[0], START[1], TILES.load)])];
      attachTiles(await store.load(first));
      addThings(always);
      const { came } = nearby.check(state.hero.x, state.hero.z);
      style.build(new Set(came));
      style.start((dt) => game.step(dt));
      return style;
    },

    /**
     * The map, for drawing (styles, the minimap). Flat data in world units; read it, don't change it.
     *   region          the play area { x0, z0, x1, z1 }
     *   bounds          the whole imported area (the overview's extent)
     *   overview        { streets, areas, buildings: pts[] } for the whole area, simplified: far views and minimaps
     *   features(kind)  every loaded 'buildings' | 'streets' | 'areas' feature, each once (core/world/features.js)
     *   tiles()         the loaded tiles: { key, rect, plan, ... }
     *   onTiles(fn)     fn({ added, removed }) whenever tiles load or unload
     *   sites           [{ id, name, ground: { outline, paths, chapel, chapelCentre } }]
     *   sitePlans       site id -> its plan (positions of plots, trees...: for decorating the ground)
     *   landmarks       { churches, flags, far, named }
     *   blocks(x, z)    the map's own "can't stand here" (no things): for critters and the like
     */
    map: {
      region: REGION,
      bounds: overview.bounds,
      overview,
      features: (kind) => store.features(kind),
      tiles: () => [...store.tiles.values()],
      onTiles(fn) { tileHooks.push(fn); },
      sites: SITES,
      sitePlans,
      landmarks,
      blocks: mapBlocks,
      store,
    },
  };
  return game;
}
