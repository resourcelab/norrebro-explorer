/**
 * Assistens Kirkegård — a paper walk. Entry point.
 *
 *   config.js        scale, palette, camera, start
 *   data/            OpenStreetMap extracts and texts (no logic)
 *   map/             the map in world units: geometry, cemetery, neighbourhood, where the walker may go
 *   plan/            where every piece stands (positions only, seeded)
 *   pieces/          how each kind of paper piece looks (prints, cuts, folds)
 *   world/           puts it together: the printed ground, the standing pieces, ambient life, traffic
 *   ui/              on-screen overlays (place label, street sign, minimap and compass, zoom)
 *
 * Flow: harness → plan → print the ground → build the pieces → walking rules → life → overlays → start.
 */
import { createHarness } from 'papercraft/harness.js';
import { PALETTE, VIEW, WALK } from './config.js';
import { REGION, SHEET } from './map/neighbourhood.js';
import { NAMED_PLACES } from './map/landmarks.js';
import { blocksWalker } from './map/walk.js';
import { planWorld } from './plan/index.js';
import { printGround } from './world/ground.js';
import { buildWorld } from './world/build.js';
import { startLife } from './world/life.js';
import { startTraffic } from './world/traffic.js';
import { attachPlaceLabels } from './ui/place-labels.js';
import { attachStreetSign } from './ui/street-sign.js';
import { attachMinimap } from './ui/minimap.js';
import { attachZoom } from './ui/zoom.js';
import { isCaptureMode } from './ui/overlay.js';

const H = createHarness({
  ground: PALETTE.ground,
  mood: 'golden', // ?mood=dusk or ?mood=night to try the others
  play: true, // arrow keys / WASD walk without ?walk
  lens: { highlightBoost: 0 }, // no bokeh highlights (they flicker on some GPUs)
  view: VIEW,
  bounds: { ...SHEET }, // the printed ground: the walkable region and a ring of context round it
  walkArea: { ...REGION },
  heroHeight: WALK.heroHeight,
  walkSpeed: WALK.speed,
  runFactor: WALK.runFactor,
});

const plan = planWorld();
printGround(H, plan);
const { creatures, riders } = buildWorld(H, plan);
H.walk.block(blocksWalker);

if (!H.flags.TEST) {
  startLife(H, creatures);
  startTraffic(H, riders);
}
attachPlaceLabels(H, plan.notable, NAMED_PLACES);
attachStreetSign(H);
const zoom = attachZoom(H, { capture: isCaptureMode() });
attachMinimap(H, { onClick: () => zoom.toggle() });

H.start();
