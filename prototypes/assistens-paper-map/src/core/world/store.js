/**
 * The world store: loads the packed world (scripts/pack-world.mjs) tile by tile, and knows what is loaded.
 *
 *   const store = await openWorld(loader, ctx);       // reads the manifest and the overview
 *   await store.load(['6_7', '6_8']);                  // -> the tiles that were not loaded before
 *   store.unload(['6_7']);
 *   store.index                                        // a spatial index over every loaded feature (core/world/index.js)
 *   store.features('buildings')                        // every loaded building, each once
 *
 * A loader is three async functions that return parsed JSON: { manifest(), overview(), tile(key) }. The browser's
 * fetches from a URL (main.js), the tests' read files (tests/helpers.mjs); the store doesn't care.
 *
 * Features crossing tile edges arrive in every tile they touch (with a margin, see the packer); the store keeps one
 * copy of each, counted, and takes it out of the index when the last tile holding it is unloaded. Each tile also keeps
 * its OWN index, of only its own features, so planning a tile never depends on which other tiles happen to be loaded.
 */
import { SCALE } from '../../config.js';
import { WORLD } from '../geo.js';
import { createSpatialIndex } from './index.js';
import { prepareTile, prepareOverview } from './features.js';

export const PACKED_FORMAT = 'norrebro-explorer/packed@1';

/** Tile keys are "i_j": column i (east), row j (south). */
export const tileKey = (i, j) => `${i}_${j}`;
export const parseKey = (key) => key.split('_').map(Number);

/**
 * @param loader { manifest, overview, tile }
 * @param ctx { landmarkIds: Set, insideSite(pts) } (see core/world/features.js)
 */
export async function openWorld(loader, ctx) {
  const manifest = await loader.manifest();
  if (manifest.format !== PACKED_FORMAT) throw new Error(`world: expected ${PACKED_FORMAT}, got ${manifest.format} (run npm run pack-world)`);
  if (manifest.bboxLonLat.some((v, i) => Math.abs(v - WORLD.bboxLonLat[i]) > 1e-9)) {
    throw new Error(`world: the tiles were imported for bbox ${manifest.bboxLonLat}, but core/geo.js expects ${WORLD.bboxLonLat}`);
  }
  const overview = prepareOverview(await loader.overview());
  const size = manifest.tileSize * SCALE; // units
  const available = new Set(manifest.tiles);
  const tiles = new Map(); // key -> tile
  const pending = new Map(); // key -> promise
  const shared = new Map(); // feature id -> { f, count }
  const index = createSpatialIndex();

  const rectOf = (key) => {
    const [i, j] = parseKey(key);
    return { x0: i * size, z0: j * size, x1: (i + 1) * size, z1: (j + 1) * size };
  };
  const keyAt = (x, z) => tileKey(Math.floor(x / size), Math.floor(z / size));

  /** Tile keys (that exist) whose square meets the rectangle. */
  function keysIn({ x0, z0, x1, z1 }) {
    const keys = [];
    for (let i = Math.floor(x0 / size); i <= Math.floor(x1 / size); i++) {
      for (let j = Math.floor(z0 / size); j <= Math.floor(z1 / size); j++) if (available.has(tileKey(i, j))) keys.push(tileKey(i, j));
    }
    return keys;
  }
  /** Tile keys whose square comes within r of (x, z). */
  function keysWithin(x, z, r) {
    return keysIn({ x0: x - r, z0: z - r, x1: x + r, z1: z + r }).filter((k) => {
      const t = rectOf(k);
      const dx = Math.max(t.x0 - x, 0, x - t.x1);
      const dz = Math.max(t.z0 - z, 0, z - t.z1);
      return Math.hypot(dx, dz) <= r;
    });
  }

  function share(f) {
    const s = shared.get(f.id);
    if (s) { s.count++; return s.f; }
    shared.set(f.id, { f, count: 1 });
    index.add(f);
    return f;
  }
  function unshare(f) {
    const s = shared.get(f.id);
    if (!s || --s.count > 0) return;
    shared.delete(f.id);
    index.remove(s.f);
  }

  async function loadOne(key) {
    const raw = await loader.tile(key);
    const rect = rectOf(key);
    const m = manifest.margin * SCALE - 0.5; // what the tile knows about: its square and (most of) the packing margin
    const reach = { x0: rect.x0 - m, z0: rect.z0 - m, x1: rect.x1 + m, z1: rect.z1 + m };
    const tile = { key, i: raw.i, j: raw.j, rect, reach, ...prepareTile(raw, ctx), index: createSpatialIndex(), things: [] };
    // the store-wide copies, so every loaded tile points at the same object for the same feature
    for (const kind of ['buildings', 'streets', 'areas']) {
      tile[kind] = tile[kind].map(share);
      for (const f of tile[kind]) tile.index.add(f);
    }
    tiles.set(key, tile);
    return tile;
  }

  return {
    manifest, overview, size, rectOf, keyAt, keysIn, keysWithin, index,
    tiles,
    has: (key) => tiles.has(key),
    available: (key) => available.has(key),

    /** Load the tiles not yet loaded (missing keys are skipped). Resolves to the newly loaded tiles, in key order. */
    async load(keys) {
      const fresh = [];
      await Promise.all(keys.filter((k) => available.has(k) && !tiles.has(k)).map((k) => {
        if (!pending.has(k)) pending.set(k, loadOne(k).then((t) => { fresh.push(t); return t; }).finally(() => pending.delete(k)));
        return pending.get(k);
      }));
      return fresh.sort((a, b) => (a.key < b.key ? -1 : 1));
    },

    /** Drop tiles. Returns the dropped tiles. */
    unload(keys) {
      const gone = [];
      for (const k of keys) {
        const t = tiles.get(k);
        if (!t) continue;
        for (const kind of ['buildings', 'streets', 'areas']) for (const f of t[kind]) unshare(f);
        tiles.delete(k);
        gone.push(t);
      }
      return gone;
    },

    /** Every loaded feature of a kind ('buildings' | 'streets' | 'areas'), each once. */
    features(kind) {
      const type = kind.slice(0, -1);
      return [...shared.values()].map((s) => s.f).filter((f) => f.type === type);
    },
  };
}
