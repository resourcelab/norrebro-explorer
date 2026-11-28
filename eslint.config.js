// ESLint (flat config). Run from the repo root: npm run lint
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // generated, vendored or third-party code is not linted
    ignores: ['**/node_modules/**', '**/dist/**', '**/vendor/**', '**/src/data/**', 'docs/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'prefer-const': 'warn',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // build and data tools run in Node
    files: ['**/tools/**', '**/scripts/**', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
