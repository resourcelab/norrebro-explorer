/**
 * Ambient life from the papercraft kit (paper-life.js): falling leaves in the trees' colours, a flock of crows
 * crossing now and then, cloud shadows, and the crows and squirrels on the ground reacting to the walker.
 */
import { createLife } from 'papercraft/lib/paper-life.js';
import { PALETTE as C } from '../settings.js';

/** @param creatures [[hinge, 'peck' | 'shy']] from world/build-cemetery.js */
export function startLife(H, creatures) {
  const life = createLife({ scene: H.scene, camera: H.camera, heroHeight: H.heroHeight, seed: 41, wind: [0.9, 0.4] });
  life.fallers({ count: 70, cut: 'leaf', colors: [C.linden, C.chestnut, C.beech, '#e2bd5a'], size: [0.2, 0.3], land: 9 });
  life.flock({ size: 6, height: 3.6, colors: ['#2f2d2e', '#3a3738'] });
  life.cloudShadows({ count: 4 });
  for (const [hinge, behaviour] of creatures) {
    life.critter(hinge.group, { behaviour, hero: H.hero.group.position, walk: H.walk, roam: 1.4 });
  }
  life.setNight({ night: 1, dusk: 0.5 }[H.flags.MOOD] ?? 0); // ?mood=dusk / ?mood=night
  life.reset(H.target);
  H.onStep((t, dt) => life.update(dt, H.target));
  H.onRestart(() => life.reset(H.target));
  return life;
}
