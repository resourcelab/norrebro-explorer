/**
 * Every kind of thing, and the CATEGORY it belongs to. A style draws the kinds it knows in its own way, and anything
 * else by its category (a tree-ish thing as a tree, a prop as a small marker...), so a new kind (or a new site with
 * kinds of its own) never breaks a style: it only looks plainer there until the style learns it.
 *
 * Each thing carries its category (core/world.js), so a style never needs this table to draw.
 *
 * Categories:
 *   building   stands on a footprint (pts)            landmark  always there, to steer by
 *   barrier    a wall or post you walk round          tree      a tree
 *   monument   a grave, a statue                      prop      street furniture and play kit
 *   animal     birds, squirrels                       sign      words on a post: names, directions
 *   place      a shop, café or other named place on a ground floor (name, category of place)
 */
export const CATEGORIES = ['building', 'landmark', 'barrier', 'tree', 'monument', 'prop', 'animal', 'sign', 'place'];

export const KIND_CATEGORY = {
  chapel: 'building', shed: 'building', block: 'building',
  church: 'landmark', flag: 'landmark',
  wall: 'barrier', 'gate-post': 'barrier',
  tree: 'tree',
  grave: 'monument', 'notable-grave': 'monument',
  bench: 'prop', lamp: 'prop', tap: 'prop', 'bike-rack': 'prop', playground: 'prop',
  critter: 'animal',
  'corner-sign': 'sign', fingerpost: 'sign',
  shopfront: 'place',
};

/** Every kind; a style should know how to draw each, and draws any other by its category. */
export const KINDS = Object.keys(KIND_CATEGORY);
