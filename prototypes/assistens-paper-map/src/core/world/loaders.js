/**
 * Where the packed world comes from. The store (core/world/store.js) takes any object with three async functions that
 * return parsed JSON: { manifest(), overview(), tile(key) }, and optionally addresses() (read only when a player types
 * where they live: core/address.js).
 *
 * fetchLoader reads it over HTTP from a base URL (the hosted game: main.js). inlineLoader reads it from an object
 * baked into the page (the offline single-file build, scripts/build.mjs). Node's tests read files instead
 * (tests/helpers.mjs), with the same three functions.
 */
export function fetchLoader(base, fetchFn = globalThis.fetch) {
  const get = async (path) => {
    const res = await fetchFn(new URL(path, base));
    if (!res.ok) throw new Error(`world: ${path}: HTTP ${res.status}`);
    return res.json();
  };
  return {
    manifest: () => get('manifest.json'),
    overview: () => get('overview.json'),
    tile: (key) => get(`tiles/${key}.json`),
    addresses: () => get('addresses.json'),
  };
}

/** @param world { manifest, overview, tiles: { key: tile } } */
export function inlineLoader(world) {
  return {
    manifest: async () => world.manifest,
    overview: async () => world.overview,
    tile: async (key) => world.tiles[key],
    addresses: async () => world.addresses ?? {},
  };
}
