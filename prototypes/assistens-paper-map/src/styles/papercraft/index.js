/**
 * The papercraft style: the world as a pop-up paper diorama (three.js, via the vendored papercraft kit).
 * Implements the style interface (see ../README.md): build, start, near/far, zoom.
 *
 * The harness runs in "drive" mode: the game core moves the walker and decides what blocks him; the harness only
 * animates his stride and turn, frames him with its camera window and sight assist, and draws.
 */
import { createHarness } from 'papercraft/harness.js';
import { START, WALK } from '../../config.js';
import { PALETTE, LENS, scaleOf } from './settings.js';
import { printGround } from './world/ground.js';
import { createPopup, printOnce } from './world/popup.js';
import { createMakers } from './world/build.js';
import { createPresenter } from './world/presenter.js';
import { createCamera } from './world/camera.js';
import { startLife } from './world/life.js';
import { createWalker } from './pieces/walker.js';
import { cyclist } from './pieces/street.js';

const RIDER_LOOKS = 5;
/** The printed ground sheet: the play area plus this margin (units) of the overview, so the map view never shows bare paper. */
const SHEET_MARGIN = 46;

/** @param game from core/game.js: { things, state, map, place, reset, settings } */
export function createPapercraftStyle(game) {
  const REGION = game.map.region;
  const B = game.map.bounds;
  const SHEET = {
    x0: Math.max(B.x0, REGION.x0 - SHEET_MARGIN), z0: Math.max(B.z0, REGION.z0 - SHEET_MARGIN),
    x1: Math.min(B.x1, REGION.x1 + SHEET_MARGIN), z1: Math.min(B.z1, REGION.z1 + SHEET_MARGIN),
  };
  const H = createHarness({
    ground: PALETTE.ground,
    mood: 'golden', // ?mood=dusk or ?mood=night to try the others
    play: true, // the camera follows the walker from the first step
    drive: true, // ...but the game moves him
    lens: { highlightBoost: 0 }, // no bokeh highlights (they flicker on some GPUs)
    view: { pitch: LENS[game.state.zoom].pitch, dist: LENS[game.state.zoom].dist, target: [START[0], 0.6, START[1]], follow: [0, 0] },
    bounds: { ...SHEET }, // the printed ground: the walkable region and a ring of context round it
    walkArea: { ...REGION },
    heroHeight: WALK.heroHeight,
  });
  const popup = createPopup(H);
  const camera = createCamera(H, game.state.zoom);
  let presenter = null;
  let makeFor = null;
  let riders = [];

  return {
    name: 'papercraft',
    harness: H,
    pins: REGION, // the ground sheet is printed once, so every tile of the play area must be loaded first

    build(nearIds) {
      H.walk.block(game.map.blocks); // the harness's own walk field: only paper-life's critters use it, to roam
      printGround(H, game.map);
      const creatures = [];
      makeFor = createMakers(H, popup, { onCritter: (h, behaviour) => creatures.push([h, behaviour]) });
      const makers = makeFor(game.things);

      // the walker: a small 3D paper model; the game moves him, the harness swings his limbs by his stride
      const doll = createWalker(H);
      const hero = popup(null, null, { node: doll, height: 3.1, x: START[0], z: START[1], sway: 0.2, scale: scaleOf('walker') });
      H.setHero(hero, { stride: doll.userData.stride });

      presenter = createPresenter(H, makers);
      presenter.start(nearIds, game.settings.nearby.radius);

      // cyclists: a few printed riders shared by all, moved to where the game says each frame
      const looks = Array.from({ length: RIDER_LOOKS }, (_, k) => printOnce(H, cyclist(k + 3)));
      riders = game.state.riders.map((r) => {
        const { pts, mat } = looks[r.look % RIDER_LOOKS];
        return { r, hinge: popup(pts, null, { x: r.x, z: r.z, materials: mat, scale: scaleOf('cyclist') }) };
      });

      if (!H.flags.TEST) startLife(H, creatures);
      H.placeHook = (x, z) => game.place(x, z); // __papercraft.place (reviews, captures) moves the game's walker
      H.onRestart(() => game.reset());
    },

    start(step) {
      H.beforeStep((t, dt) => {
        step(dt);
        const h = game.state.hero;
        H.drive({ x: h.x, z: h.z, heading: h.heading, maxSpeed: h.maxSpeed });
      });
      H.onStep(() => {
        for (const { r, hinge } of riders) {
          const g = hinge.group;
          g.position.x = r.x;
          g.position.z = r.z;
          g.scale.x = Math.abs(g.scale.x) * (r.dx >= 0 ? 1 : -1); // printed facing right: flip when riding left
        }
        game.state.view.yaw = H.view.yaw; // the compass turns with the camera
      });
      H.start();
    },

    credit: 'papercraft style by xikhar (MIT)',
    hint: 'arrows / WASD walk · Shift run · Z zoom · walk up to a shop, a grave or a church · drag to look around',
    // the generic capture hooks (tools/capture.py); the harness's own window.__papercraft has more (moods, walks)
    capture: {
      ready: () => Boolean(window.__papercraft?.ready),
      step: (sec) => window.__papercraft.step(sec),
      restart: () => window.__papercraft.restart(),
    },
    near(changes) { presenter?.update(changes); },
    add(things) { if (presenter) presenter.add(makeFor(things)); },
    remove(ids) { presenter?.remove(ids); },
    zoom(mode, opts) { camera.set(mode, opts); },
    stats: () => presenter?.stats(),
    heights: () => presenter?.heights(),
  };
}
