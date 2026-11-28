/**
 * The find-your-way-home screens (the round itself is core/round.js). The game opens as a free walk; the
 * "Find vej hjem" button in the corner opens the game:
 *   setup      "Hvor bor du? · Where do you live?": type an address (suggestions as you type, from the map's own
 *              address list: core/address.js) or pick a place you know, choose how hard, Start
 *   the walk   a card with home's name, the time, the peek and arrow buttons, and Stop; the arrow; a nudge to cross
 *              at the zebra crossing when the walker steps onto a road anywhere else
 *   home       "Du er hjemme! · You're home!": stars, time, how far, the route walked drawn on a little map
 * The address and level are kept on this device only (localStorage), to fill the card in next time, and "Glem ·
 * Forget" clears them. Nothing is sent anywhere. Nothing here runs in capture mode.
 * Text is Danish first, English second, like the rest of the game.
 */
import { isCaptureMode, createOverlay } from './overlay.js';
import { SCALE, REGION } from '../config.js';
import { createAddressBook, parse } from '../core/address.js';

const SAVED = 'norrebro-explorer.home';
const ICON = { school: '🏫', church: '⛪', park: '🌳', bakery: '🥐', playground: '🛝' };
const load = () => { try { return JSON.parse(localStorage.getItem(SAVED)) ?? null; } catch { return null; } };
const save = (v) => { try { localStorage.setItem(SAVED, JSON.stringify(v)); } catch { /* private mode: not remembered */ } };
const forget = () => { try { localStorage.removeItem(SAVED); } catch { /* nothing kept */ } };
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const metres = (u) => `${Math.round(u / SCALE / 10) * 10} m`;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/**
 * @param round  from core/round.js createRound(game)
 * @param loader the world's loader (its addresses())
 */
