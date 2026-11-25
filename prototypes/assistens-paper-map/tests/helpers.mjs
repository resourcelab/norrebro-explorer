// Shared test helpers: the packed world read from disk (npm test packs it first, see package.json "pretest").
import { readFileSync } from 'node:fs';
import { createGame } from '../src/core/game.js';
import { createScriptedInput } from '../src/core/input.js';

const WORLD = new URL('../world/', import.meta.url);
const read = async (path) => JSON.parse(readFileSync(new URL(path, WORLD), 'utf8'));

/** Like core/world/loaders.js fetchLoader, from files; counts tile reads. */
export function fileLoader() {
  const loader = {
    reads: 0,
    manifest: () => read('manifest.json'),
    overview: () => read('overview.json'),
    tile: (key) => { loader.reads++; return read(`tiles/${key}.json`); },
  };
  return loader;
}

/** A style that draws nothing and keeps a log of what it was told (for headless runs). */
export function nullStyle({ pins } = {}) {
  const log = { built: null, came: 0, went: 0, added: 0, removed: 0 };
  return {
    pins,
    log,
    build(nearIds) { log.built = nearIds.size; },
    start() {},
    near({ came, went }) { log.came += came.length; log.went += went.length; },
    add(things) { log.added += things.length; },
    remove(ids) { log.removed += ids.length; },
    zoom() {},
  };
}

/** A game with scripted input and a null style, attached and ready. */
export async function headlessGame({ pins } = {}) {
  const input = createScriptedInput();
  const loader = fileLoader();
  const game = await createGame({ loader, input });
  const style = nullStyle({ pins });
  await game.attach(style);
  return { game, input, style, loader };
}

/** Step the game for `seconds` at 60 fps, letting tile loads finish between steps. */
export async function run(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.step(1 / 60);
    if (i % 15 === 0) await game.settle();
  }
  await game.settle();
}
