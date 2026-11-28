// Build: the game as a small static site, plus one file that works offline.
//   dist/index.html    the page, with the code (three.js and the vendored papercraft kit included) and styles inlined
//   dist/world/        the packed world tiles it loads as you walk (from npm run pack-world)
//   dist/assistens-kirkegaard-paper-walk.html   the same page with every tile baked in: one file, double-click to play
//                      offline (bigger, as it carries the whole area; the hosted game only fetches what is near)
//
//   npm install && npm run build      (prebuild packs the world first)
//
// Steps: esbuild bundles src/main.js (resolving "papercraft/..." to vendor/papercraft), then src/index.html is taken
// as the template: the dev import map is dropped, styles.css and the bundle are inlined, and the world is copied beside
// it. Serve dist/ from any static host (GitHub Pages does); index.html fetches its tiles, so it needs a server, while
// the offline file needs nothing.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(root, 'dist');
const OUT = join(DIST, 'index.html');
const OFFLINE = 'assistens-kirkegaard-paper-walk.html';
const WORLD = join(root, 'world');
if (!existsSync(join(WORLD, 'manifest.json'))) throw new Error('build: no packed world; run npm run pack-world first');

const papercraftAlias = {
  name: 'papercraft-alias',
  setup(build) {
    build.onResolve({ filter: /^papercraft\// }, (args) => ({ path: join(root, 'vendor', 'papercraft', args.path.slice('papercraft/'.length)) }));
  },
};

const result = await esbuild.build({
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  write: false,
  plugins: [papercraftAlias],
  logLevel: 'warning',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'src', 'styles.css'), 'utf8');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8')
  .replace(/\s*<!-- dev:[\s\S]*?<\/script>/, '') // drop the dev import map
  .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="./main.js"></script>', () => `<script type="module">${js}</script>`)
  .replace('<meta name="world" content="../world/">', '<meta name="world" content="./world/">');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
writeFileSync(OUT, html);
cpSync(WORLD, join(DIST, 'world'), { recursive: true });

// the offline file: the world as one object the page reads before the game starts (core/world/loaders.js inlineLoader)
const readJson = (path) => JSON.parse(readFileSync(join(WORLD, path), 'utf8'));
const manifest = readJson('manifest.json');
const world = { manifest, overview: readJson('overview.json'), addresses: readJson('addresses.json'), tiles: Object.fromEntries(manifest.tiles.map((k) => [k, readJson(`tiles/${k}.json`)])) };
const offline = html.replace('<script type="module">', () => `<script>window.__WORLD__ = ${JSON.stringify(world).replace(/<\//g, '<\\/')};</script>\n<script type="module">`);
writeFileSync(join(DIST, OFFLINE), offline);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`built dist/index.html (${kb(html.length)}) with dist/world/, and dist/${OFFLINE} (${kb(offline.length)}, offline)`);