export function attachRound(game, round, loader) {
  if (isCaptureMode()) return;
  const book = createAddressBook(loader, REGION);
  const backdrop = createOverlay('round-backdrop');
  const card = el('div', 'round-card');
  backdrop.appendChild(card);
  backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });
  const opener = createOverlay('round-open');
  opener.textContent = '🏠 Find vej hjem';
  opener.onclick = () => setup();
  const hud = createOverlay('round-hud');
  const arrow = createOverlay('round-arrow');
  arrow.innerHTML = '<svg viewBox="0 0 100 60" width="110" height="66"><path d="M4 22 H62 V6 L96 30 L62 54 V38 H4 Z" fill="#d6452f" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg>';
  const nudge = createOverlay('round-nudge');
  // what the card is filled in with: { address: 'Blågårdsgade 12' } or { placeId }, and the level
  const choice = { address: '', placeId: null, level: 'small', ...(load() ?? {}) };
  let home = null; // the home the last walk was to (a new walk goes to the same one)

  const show = (on) => { backdrop.classList.toggle('visible', on); document.body.classList.toggle('round-card-open', on); };
  const close = () => { if (!round.current || round.current.status !== 'walking') show(false); };

  // ---- setup -------------------------------------------------------------------------------------------------------
  function setup() {
    card.replaceChildren();
    card.append(el('h2', null, 'Find vej hjem'), el('p', 'en', 'Find your way home: you start somewhere else in Nørrebro and walk home'));

    card.append(el('h3', null, 'Hvor bor du? · Where do you live?'));
    const field = el('div', 'round-address');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'Din adresse, fx Blågårdsgade 12 · Your address';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = choice.address;
    const list = el('div', 'round-suggest');
    const status = el('div', 'round-status');
    field.append(input, list, status);
    card.appendChild(field);

    card.append(el('p', 'or', 'eller vælg et sted du kender · or pick a place you know'));
    const places = el('div', 'round-places');
    const placeButtons = round.places.map((p) => {
      const b = el('button', p.id === choice.placeId ? 'chosen' : '');
      b.append(el('span', 'icon', ICON[p.kind] ?? '📍'), el('span', null, p.name));
      b.onclick = () => { choice.placeId = p.id; choice.address = ''; input.value = ''; list.replaceChildren(); status.textContent = ''; mark(); };
      places.appendChild(b);
      return [p.id, b];
    });
    card.appendChild(places);

    card.append(el('h3', null, 'Hvor svært? · How hard?'));
    const levels = el('div', 'round-levels');
    const levelButtons = Object.values(round.levels).map((L) => {
      const b = el('button', L.id === choice.level ? 'chosen' : '');
      const what = `${L.minimap ? 'kort i hjørnet · map in the corner' : 'intet kort · no map'}, ${L.peeks} kig · peeks, ${L.arrows} pile · arrows`;
      b.append(el('b', null, `${L.label} · ${L.en}`), el('small', null, what));
      b.onclick = () => { choice.level = L.id; mark(); };
      levels.appendChild(b);
      return [L.id, b];
    });
    card.appendChild(levels);

    const row = el('div', 'round-row');
    const left = el('div');
    const back = el('button', 'quiet', 'Bare gå rundt · Just explore');
    back.onclick = () => show(false);
    left.appendChild(back);
    if (load()) {
      const gone = el('button', 'quiet', 'Glem min adresse · Forget my address');
      gone.onclick = () => { forget(); choice.address = ''; choice.placeId = null; setup(); };
      left.appendChild(gone);
    }
    const go = el('button', 'go', 'Start ▸');
    go.onclick = start;
    row.append(left, go);
    card.appendChild(row);
    card.appendChild(el('p', 'small', 'Adressen bliver kun gemt på denne enhed · Your address stays on this device'));

    let found = null; // the address the field holds, once looked up
    const mark = () => {
      for (const [id, b] of placeButtons) b.classList.toggle('chosen', id === choice.placeId && !choice.address);
      for (const [id, b] of levelButtons) b.classList.toggle('chosen', id === choice.level);
      go.disabled = !(found || (choice.placeId && !choice.address));
    };
    let asked = 0;
    async function lookUp() {
      const text = input.value.trim();
      choice.address = text;
      const mine = ++asked;
      if (!text) { found = null; list.replaceChildren(); status.textContent = ''; mark(); return; }
      choice.placeId = null;
      const [hits, best] = await Promise.all([book.suggest(text), book.find(text)]);
      if (mine !== asked) return; // typed on meanwhile
      const noNumber = !parse(text).number;
      found = best && !best.outside && !noNumber ? best : null;
      list.replaceChildren();
      for (const h of hits) {
        if (h.label === found?.label && hits.length === 1) break;
        const b = el('button', null, h.label);
        b.onclick = () => { input.value = h.label; lookUp(); input.focus(); };
        list.appendChild(b);
      }
      status.className = `round-status ${found ? 'ok' : noNumber && best && !best.outside ? '' : 'no'}`;
      status.textContent = found ? `🏠 ${found.label}`
        : best && !best.outside && noNumber ? 'Skriv dit husnummer · Add your house number'
        : best?.outside ? 'Den gade er uden for kortet endnu · That street is outside the map for now'
          : 'Kan ikke finde adressen · Can\'t find that address (try the street name)';
      mark();
    }
    input.addEventListener('input', lookUp);
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !go.disabled) start(); }); // typing doesn't walk
    input.addEventListener('keyup', (e) => e.stopPropagation());
    show(true);
    if (choice.address) lookUp(); else mark();
    setTimeout(() => input.focus(), 50);

    async function start() {
      go.disabled = true;
      go.textContent = '…';
      if (choice.address) {
        home = await round.homeAt(found ?? await book.find(choice.address));
        if (!home) { status.className = 'round-status no'; status.textContent = 'Adressen ligger lige ved kanten af kortet · That address is just at the edge of the map: try another'; go.textContent = 'Start ▸'; return; }
        save({ address: found?.label ?? choice.address, level: choice.level });
      } else {
        home = round.places.find((p) => p.id === choice.placeId);
        save({ placeId: choice.placeId, level: choice.level });
      }
      walk();
    }
  }

  async function walk() {
    show(false);
    await round.start({ home, level: choice.level });
  }

  // ---- the walk ------------------------------------------------------------------------------------------------------
  const homeLine = el('div', 'home');
  const timeLine = el('div', 'time');
  const peekBtn = el('button');
  const arrowBtn = el('button');
  const stop = el('button', 'quiet', 'Stop');
  peekBtn.onclick = () => round.peek();
  arrowBtn.onclick = () => round.arrow();
  stop.onclick = () => round.stop();
  const buttons = el('div', 'buttons');
  buttons.append(peekBtn, arrowBtn, stop);
  hud.append(homeLine, timeLine, buttons);

  game.onFrame((state) => {
    const r = state.round;
    const walking = !!r && r.status === 'walking';
    hud.classList.toggle('visible', walking);
    opener.classList.toggle('visible', !r);
    document.body.classList.toggle('round-no-map', walking && !r.level.minimap);
    document.body.classList.toggle('round-on', walking); // the free zoom button gives way to Peek
    if (!r) { arrow.classList.remove('visible'); nudge.classList.remove('visible'); return; }
    homeLine.textContent = `🏠 ${r.home.name}`;
    timeLine.textContent = `⏱ ${clock(r.time)}`;
    peekBtn.textContent = `🗺 Kig på kortet · Peek (${r.peeksLeft})`;
    peekBtn.disabled = r.peeksLeft <= 0;
    arrowBtn.textContent = `➜ Pil · Arrow (${r.arrowsLeft})`;
    arrowBtn.disabled = r.arrowsLeft <= 0;
    arrowBtn.hidden = r.level.arrows === 0;
    // the arrow toward home, turned with the camera: screen up is the way the camera looks
    const on = walking && state.time < r.arrowUntil;
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
    const crossedBadly = walking && state.time - r.lastJaywalk < 3.5;
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
    const left = el('div');
    const explore = el('button', 'quiet', 'Gå rundt · Explore');
    explore.onclick = () => { round.stop(); show(false); };
    const change = el('button', 'quiet', 'Skift · Change');
    change.onclick = () => { round.stop(); setup(); };
    left.append(explore, change);
    const again = el('button', 'go', 'Ny tur · New walk ▸');
    again.onclick = walk;
    row.append(left, again);
    card.appendChild(row);
    show(true);
  });
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
