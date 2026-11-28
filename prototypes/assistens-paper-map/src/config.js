/**
 * Game settings shared by every style: map scale, toy scale, walking, zoom levels, near/far radius, start and home.
 * Style-specific settings (colours, camera, lens) live in each style's own settings file.
 */

/** Which style draws the game unless ?style=<name> says otherwise (see src/styles/index.js). */
export const DEFAULT_STYLE = 'papercraft';

/** World units per metre: 1 unit = 5 m (the whole cemetery is ~120 x 120 units). */
export const SCALE = 0.2;

/*
 * Toy scale: how big things are drawn, so a child can read the map, find the way, and walk into the bakery.
 *   - the ground plan is TRUE: every street, block and path where it really is, at 1 unit = 5 m, so what you learn here
 *     works outside
 *   - what is BUILT is true height: 3 m storeys over a 5 m shop floor (a tall Nørrebro one), sheds, walls, trees as
 *     tall as real ones.
 *     Streets are drawn a little WIDER than life so they read as the way through
 *   - landmarks are a bit TALLER than life, so you can see them from far and steer by them
 *   - PEOPLE and what people use (benches, bike racks, signs, play kit, graves) are 2 × life: big enough to see from
 *     the street zoom, small enough that the walker (3.5 m) stands under the shop signs, between the doors
 *
 * TOY.person is that one factor. Each style sizes its pieces from these numbers (`heights`, in metres as DRAWN), so
 * every style keeps the same proportions; a style may tune its own art to hit them (papercraft: the scale table in
 * styles/papercraft/settings.js, measured with window.__style.heights()).
 */
const PERSON = 2;
export const TOY = {
  person: PERSON, // people and what they use: drawn size / life size
  storey: 0.6, // units per storey (3 m)
  groundFloor: 1.0, // units for the shop floor (5 m): the walker (3.5 m) stands under the shop sign
  streetWiden: 1.4, // drawn street width / mapped width
  landmark: 1.3, // landmark height / true height
  /** Drawn heights in metres: built things at true height, people-sized things at PERSON × life. */
  heights: {
    walker: 1.75 * PERSON, // 3.5 m
    cyclist: 1.9 * PERSON,
    bench: 0.9 * PERSON,
    bikeRack: 0.9 * PERSON,
    tap: 1.0 * PERSON,
    sign: 2.6 * PERSON, // a corner sign: the name plate just above the walker's head
    fingerpost: 2.8 * PERSON,
    grave: 1.1 * PERSON,
    notableGrave: 1.6 * PERSON, // a little taller, so you spot them
    playground: 2.4 * PERSON, // swings and climbing dome (the rest of the kit in proportion to them)
    goal: 2.0 * PERSON, // a football goal
    hoop: 3.2 * PERSON, // a basketball hoop
    table: 0.76 * PERSON, // a table-tennis table
    ramp: 1.5 * PERSON, // a skate ramp
    trafficLight: 2.4 * PERSON, // a pedestrian light: its green man at the walker's eye
    busStop: 2.4 * PERSON,
    crossingSign: 2.2 * PERSON,
    bin: 1.0 * PERSON,
    picnic: 0.8 * PERSON,
    flagpole: 10, // a school's flagpole: built, so true height
    fence: 1.2, // fences, hedges and walls round playgrounds and yards: built, true height
    yardHedge: 1.6,
    yardWall: 2,
    critter: 0.45 * PERSON * 1.6, // birds and squirrels a bit bigger again, or they vanish
    lamp: 5.5, // a street lamp: built, so true height
    tree: 18, // a grown linden (each tree varies round this)
    shed: 4,
    chapel: 14,
    wall: 3.5, // the cemetery wall (real ~3 m)
    hedge: 2,
  },
};

/**
 * Walking: 2.5 units/s (12.5 m/s), so a 300 m chunk takes about 25 s to cross; hold Shift to run 2.2x faster.
 * accel: how quickly he gets up to speed (units/s²); turn: how quickly he turns to face the way he walks (1/s);
 * radius: how close he comes to a tree or a bench (units).
 */
export const WALK = { speed: 2.5, runFactor: 2.2, accel: 40, turn: 13, radius: 0.18, heroHeight: TOY.heights.walker * SCALE };

/**
 * Three zooms (Z, the button or a click on the minimap steps through them, in this order): the street, close enough to
 * read the shop signs; the neighbourhood, a few blocks round you; and a map view. `across` is about how much of the
 * world (units) the screen shows across; each style turns that into its own camera. The game starts in the first.
 */
export const ZOOMS = {
  street: { across: 14, label: 'Gade · Street' }, // ~70 m: one side of a block, the shop signs readable
  neighbourhood: { across: 37, label: 'Kvarter · Blocks' }, // ~185 m
  map: { across: 95, label: 'Kort · Map' }, // ~475 m
};
export const ZOOM_ORDER = Object.keys(ZOOMS);

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
