/**
 * Papercraft style settings: palette, camera and lens per zoom, how many pieces to build per frame.
 *
 * Paper spec (the papercraft skill's planning sheet):
 *   BRIEF    Assistens Kirkegård, Copenhagen, a still November afternoon, low golden sun. A cemetery that is also the
 *            neighbourhood's park: tree avenues, gravel paths, the yellow wall, the chapel, old and new graves.
 *   PALETTE  lawn straw ground, gravel paths, ochre-gold leaves (linden, chestnut, beech), Danish red and cream
 *            accents, grey and sandstone gravestones, an ochre wall.
 *   LIGHT    the harness's "golden" mood: warm low key from the left, warm brown shadow tint.
 *   LIFE     falling leaves, crows that peck and scatter, squirrels that bound away, cloud shadows.
 *   TYPES    crosses (trees), single cards (grave plots, benches, lamps, critters), prism folds (walls, hedges, gate
 *            posts, sheds), a box fold (the chapel).
 */
import { ZOOMS } from '../../config.js';

export const PALETTE = {
  ground: '#cfc8b2',
  street: '#aaa596',
  lawn: '#c3bd97',
  wash: '#b0b089',
  washB: '#c4ba92',
  path: '#efe4c8',
  asphalt: '#ddd7c8',
  linden: '#dcae3c',
  chestnut: '#c9772f',
  beech: '#b5612f',
  maple: '#e0a03a',
  poplar: '#cdb44e',
  yew: '#4f6a4a',
  trunk: '#4e3b2e',
  red: '#b4432f',
  cream: '#f3ead6',
  ink: '#2e241c',
  wall: '#dcb253',
  coping: '#9a5a35',
  hedge: '#5d7348',
  bench: '#3f5a44',
  stones: ['#a3a19a', '#cdb48a', '#6a6763', '#e3dccb', '#a77462', '#8e9188'],
  moss: '#71804c',
  soil: '#9b8a6c',
};

/**
 * The camera and lens for each zoom. dist is the camera's distance from the walker: at 26° field of view a 16:9 frame
 * shows ~0.8 × dist across, so dist follows the game's ZOOMS[..].across. Haze and blur ease off in the map view so the
 * whole map reads.
 */
export const LENS = {
  walk: { dist: ZOOMS.walk.across / 0.8, pitch: 55, pitchMin: 44, pitchMax: 64, haze: [34, 95], blur: { focusBand: 0.3, ramp: 0.3, maxBlur: 14 } },
  map: { dist: ZOOMS.map.across / 0.8, pitch: 72, pitchMin: 62, pitchMax: 80, haze: [140, 260], blur: { focusBand: 0.7, ramp: 0.5, maxBlur: 5 } },
};

/** Pieces not built yet are built a few per frame: at most buildPerStep, within budgetMs. */
export const BUILD = { buildPerStep: 4, budgetMs: 5, startShare: 0.5 };
