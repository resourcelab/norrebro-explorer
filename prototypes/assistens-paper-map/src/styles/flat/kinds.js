// The kinds the flat style draws in its own way (index.js drawThing). Anything else is drawn by its category.
// tests/styles.test.mjs checks this list against core/kinds.js.
export const DRAWS = new Set([
  'wall', 'tree', 'grave', 'notable-grave', 'bench', 'lamp', 'tap', 'critter', 'gate-post', 'playground', 'bike-rack',
  'chapel', 'shed', 'block', 'church', 'flag', 'corner-sign', 'fingerpost', 'shopfront',
  'sport-kit', 'flagpole', 'fence', 'bin', 'picnic-table', 'bus-stop', 'traffic-light', 'crossing',
]);
