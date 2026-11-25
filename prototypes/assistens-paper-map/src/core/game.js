/**
 * The game: everything that happens, with no graphics. It plans the world, describes it as things, moves the walker
 * (input, walking, collision), keeps the cyclists riding, decides what is near, and knows where you are. A style
 * (src/styles/) is handed the game, draws it, and runs the frame loop; the overlays (src/ui/) read game.state.
 *
 *   const game = createGame();
 *   game.attach(createSomeStyle(game));   // builds the style and starts the loop
 *
 * game.state, updated every step:
 *   hero    { x, z, heading, speed, maxSpeed }  heading: radians, 0 faces south (+z), π/2 faces east
 *   riders  [{ id, x, z, dx, dz }]             the cyclists
 *   zoom    'walk' | 'map'
 *   view    { yaw }                            the style's camera turn (degrees), for the compass
 *   place   { name, about, kind } | null        where you are (a notable grave, a landmark)
 *   street  string | null                      the street you are on
 *   time    seconds since the start
 */
import { WALK, NEARBY, START, ZOOMS } from '../config.js';
import { planWorld } from './plan/index.js';
import { describeWorld } from './world.js';
import { createColliders } from './colliders.js';
import { createMover } from './movement.js';
import { createNearby } from './nearby.js';
import { createTraffic } from './traffic.js';
import { createPlaces } from './places.js';
import { createKeyboard } from './input.js';

const PLACES_EVERY = 0.2; // seconds between "where am I?" lookups

/** @param input an input source with read() and clear(); default: the keyboard */
export function createGame({ input = null } = {}) {
  const plan = planWorld();
  const things = describeWorld(plan);
  const colliders = createColliders(things, WALK.radius);
  const mover = createMover(WALK, START);
  const nearby = createNearby(things, NEARBY);
  const traffic = createTraffic(plan.cycleRoutes, plan.rnd);
  const places = createPlaces(plan.notable);
  const state = { hero: mover.state, riders: traffic.riders, zoom: 'walk', view: { yaw: 0 }, place: null, street: null, time: 0 };
  const frameHooks = [];
  const zoomHooks = [];
  let style = null;
  let sincePlaces = Infinity;

  const game = {
    plan, things, state, colliders,
    settings: { walk: WALK, nearby: NEARBY, zooms: ZOOMS, start: START },
    input: input ?? createKeyboard({ onZoom: () => game.toggleZoom() }),

    /** One step of the game (the style's loop calls it every frame, before drawing). */
    step(dt) {
      state.time += dt;
      mover.step(dt, game.input.read(), colliders.blocked);
      traffic.step(dt);
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

    /** Put the walker at (x, z) if he may stand there. Returns true if he moved. */
    place(x, z) {
      if (colliders.blocked(x, z)) return false;
      mover.place(x, z);
      nearby.poke();
      sincePlaces = Infinity;
      return true;
    },

    /** Back to the start. */
    reset() {
      mover.place(START[0], START[1], 0);
      game.input.clear();
      nearby.poke();
      sincePlaces = Infinity;
    },

    /** Switch between the walking view and the map view (or to the one given). */
    toggleZoom(to = state.zoom === 'walk' ? 'map' : 'walk', opts = {}) {
      state.zoom = to;
      style?.zoom(to, opts);
      for (const fn of zoomHooks) fn(to);
    },

    onFrame(fn) { frameHooks.push(fn); },
    onZoom(fn) { zoomHooks.push(fn); },

    /** Hand the game to a style: it builds the world, then runs the loop. */
    attach(s) {
      style = s;
      const { came } = nearby.check(state.hero.x, state.hero.z);
      style.build(new Set(came));
      style.start((dt) => game.step(dt));
      return style;
    },
  };
  return game;
}
