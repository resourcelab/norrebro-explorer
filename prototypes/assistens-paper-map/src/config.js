/**
 * Game settings shared by every style: map scale, toy scale, walking, zoom levels, near/far radius, start and home.
 * Style-specific settings (colours, camera, lens) live in each style's own settings file.
 */

/** Which style draws the game unless ?style=<name> says otherwise (see src/styles/index.js). */
export const DEFAULT_STYLE = 'papercraft';

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

/**
 * Walking: 2.5 units/s (12.5 m/s), so a 300 m chunk takes about 25 s to cross; hold Shift to run 2.2x faster.
 * accel: how quickly he gets up to speed (units/s²); turn: how quickly he turns to face the way he walks (1/s);
 * radius: how close he comes to a tree or a bench (units).
 */
export const WALK = { speed: 2.5, runFactor: 2.2, accel: 40, turn: 13, radius: 0.25, heroHeight: 2.6 };

/**
 * Two zooms (Z, the button or a click on the minimap switches): close for walking, and a map view. `across` is about
 * how much of the world (units) the screen shows across; each style turns that into its own camera.
 */
export const ZOOMS = {
  walk: { across: 37 }, // ~185 m
  map: { across: 95 }, // ~475 m
};

/**
 * Near and far: things within `radius` units (60 = 300 m) of the walker are near, further ones far (a thing that is
 * near stays near until it is radius + hysteresis away). Each style decides what near and far look like.
 */
export const NEARBY = { radius: 60, hysteresis: 6, checkEvery: 0.3 };

/*
 * Places are in the world frame (src/core/geo.js): metres from the imported area's north-west corner, x east, z south.
 * The game works in units (metres × SCALE); the unit versions below are what the code uses.
 */

/**
 * The play area (metres): where the walker may go, and the tiles a style may print up front. Today: Assistens
 * Kirkegård and the streets, blocks and parks round it, about 820 × 830 m. Growing the map starts here.
 */
export const PLAY_AREA = { x0: 138, z0: 213, x1: 958, z1: 1043 };
export const REGION = { x0: PLAY_AREA.x0 * SCALE, z0: PLAY_AREA.z0 * SCALE, x1: PLAY_AREA.x1 * SCALE, z1: PLAY_AREA.z1 * SCALE };

/** Where the walker starts (metres, then units): the open path just west of the chapel. */
export const START_AT = [657.9, 748.8];
export const START = [START_AT[0] * SCALE, START_AT[1] * SCALE];

/**
 * Tiles load round the walker as he walks (core/world/store.js): every tile within `load` units of him is loaded, and
 * a tile is dropped once it is more than `keep` units away (unless a style has pinned it). `load` must reach beyond
 * NEARBY.radius, so anything near is always on a loaded tile.
 */
export const TILES = { load: 80, keep: 104, checkEvery: 0.5 };

/** Home on the minimap: for now where the walker starts. Later: the player's own address (or their Airbnb). */
export const HOME = { at: START, label: 'Start' };
