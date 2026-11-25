/**
 * The papercraft style: the world as a pop-up paper diorama (three.js, via the vendored papercraft kit).
 * Implements the style interface (see ../README.md): build, start, near/far, zoom.
 *
 * The harness runs in "drive" mode: the game core moves the walker and decides what blocks him; the harness only
 * animates his stride and turn, frames him with its camera window and sight assist, and draws.
 */
import { createHarness } from 'papercraft/harness.js';
import { START, TOY, WALK } from '../../config.js';
import { REGION, SHEET } from '../../core/map/neighbourhood.js';
import { blocksWalker } from '../../core/map/walk.js';
import { PALETTE, LENS } from './settings.js';
import { printGround } from './world/ground.js';
import { createPopup, printOnce } from './world/popup.js';
import { createMakers } from './world/build.js';
import { createPresenter } from './world/presenter.js';
import { createCamera } from './world/camera.js';
import { startLife } from './world/life.js';
import { createWalker } from './pieces/walker.js';
import { cyclist } from './pieces/street.js';

const RIDER_LOOKS = 5;

/** @param game from core/game.js: { plan, things, state, place, reset, settings } */
export function createPapercraftStyle(game) {
  const H = createHarness({
    ground: PALETTE.ground,
    mood: 'golden', // ?mood=dusk or ?mood=night to try the others
    play: true, // the camera follows the walker from the first step
    drive: true, // ...but the game moves him
    lens: { highlightBoost: 0 }, // no bokeh highlights (they flicker on some GPUs)
    view: { pitch: LENS.walk.pitch, dist: LENS.walk.dist, target: [START[0], 1.5, START[1]], follow: [0, 0] },
    bounds: { ...SHEET }, // the printed ground: the walkable region and a ring of context round it
    walkArea: { ...REGION },
    heroHeight: WALK.heroHeight,
  });
  const popup = createPopup(H);
  const camera = createCamera(H);
  let presenter = null;
  let riders = [];

  return {
    name: 'papercraft',
    harness: H,

    build(nearIds) {
      H.walk.block(blocksWalker); // the harness's own walk field: only paper-life's critters use it, to roam
      printGround(H, game.plan);
      const creatures = [];
      const makers = createMakers(H, popup, game.things, { onCritter: (h, behaviour) => creatures.push([h, behaviour]) });

      // the walker: a small 3D paper model; the game moves him, the harness swings his limbs by his stride
      const doll = createWalker(H);
      const hero = popup(null, null, { node: doll, height: 3.1, x: START[0], z: START[1], sway: 0.2, scale: TOY.walker });
      H.setHero(hero, { stride: doll.userData.stride });

      presenter = createPresenter(H, makers);
      presenter.start(nearIds, game.settings.nearby.radius);

      // cyclists: a few printed riders shared by all, moved to where the game says each frame
      const looks = Array.from({ length: RIDER_LOOKS }, (_, k) => printOnce(H, cyclist(k + 3)));
      riders = game.state.riders.map((r) => {
        const { pts, mat } = looks[r.look % RIDER_LOOKS];
        return { r, hinge: popup(pts, null, { x: r.x, z: r.z, materials: mat, scale: TOY.cyclist }) };
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

    near(changes) { presenter?.update(changes); },
    zoom(mode, opts) { camera.set(mode, opts); },
    stats: () => presenter?.stats(),
  };
}
