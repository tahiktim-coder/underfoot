// Boot for both pages: page/looks.html (the contact sheet of seven looks, its large view, one live canvas whose
// look can be changed while it runs) and page/game.html (the game alone, with a look bar). Anything a page lacks
// is skipped. The game renders only while on screen and the tab is visible.
// window.__v16 = { ready, hold, errors, game, step, force, view, setLook } for the headless tools.
import { createGame } from './fall/game.js';
import { LOOKS } from './fall/looks.js';

const $ = (id) => document.getElementById(id);
const V = (window.__v16 = { ready: false, hold: /[?&]hold/.test(location.search), errors: [], game: null });
window.addEventListener('error', (e) => V.errors.push(String(e.message)));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } },
};

// ---------------------------------------------------------------------------------- the sheet
function fillPalettes() {
  for (const el of document.querySelectorAll('[data-pal]')) {
    const P = LOOKS[el.dataset.pal].palette;
    for (const c of [...P.greys, ...P.hues.flat()]) { const i = document.createElement('i'); i.style.background = c; el.appendChild(i); }
  }
  for (const el of document.querySelectorAll('[data-chip]')) {
    const P = LOOKS[el.dataset.chip].palette, g = P.greys;
    for (const c of [g[1], g[g.length - 2] || g[1], (P.hues[0] || [])[3] || g[g.length - 1]]) { const i = document.createElement('i'); i.style.background = c; el.appendChild(i); }
  }
}

function lightbox() {
  const box = $('box'), img = $('boxImg');
  if (!box || !img) return;
  const looks = [...document.querySelectorAll('#sheet .look')].map((a) => a.dataset.look);
  const shots = ['valley', 'search', 'look', 'face'];
  const shotName = { valley: 'In the valley', search: 'The search', look: 'Looking up', face: 'Its face' };
  let li = 0, si = 0, opener = null;
  function show() {
    const art = $('look-' + looks[li]), im = art.querySelectorAll('.still')[si].querySelector('img');
    img.src = im.dataset.full; img.alt = im.alt;
    $('boxName').firstChild.nodeValue = art.querySelector('h3').textContent;
    $('boxMoment').textContent = shotName[shots[si]];
  }
  function open(L, S, from) {
    li = looks.indexOf(L); si = shots.indexOf(S); opener = from; show();
    if (typeof box.showModal === 'function') box.showModal(); else box.setAttribute('open', '');
  }
  function close() { if (typeof box.close === 'function') box.close(); else box.removeAttribute('open'); }
  box.addEventListener('close', () => { if (opener) opener.focus({ preventScroll: true }); });
  const step = (dl, ds) => { li = (li + dl + looks.length) % looks.length; si = (si + ds + shots.length) % shots.length; show(); };
  $('boxUp').addEventListener('click', () => step(-1, 0));
  $('boxDown').addEventListener('click', () => step(1, 0));
  $('boxLeft').addEventListener('click', () => step(0, -1));
  $('boxRight').addEventListener('click', () => step(0, 1));
  $('boxClose').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  box.addEventListener('keydown', (e) => {
    const k = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (k) { e.preventDefault(); step(k[0], k[1]); }
  });
  for (const art of document.querySelectorAll('#sheet .look')) {
    for (const b of art.querySelectorAll('.still')) b.addEventListener('click', () => open(art.dataset.look, b.dataset.shot, b));
  }
}

// the look bar, the note under the live screen (the same words as the look's row in the sheet) and, on the
// game page, the swatch of the current look's palette
function showNote(look) {
  for (const b of document.querySelectorAll('#lookbar [data-look]')) b.setAttribute('aria-pressed', b.dataset.look === look ? 'true' : 'false');
  const pal = $('fallPal');
  if (pal) {
    const P = LOOKS[look].palette, cols = [...P.greys, ...P.hues.flat()];
    pal.textContent = '';
    for (const c of cols) { const i = document.createElement('i'); i.style.background = c; i.title = c; pal.appendChild(i); }
    if ($('fallPalName')) $('fallPalName').textContent = LOOKS[look].name + ': ' + cols.length + ' colours';
  }
  const art = $('look-' + look);
  if (!art || !$('nowName')) return;
  $('nowName').textContent = art.querySelector('h3').textContent;
  $('nowWhat').textContent = art.querySelector('.what').textContent;
  const foot = $('nowFoot'); foot.textContent = '';
  for (const p of art.querySelectorAll('.look-foot p')) foot.appendChild(p.cloneNode(true));
}

