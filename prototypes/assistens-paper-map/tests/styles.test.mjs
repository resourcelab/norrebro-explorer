// Style contract tests (no browser): every style says which kinds it draws in its own way, and they cover every kind
// in the core. A style that doesn't know a kind still draws it by its category, but should learn it.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { KINDS, KIND_CATEGORY, CATEGORIES } from '../src/core/kinds.js';

const styles = readdirSync(new URL('../src/styles/', import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

test('every kind has a category', () => {
  for (const k of KINDS) assert.ok(CATEGORIES.includes(KIND_CATEGORY[k]), k);
});

for (const name of styles) {
  test(`the ${name} style draws every kind, and has a fallback by category`, async () => {
    const { DRAWS } = await import(`../src/styles/${name}/kinds.js`);
    assert.deepEqual(KINDS.filter((k) => !DRAWS.has(k)), [], 'kinds it has no own drawing for');
    assert.deepEqual([...DRAWS].filter((k) => !KINDS.includes(k)), [], 'kinds that no longer exist');
    const src = readdirSync(new URL(`../src/styles/${name}/`, import.meta.url), { recursive: true })
      .filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(`../src/styles/${name}/${f}`, import.meta.url), 'utf8')).join('\n');
    assert.match(src, /t\.category/, 'it falls back on the category for kinds it does not know');
  });
}

test('the styles index lists every style folder', () => {
  // read, not imported: the index pulls in browser-only modules
  const index = readFileSync(new URL('../src/styles/index.js', import.meta.url), 'utf8');
  for (const name of styles) assert.match(index, new RegExp(`from './${name}/index.js'`), name);
});
