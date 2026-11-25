/**
 * Assistens Kirkegård — a paper walk. Entry point.
 *
 *   config.js        scale, palette, camera, start
 *   data/            OpenStreetMap extracts and texts (no logic)
 *   map/             the map in world units: geometry, cemetery, neighbourhood, where the walker may go
 *   plan/            where every piece stands (positions only, seeded)
 *   pieces/          how each kind of paper piece looks (prints, cuts, folds)
 *   world/           puts it together: the printed ground, the standing pieces, ambient life, traffic
 *   ui/              on-screen overlays (grave label, street sign)
 *
 * Flow: harness → plan → print the ground → build the pieces → walking rules → life → overlays → start.
 */
import { createHarness } from 'papercraft/harness.js';
import { PALETTE, VIEW } from './config.js';
import { REGION } from './map/neighbourhood.js';
import { blocksWalker } from './map/walk.js';
import { planWorld } from './plan/index.js';
import { printGround } from './world/ground.js';
import { buildWorld } from './world/build.js';
import { startLife } from './world/life.js';
import { startTraffic } from './world/traffic.js';
import { attachGraveLabels } from './ui/grave-labels.js';
import { attachStreetSign } from './ui/street-sign.js';

/** Extra ground printed beyond the walkable region, so the edge of the sheet stays out of view. */
const SHEET_MARGIN = 8;

const H = createHarness({
  ground: PALETTE.ground,
  mood: 'golden', // ?mood=dusk or ?mood=night to try the others
  play: true, // arrow keys / WASD walk without ?walk
  lens: { highlightBoost: 0 }, // no bokeh highlights (they flicker on some GPUs)
  view: VIEW,
  bounds: { x0: REGION.x0 - SHEET_MARGIN, x1: REGION.x1 + SHEET_MARGIN, z0: REGION.z0 - SHEET_MARGIN, z1: REGION.z1 + SHEET_MARGIN },
  walkArea: { ...REGION },
});

const plan = planWorld();
printGround(H, plan);
const { creatures, riders } = buildWorld(H, plan);
H.walk.block(blocksWalker);

if (!H.flags.TEST) {
  startLife(H, creatures);
  startTraffic(H, riders);
}
attachGraveLabels(H, plan.notable);
attachStreetSign(H);

H.start();
