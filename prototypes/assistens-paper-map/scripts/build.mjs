// Build: bundle src/ (with three.js and the vendored papercraft kit) into ONE self-contained HTML file that opens
// straight from disk, offline: dist/assistens-kirkegaard-paper-walk.html
//
//   npm install && npm run build
//
// Steps: esbuild bundles src/main.js (resolving "papercraft/..." to vendor/papercraft), then src/index.html is taken
// as the template: the dev import map is dropped, styles.css and the bundle are inlined.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'dist', 'assistens-kirkegaard-paper-walk.html');

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
  .replace('<script type="module" src="./main.js"></script>', () => `<script type="module">${js}</script>`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`built ${OUT.replace(root + '/', '')} (${(html.length / 1024).toFixed(0)} KB)`);
