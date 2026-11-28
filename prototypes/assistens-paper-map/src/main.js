/**
 * Nørrebro Explorer, Assistens Kirkegård slice. Entry point.
 *
 *   config.js     game settings shared by every style: scale, toy scale, walking, zooms, near/far, start, home
 *   data/         hand-kept data and texts: landmarks, the Assistens plan, grave texts (no logic)
 *   core/         the game, with no graphics: the world frame, tiles, the plan, the things, walking, collision,
 *                 near/far, places
 *   ../world/     the packed world tiles the game loads as you walk (npm run pack-world)
 *   styles/       how the game looks: one folder per style, each implementing styles/README.md (?style=<name>)
 *   ui/           overlays that work with every style: place label, street sign, minimap and compass, zoom button
 *
 * Flow: the game opens the world → the chosen style is attached (the first tiles load, the style builds and runs the
 * frame loop, calling game.step each frame; more tiles load as you walk) → the overlays read game.state and game.map.
 */
import { createGame } from './core/game.js';
import { fetchLoader, inlineLoader } from './core/world/loaders.js';
import { ZOOM_ORDER } from './config.js';
import { STYLES, chooseStyle } from './styles/index.js';
import { attachPlaceLabels } from './ui/place-labels.js';
import { attachStreetSign } from './ui/street-sign.js';
import { attachMinimap } from './ui/minimap.js';
import { attachZoomButton } from './ui/zoom-button.js';
import { isCaptureMode } from './ui/overlay.js';
import { createRound } from './core/round.js';
import { attachRound } from './ui/round.js';

// the world: baked into the page (the offline file), or fetched tile by tile from beside it (the hosted game, dev)
const worldUrl = new URL(document.querySelector('meta[name=world]')?.content ?? './world/', location.href);
const loader = window.__WORLD__ ? inlineLoader(window.__WORLD__) : fetchLoader(worldUrl);
const game = await createGame({ loader });
const style = await game.attach(STYLES[chooseStyle()].create(game));

// the page shell: the style's credit and controls hint
const credit = document.getElementById('credit');
const hint = document.getElementById('hint'); // a style may take the hint over (the papercraft harness fades it out)
if (credit && style.credit) credit.textContent += ` · ${style.credit}`;
if (hint && style.hint) hint.textContent = style.hint;

// review captures (tools/capture.py), the same for every style
window.__capture = {
  get ready() { return style.capture?.ready() ?? false; },
  style: style.name,
  step: (sec) => style.capture.step(sec),
  restart: () => { game.toggleZoom(ZOOM_ORDER[0], { instant: true }); style.capture.restart(); }, // each shot from the street zoom
  place: (x, z) => game.place(x, z),
  goTo: (x, z) => game.goTo(x, z),
  zoom: (mode) => game.toggleZoom(mode, { instant: true }),
  hero: () => ({ ...game.state.hero }),
  near: () => game.things.filter((t) => Math.hypot(t.x - game.state.hero.x, t.z - game.state.hero.z) < 20).length,
};

attachPlaceLabels(game);
attachStreetSign(game);
attachMinimap(game);
if (!isCaptureMode()) attachZoomButton(game);

// find your way home: pick where you live, start somewhere else, walk back (?free to just walk about)
const round = createRound(game);
attachRound(game, round);
window.__round = round;
if (new URLSearchParams(location.search).get('zoom') === 'map') game.toggleZoom('map', { instant: true }); // ?zoom=map

// for reviews and the browser console
window.__game = game;
window.__style = style;