// ---------------------------------------------------------------------------------- boot
function boot() {
  fillPalettes();
  lightbox();
  const q = /[?&]look=(\w+)/.exec(location.search), saved = store.get('underfoot.look');
  let look = (q && LOOKS[q[1]] && q[1]) || (saved && LOOKS[saved] ? saved : 'ashwake');
  showNote(look);

  const canvas = $('fall'), msg = $('fallMsg');
  let game = null;
  const setLook = (name) => {
    if (!LOOKS[name]) return;
    look = name; store.set('underfoot.look', name); showNote(name);
    if (game) game.setLook(name);
  };
  for (const b of document.querySelectorAll('#lookbar [data-look]')) b.addEventListener('click', () => setLook(b.dataset.look));
  for (const b of document.querySelectorAll('[data-play]')) b.addEventListener('click', () => {
    setLook(b.dataset.play);
    const live = $('live');
    if (live) live.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (canvas) canvas.focus({ preventScroll: true });
  });
  if (!canvas) { V.ready = true; return; }

  const nq = /[?&]night=(\d)/.exec(location.search);
  if (/[?&]debug/.test(location.search)) for (const el of document.querySelectorAll('[data-debug]')) el.hidden = false;
  try { game = createGame(canvas, { noIntro: /nointro/.test(location.search), look, night: nq ? +nq[1] : 1 }); } catch (e) { V.errors.push(String((e && e.stack) || e)); console.error(e); if (msg) { msg.hidden = false; msg.textContent = 'Could not start: ' + e.message; } V.ready = true; return; }
  if (!game) { if (msg) { msg.hidden = false; msg.textContent = 'This needs WebGL2, which this browser does not offer. The stills above show every look.'; } V.ready = true; return; }
  V.game = game;
  V.step = (_, dt) => game.frame(dt);
  V.force = (n) => game.force(n);
  V.view = (n) => game.view(n);
  V.setLook = (n) => setLook(n);
  V.begin = () => game.begin();
  canvas.focus({ preventScroll: true });

  // hold to look up
  const lb = $('lookBtn');
  if (lb) {
    const on = (e) => { e.preventDefault(); game.snd.init(); syncSound(); game.S.lookButton = true; game.S.idle = 0; game.S.auto = false; lb.classList.add('held'); };
    const off = () => { game.S.lookButton = false; lb.classList.remove('held'); };
    lb.addEventListener('pointerdown', on); lb.addEventListener('pointerup', off); lb.addEventListener('pointerleave', off); lb.addEventListener('pointercancel', off);
    lb.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') on(e); });
    lb.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') off(); });
    lb.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // sound: starts with the first touch of the picture; the button shows and flips it
  const sb = $('soundBtn');
  function syncSound() { if (sb) sb.setAttribute('aria-pressed', game.snd.on ? 'true' : 'false'); }
  if (sb) sb.addEventListener('click', () => { if (!game.snd.on) { game.snd.init(); game.snd.setMuted(false); } else game.snd.setMuted(true); syncSound(); });
  canvas.addEventListener('pointerdown', () => setTimeout(syncSound, 0));
  canvas.addEventListener('keydown', () => setTimeout(syncSound, 0));
  // jump to a moment
  for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', () => { game.snd.init(); syncSound(); game.S.played = true; game.S.auto = false; game.force(b.dataset.go); canvas.focus({ preventScroll: true }); });

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '60px' }).observe(canvas);
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (V.hold || document.hidden || !visible) return;
    try { game.frame(dt); } catch (e) { V.errors.push(String((e && e.stack) || e)); console.error(e); V.hold = true; if (msg) { msg.hidden = false; msg.textContent = 'Something went wrong. Reload the page. ' + (e && e.message || e); } }
  }
  requestAnimationFrame(loop);
  V.ready = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
