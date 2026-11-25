/**
 * The world frame, and the only place that knows about longitude and latitude.
 *
 * Every coordinate in the game is in ONE frame: from the north-west corner of the imported area (WORLD_ORIGIN),
 * x east and z south. Map data (the world tiles, the Assistens plan) is stored in metres in this frame; the game works
 * in world units, metres × SCALE (1 unit = 5 m). Hand-written facts (where a flag stands, a far place) are given in
 * longitude and latitude, so they can be checked against any map, and turned into the frame here.
 *
 * The projection is the one tools/import-osm.mjs uses: equirectangular round the area's middle latitude (under 1 m off
 * across a few km). If the area is ever imported with a different bounding box, change WORLD here to match its
 * manifest; the tile store refuses tiles from another frame (see core/world/store.js).
 */
import { SCALE } from '../config.js';

/** The imported area: its bounding box [west, south, east, north] in degrees. The origin is its north-west corner. */
export const WORLD = { bboxLonLat: [12.541, 55.6835, 12.566, 55.6965] };
const [WEST, SOUTH, , NORTH] = WORLD.bboxLonLat;
export const WORLD_ORIGIN = { lon: WEST, lat: NORTH };

const KX = 111320 * Math.cos((((SOUTH + NORTH) / 2) * Math.PI) / 180); // metres per degree of longitude
const KZ = 110574; // metres per degree of latitude

/** Longitude, latitude -> [x, z] metres in the world frame. */
export const lonLatToMetres = (lon, lat) => [(lon - WEST) * KX, (NORTH - lat) * KZ];
/** [x, z] metres in the world frame -> [lon, lat]. */
export const metresToLonLat = ([x, z]) => [WEST + x / KX, NORTH - z / KZ];

/** Metres -> world units, for a point [x, z] or a single length. */
export const toUnits = ([x, z]) => [x * SCALE, z * SCALE];
export const unitsOf = (metres) => metres * SCALE;
export const metresOf = (units) => units / SCALE;
/** Longitude, latitude -> [x, z] world units. */
export const lonLatToUnits = (lon, lat) => toUnits(lonLatToMetres(lon, lat));
/** A rectangle { x0, z0, x1, z1 } in metres -> the same in units. */
export const rectToUnits = ({ x0, z0, x1, z1 }) => ({ x0: x0 * SCALE, z0: z0 * SCALE, x1: x1 * SCALE, z1: z1 * SCALE });
