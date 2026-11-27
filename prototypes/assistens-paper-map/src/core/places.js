/**
 * Where am I? The place the walker is at (a notable grave or a landmark, whichever is most central in its range) and
 * the street he is on (or right beside). The overlays show these; a future journal can record them.
 */
import { NOTABLE_GRAVES } from '../data/notable-graves.js';

const GRAVE_RANGE = 4.2; // units (~20 m)
const SHOP_RANGE = 2.2; // units (~11 m): in front of its window
const LANDMARK_RANGE = 11; // units (~55 m)
const STREET_BESIDE = 1.2; // units beyond the street edge that still count as "on" it (the pavement)
const KIND_TEXT = { church: 'Kirke · church', flag: 'Park / plads · park or square' };

/**
 * @param notable [{ x, z, name }] the notable graves
 * @param named [{ name, x, z, kind }] the landmarks
 * @param index the spatial index over loaded streets (core/world/index.js)
 */
export function createPlaces(notable, named, index) {
  const places = [
    ...notable.map((n) => ({ ...n, kind: 'grave', range: GRAVE_RANGE, about: NOTABLE_GRAVES[n.name] ?? '' })),
    ...named.map((l) => ({ ...l, range: LANDMARK_RANGE, about: KIND_TEXT[l.kind] ?? '' })),
  ];
  const shops = new Map(); // id -> place: the shopfronts on loaded tiles

  return {
    /** Things arrived or left with their tiles: the shopfronts among them become places, or stop being ones. */
    add(things) { for (const t of things) if (t.kind === 'shopfront') shops.set(t.id, { name: t.name, x: t.x, z: t.z, kind: 'shop', range: SHOP_RANGE, about: t.label }); },
    remove(things) { for (const t of things) shops.delete(t.id); },
    /** { name, about, kind, x, z } or null */
    placeAt(x, z) {
      let best = null;
      let bestScore = 1;
      for (const p of [...places, ...shops.values()]) {
        const score = Math.hypot(p.x - x, p.z - z) / p.range; // under 1: in range; the most central wins
        if (score < bestScore) { bestScore = score; best = p; }
      }
      return best;
    },
    /** the street's name, or null */
    streetAt: (x, z) => index.nearestStreet(x, z, STREET_BESIDE, true)?.street.name ?? null,
  };
}
