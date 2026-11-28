/**
 * Addresses: "Blågårdsgade 12" -> a spot on the map, from the address points OpenStreetMap carries for Copenhagen
 * (world/addresses.json, made by tools/import-osm.mjs and scripts/pack-world.mjs). No geocoder, nothing leaves the
 * page: the list is read once, the first time someone types where they live.
 *
 *   const book = createAddressBook(loader, REGION);
 *   await book.suggest('blaagaardsg 1')  // [{ label: 'Blågårdsgade 1', street, number, x, z }, ...]  (units)
 *   await book.find('Blågårdsgade 12, 2200 København N')  // the best match, or null
 *
 * Forgiving the way children (and phones) type: any case, å/ø/æ or aa/oe/ae, "gade" or "g.", a postcode or a comma
 * after the number. Only addresses inside the play area are offered (region, in units).
 */
import { toUnits } from './geo.js';

const MAX = 8;
/** Lower case, æ/ø/å and their two-letter spellings made one, accents and dots dropped. */
export const fold = (s) => s.toLowerCase().replace(/å/g, 'aa').replace(/ø/g, 'oe').replace(/æ/g, 'ae').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();

/** "Blågårdsgade 12B, 2200 Kbh N" -> { street: 'blaagaardsgade', number: '12b' } (number may be ''). */
export function parse(text) {
  const head = fold(text.split(',')[0]);
  const m = head.match(/^(.*?)\s*(\d+\s*[a-z]?)?\s*(?:st|tv|th|mf|\d+\s*(?:sal|tv|th))?\s*$/);
  return { street: (m?.[1] ?? head).trim(), number: (m?.[2] ?? '').replace(/\s/g, '') };
}

export function createAddressBook(loader, region) {
  let streets = null;
  const inside = (x, z) => x > region.x0 && x < region.x1 && z > region.z0 && z < region.z1;
  async function open() {
    if (streets) return streets;
    const raw = (await loader.addresses?.()) ?? {};
    streets = Object.entries(raw).map(([name, list]) => ({
      name,
      key: fold(name),
      // only the homes the walker can reach; a street with none left is known, but beyond the map for now
      homes: list.map(([number, mx, mz]) => { const [x, z] = toUnits([mx, mz]); return { number, key: fold(number), x, z }; }).filter((h) => inside(h.x, h.z)),
    }));
    return streets;
  }

  const entry = (s, h) => ({ label: `${s.name} ${h.number}`, street: s.name, number: h.number, x: h.x, z: h.z });
  /** Streets matching what was typed: starts-with first, then contains. */
  function streetsFor(q) {
    if (!q) return [];
    const starts = streets.filter((s) => s.homes.length && s.key.startsWith(q));
    const has = streets.filter((s) => s.homes.length && !s.key.startsWith(q) && s.key.includes(q));
    return [...starts, ...has];
  }

  return {
    /** Up to 8 addresses for what has been typed so far (a street alone lists its first numbers). */
    async suggest(text) {
      await open();
      const { street, number } = parse(text);
      const found = streetsFor(street);
      const out = [];
      for (const s of found) {
        const homes = number ? s.homes.filter((h) => h.key.startsWith(number)) : s.homes;
        for (const h of homes) { out.push(entry(s, h)); if (out.length >= MAX) return out; }
        if (!number && found.length > 1) continue; // several streets: one line each is enough
      }
      return out;
    },

    /**
     * The address typed: the exact number on the best street, else the nearest number on it. { outside: true } when
     * the street is real but beyond the play area (the map does not reach it yet); null when nothing matches.
     */
    async find(text) {
      await open();
      const { street, number } = parse(text);
      if (!street) return null;
      const s = streetsFor(street)[0];
      if (!s) return streets.some((t) => t.key.startsWith(street)) ? { outside: true } : null;
      const exact = s.homes.find((h) => h.key === number);
      if (exact || !number) return entry(s, exact ?? s.homes[0]);
      const n = parseInt(number, 10);
      const near = [...s.homes].sort((a, b) => Math.abs(parseInt(a.number, 10) - n) - Math.abs(parseInt(b.number, 10) - n))[0];
      return entry(s, near);
    },

    /** How many addresses are on the map (for the card: "the map knows 2,900 addresses"). */
    async size() { await open(); return streets.reduce((n, s) => n + s.homes.length, 0); },
  };
}
