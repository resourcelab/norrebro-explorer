/**
 * World settings: map scale, palette, camera and the walker's start.
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

/** World units per metre: 1 unit = 5 m (the whole cemetery is ~120 x 120 units). */
export const SCALE = 0.2;

/*
 * Toy scale: how big things are drawn, so a child can read the map and find the way.
 *   - the ground plan is TRUE: every street, block and path where it really is, at 1 unit = 5 m, so what you learn here
 *     works outside
 *   - buildings are TRUE height (3 m storeys), streets are drawn a little WIDER than life so they read as the way through
 *   - landmarks are a bit TALLER than life, so you can see them from far and steer by them
 *   - people, trees and street furniture are drawn larger than life (a real person would be a speck at this scale),
 *     but always smaller than the buildings round them
 */
export const TOY = {
  storey: 0.6, // units per storey (3 m)
  groundFloor: 0.85, // units for the shop floor (4.25 m)
  streetWiden: 1.4, // drawn street width / mapped width
  landmark: 1.3, // landmark height / true height
  walker: 0.85, // the walker's scale (about 2.6 units, ~13 m: two thirds of a five-storey block, easy to spot)
  tree: 0.62, // trees: ~4-5 units (20-24 m), the height of a big linden
  grave: 1.0, // grave plots
  notable: 1.0, // notable graves
  prop: 0.7, // benches, lamps, taps, bike racks
  critter: 0.7, // crows and squirrels
  playground: 0.85, // swings, slide, climbing dome, seesaw
  cyclist: 0.85,
  shed: 0.7, // sheds and service buildings in the cemetery
  chapel: 0.8,
  wallHeight: 1.0, // the cemetery wall (5 m: a little taller than its real ~3 m, so it reads)
  hedgeHeight: 0.5,
};

/** Walking: about a minute to cross a 300 m chunk (1.25 units/s ≈ 6 m/s); hold Shift to run. */
export const WALK = { speed: 1.25, runFactor: 2.2, heroHeight: 2.6 };

/**
 * Two zooms (Z or the button toggles): close for walking, and a map view that shows about 400 m across.
 * dist is the camera's distance from the walker; at 26° field of view a 16:9 frame shows ~0.8 × dist across.
 */
export const ZOOMS = {
  walk: { dist: 46, pitch: 55, pitchMin: 44, pitchMax: 64, haze: [34, 95], blur: { focusBand: 0.3, ramp: 0.3, maxBlur: 14 } },
  map: { dist: 118, pitch: 72, pitchMin: 62, pitchMax: 80, haze: [140, 260], blur: { focusBand: 0.7, ramp: 0.5, maxBlur: 5 } },
};

/**
 * Near stands up, far lies flat: pieces within `radius` units (60 = 300 m) of the walker stand; further ones lie flat.
 * Pieces not yet built are built a few per frame (at most buildPerStep, within budgetMs).
 */
export const STREAM = { radius: 60, hysteresis: 6, checkEvery: 0.3, buildPerStep: 4, budgetMs: 5 };

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

/** Where the walker starts (world units): the open path just west of the chapel. */
export const START = [12, 23.2];

/** Home on the minimap: for now where the walker starts. Later: the player's own address (or their Airbnb). */
export const HOME = { at: START, label: 'Start' };

/** Camera: the walking zoom, centred on the walker (follow [0, 0]). */
export const VIEW = { pitch: ZOOMS.walk.pitch, dist: ZOOMS.walk.dist, target: [START[0], 1.5, START[1]], follow: [0, 0] };
