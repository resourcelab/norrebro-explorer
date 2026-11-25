/**
 * Nørrebro Explorer, Assistens Kirkegård slice. Entry point.
 *
 *   config.js     game settings shared by every style: scale, toy scale, walking, zooms, near/far, start, home
 *   data/         OpenStreetMap extracts and texts (no logic)
 *   core/         the game, with no graphics: the map, the plan, the things, walking, collision, near/far, places
 *   styles/       how the game looks: one folder per style, each implementing styles/README.md (?style=<name>)
 *   ui/           overlays that work with every style: place label, street sign, minimap and compass, zoom button
 *
 * Flow: the game plans the world → the chosen style builds it and runs the frame loop, calling game.step each frame
 * → the overlays read game.state.
 */
import { createGame } from './core/game.js';
import { STYLES, chooseStyle } from './styles/index.js';
import { attachPlaceLabels } from './ui/place-labels.js';
import { attachStreetSign } from './ui/street-sign.js';
import { attachMinimap } from './ui/minimap.js';
import { attachZoomButton } from './ui/zoom-button.js';
import { isCaptureMode } from './ui/overlay.js';

const game = createGame();
const style = game.attach(STYLES[chooseStyle()].create(game));

attachPlaceLabels(game);
attachStreetSign(game);
attachMinimap(game);
if (!isCaptureMode()) attachZoomButton(game);
if (new URLSearchParams(location.search).get('zoom') === 'map') game.toggleZoom('map', { instant: true }); // ?zoom=map

// for reviews and the browser console
window.__game = game;
window.__style = style;
