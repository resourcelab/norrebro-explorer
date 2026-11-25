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

/** Camera: looking down 47 degrees, centred on the walker (follow [0, 0]). */
export const VIEW = { pitch: 47, dist: 62, target: [START[0], 1.5, START[1]], follow: [0, 0] };
