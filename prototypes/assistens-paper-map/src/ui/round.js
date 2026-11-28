/**
 * The find-your-way-home screens (the round itself is core/round.js):
 *   the picker      "Hvor bor du? · Where do you live?": a card of places to pick as home, and the level
 *   the walk        a card with home's name, the time, and the peek and arrow buttons; the arrow; a nudge to cross
 *                   at the zebra crossing when the walker steps onto a road anywhere else
 *   home            "Du er hjemme! · You're home!": stars, time, how far, the route walked drawn on a little map
 * The picked home and level are remembered on this device only (localStorage). Nothing here runs in capture mode.
 * Text is Danish first, English second, like the rest of the game.
 */
import { isCaptureMode, createOverlay } from './overlay.js';
import { SCALE } from '../config.js';

const SAVED = 'norrebro-explorer.home';
const ICON = { school: '🏫', church: '⛪', park: '🌳', bakery: '🥐', playground: '🛝' };
const load = () => { try { return JSON.parse(localStorage.getItem(SAVED)) ?? null; } catch { return null; } };
const save = (v) => { try { localStorage.setItem(SAVED, JSON.stringify(v)); } catch { /* private mode: not remembered */ } };
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const metres = (u) => `${Math.round(u / SCALE / 10) * 10} m`;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/** @param round from core/round.js createRound(game) */
export function attachRound(game, round) {
  if (isCaptureMode() || new URLSearchParams(location.search).has('free')) return;
  const backdrop = createOverlay('round-backdrop');
  const card = el('div', 'round-card');
  backdrop.appendChild(card);
  const hud = createOverlay('round-hud');
  const arrow = createOverlay('round-arrow');
  arrow.innerHTML = '<svg viewBox="0 0 100 60" width="110" height="66"><path d="M4 22 H62 V6 L96 30 L62 54 V38 H4 Z" fill="#d6452f" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg>';
  const nudge = createOverlay('round-nudge');
  const choice = load() ?? { homeId: null, level: 'small' };

  const show = (on) => backdrop.classList.toggle('visible', on);

  // ---- the picker ----------------------------------------------------------------------------------------------------
  function picker() {
    card.replaceChildren();
    card.append(el('h2', null, 'Find vej hjem'), el('p', 'en', 'Find your way home'));
    card.append(el('h3', null, 'Hvor bor du? · Where do you live?'));
    const places = el('div', 'round-places');
    for (const p of round.places) {
      const b = el('button', p.id === choice.homeId ? 'chosen' : '');
      b.append(el('span', 'icon', ICON[p.kind] ?? '📍'), el('span', null, p.name));
      b.onclick = () => { choice.homeId = p.id; picker(); };
      places.appendChild(b);
    }
    card.appendChild(places);
    card.append(el('h3', null, 'Hvor svært? · How hard?'));
    const levels = el('div', 'round-levels');
    for (const L of Object.values(round.levels)) {
      const b = el('button', L.id === choice.level ? 'chosen' : '');
      const what = `${L.minimap ? 'kort i hjørnet · map in the corner' : 'intet kort · no map'}, ${L.peeks} kig · peeks, ${L.arrows} pile · arrows`;
      b.append(el('b', null, `${L.label} · ${L.en}`), el('small', null, what));
      b.onclick = () => { choice.level = L.id; picker(); };
      levels.appendChild(b);
    }
    card.appendChild(levels);
    const row = el('div', 'round-row');
    const go = el('button', 'go', 'Start ▸');
    go.disabled = !choice.homeId;
    go.onclick = start;
    const free = el('button', 'quiet', 'Bare gå rundt · Just explore');
    free.onclick = () => { round.stop(); show(false); hud.classList.remove('visible'); };
    row.append(free, go);
    card.appendChild(row);
    show(true);
  }

  async function start() {
    save(choice);
    show(false);
    await round.start(choice);
  }

  // ---- the walk ------------------------------------------------------------------------------------------------------
  const homeLine = el('div', 'home');
  const timeLine = el('div', 'time');
  const peekBtn = el('button');
  const arrowBtn = el('button');
  const giveUp = el('button', 'quiet', 'Skift · Change');
  peekBtn.onclick = () => round.peek();
  arrowBtn.onclick = () => round.arrow();
  giveUp.onclick = () => { round.stop(); picker(); };
  const buttons = el('div', 'buttons');
  buttons.append(peekBtn, arrowBtn, giveUp);
  hud.append(homeLine, timeLine, buttons);

  game.onFrame((state) => {
    const r = state.round;
    hud.classList.toggle('visible', !!r && r.status === 'walking');
    document.body.classList.toggle('round-no-map', !!r && !r.level.minimap);
    document.body.classList.toggle('round-on', !!r && r.status === 'walking'); // the free zoom button gives way to Peek
    if (!r) { arrow.classList.remove('visible'); return; }
    homeLine.textContent = `🏠 ${r.home.name}`;
    timeLine.textContent = `⏱ ${clock(r.time)}`;
    peekBtn.textContent = `🗺 Kig på kortet · Peek (${r.peeksLeft})`;
    peekBtn.disabled = r.peeksLeft <= 0;
    arrowBtn.textContent = `➜ Pil · Arrow (${r.arrowsLeft})`;
    arrowBtn.disabled = r.arrowsLeft <= 0;
    arrowBtn.hidden = r.level.arrows === 0;
    // the arrow toward home, turned with the camera: screen up is the way the camera looks
    const on = r.status === 'walking' && state.time < r.arrowUntil;
    arrow.classList.toggle('visible', on);
    if (on) {
      const yaw = (state.view.yaw * Math.PI) / 180;
      const [dx, dz] = [r.home.x - state.hero.x, r.home.z - state.hero.z];
      const ahead = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
      const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      // beside the walker (the middle of the screen), pointing out the way home
      arrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(right, ahead) - Math.PI / 2}rad) translateX(95px)`;
    }
    // the nudge to cross at the zebra, for a few seconds after stepping onto a road elsewhere
    const crossedBadly = r.status === 'walking' && state.time - r.lastJaywalk < 3.5;
    if (crossedBadly && !nudge.classList.contains('visible')) nudge.textContent = 'Gå over ved fodgængerovergangen · Cross at the zebra crossing';
    nudge.classList.toggle('visible', crossedBadly);
  });

  // ---- home ----------------------------------------------------------------------------------------------------------
  round.onFinish((r) => {
    card.replaceChildren();
    card.append(el('h2', null, 'Du er hjemme!'), el('p', 'en', "You're home!"));
    card.append(el('div', 'stars', '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars)));
    const facts = el('div', 'facts');
    facts.append(
      el('div', null, `⏱ ${clock(r.time)}`),
      el('div', null, `👣 ${metres(r.walked)} gået · walked`),
      el('div', null, `📏 ${metres(r.straight)} i fugleflugt · as the crow flies`),
    );
    card.appendChild(facts);
    if (r.jaywalks === 0) card.appendChild(el('div', 'badge', '🦓 Sikker fodgænger · Safe walker: altid over ved fodgængerovergangen'));
    card.appendChild(routeMap(game, r));
    card.appendChild(el('p', 'en', `Fra · From: ${r.from.name}`));
    const row = el('div', 'round-row');
    const change = el('button', 'quiet', 'Skift hjem · Change home');
    change.onclick = () => { round.stop(); picker(); };
    const again = el('button', 'go', 'Ny tur · New walk ▸');
    again.onclick = start;
    row.append(change, again);
    card.appendChild(row);
    show(true);
  });

  if (choice.homeId) start(); else picker();
}

/** The route walked, drawn over the overview: streets, the path in red, the start and home. */
function routeMap(game, r) {
  const W = 420;
  const H = 260;
  const cv = el('canvas', 'route');
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const xs = [...r.path.map((p) => p[0]), r.home.x];
  const zs = [...r.path.map((p) => p[1]), r.home.z];
  const [x0, x1, z0, z1] = [Math.min(...xs) - 8, Math.max(...xs) + 8, Math.min(...zs) - 8, Math.max(...zs) + 8];
  const s = Math.min(W / (x1 - x0), H / (z1 - z0));
  const X = (x) => (x - (x0 + x1) / 2) * s + W / 2;
  const Z = (z) => (z - (z0 + z1) / 2) * s + H / 2;
  const line = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); };
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ddd0b6';
  for (const pts of game.map.overview.buildings) { line(pts); g.closePath(); g.fill(); }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#ffffff';
  for (const st of game.map.overview.streets) { g.lineWidth = Math.max(1, st.half * 2 * s); line(st.pts); g.stroke(); }
  g.setLineDash([4, 5]);
  g.strokeStyle = '#8a7a62';
  g.lineWidth = 1.5;
  line([[r.from.x, r.from.z], [r.home.x, r.home.z]]);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = '#d6452f';
  g.lineWidth = 3.5;
  line(r.path);
  g.stroke();
  g.fillStyle = '#2e241c';
  g.beginPath();
  g.arc(X(r.from.x), Z(r.from.z), 5, 0, 7);
  g.fill();
  g.font = '18px sans-serif';
  g.textAlign = 'center';
  g.fillText('🏠', X(r.home.x), Z(r.home.z) + 6);
  return cv;
}
