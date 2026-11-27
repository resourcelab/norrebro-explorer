// The kinds the papercraft style has its own paper piece for (world/build.js). Anything else is drawn by its category.
// tests/styles.test.mjs checks this list against core/kinds.js.
export const DRAWS = new Set([
  'chapel', 'shed', 'wall', 'gate-post', 'tree', 'grave', 'notable-grave', 'bench', 'lamp', 'tap', 'critter', 'block',
  'playground', 'bike-rack', 'church', 'flag', 'corner-sign', 'fingerpost', 'shopfront',
]);
