// Boot for the itch.io page (page/itch.html): the game alone, under the Night look, with a sound button, a
// fullscreen button and, on touch screens, a hold-to-look button. The loop runs fixed 1/60 s steps capped at
// 60 Hz. The sound stops when the tab is hidden; a lost graphics context or a frame error shows a message
// instead of a frozen picture. window.__v16 is the same test hook as the dev page's.
import { createGame } from './fall/game.js';

export const AUTHOR = 'by ____';   // the credit on the title and the game-over card; fill it in before upload
const LOOK = 'night';
const STEP = 1 / 60, MAX_STEPS = 4;

const $ = (id) => document.getElementById(id);
const V = (window.__v16 = { ready: false, hold: /[?&]hold/.test(location.search), errors: [], game: null });
window.addEventListener('error', (e) => V.errors.push(String(e.message)));

function boot() {
  const canvas = $('fall'), msg = $('fallMsg');
  const show = (text, small) => { msg.hidden = false; msg.textContent = text; if (small) { const s = document.createElement('small'); s.textContent = small; msg.appendChild(s); } };
  let game = null, dead = false;
  const nq = /[?&]night=(\d+)/.exec(location.search);
  try { game = createGame(canvas, { noIntro: /nointro/.test(location.search), look: LOOK, night: nq ? +nq[1] : 1, credit: AUTHOR }); }
  catch (e) { V.errors.push(String((e && e.stack) || e)); show('Could not start.', String(e && e.message || e)); V.ready = true; return; }
  if (!game) { show('This needs WebGL2, which this browser does not offer.'); V.ready = true; return; }
  msg.hidden = true;
  V.game = game;
  V.step = (_, dt) => game.frame(dt);
  V.force = (n) => game.force(n);
  V.view = (n) => game.view(n);
  V.begin = () => game.begin();
  canvas.focus({ preventScroll: true });

  // a frame error or a lost graphics context: stop, say so
  const fail = (text, small) => { dead = true; try { game.snd.suspend(); } catch (_) { /* ignore */ } show(text, small); };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); V.errors.push('context lost'); fail('Graphics reset. Reload the page.'); });

  // the buttons: sound (the game starts it on the first key or click; this flips it), fullscreen, look up
  const sb = $('soundBtn');
  const syncSound = () => sb.setAttribute('aria-pressed', game.snd.on ? 'true' : 'false');
  sb.addEventListener('click', () => { game.snd.init(); if (!game.snd.on) game.snd.setMuted(false); else game.snd.setMuted(true); syncSound(); canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('pointerdown', () => setTimeout(syncSound, 0));
  window.addEventListener('keydown', () => setTimeout(syncSound, 0));
  // fullscreen on the document, not the screen: the screen keeps its 16:9 rule inside it and is letterboxed
  const fs = $('fsBtn'), doc = document.documentElement;
  fs.addEventListener('click', () => {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
    else if (doc.requestFullscreen) doc.requestFullscreen().catch(() => {});
    canvas.focus({ preventScroll: true });
  });
  if (!doc.requestFullscreen) fs.hidden = true;
  document.addEventListener('fullscreenchange', () => fs.setAttribute('aria-pressed', document.fullscreenElement ? 'true' : 'false'));
  const lb = $('lookBtn');
  const on = (e) => { e.preventDefault(); game.snd.init(); syncSound(); game.S.lookButton = true; lb.classList.add('held'); };
  const off = () => { game.S.lookButton = false; lb.classList.remove('held'); };
  lb.addEventListener('pointerdown', on); lb.addEventListener('pointerup', off); lb.addEventListener('pointerleave', off); lb.addEventListener('pointercancel', off); lb.addEventListener('lostpointercapture', off);
  lb.addEventListener('contextmenu', (e) => e.preventDefault());

  // the sound stops with the tab and when the picture is off screen; it comes back when they do
  let visible = true;
  const audio = () => { if (document.hidden || !visible) game.snd.suspend(); else if (game.S.played) game.snd.resume(); };
  document.addEventListener('visibilitychange', audio);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; audio(); }, { rootMargin: '60px' }).observe(canvas);

  // the loop: fixed steps, at most 60 a second, a few at once after a hitch, never a catch-up of seconds
  let acc = 0, last = performance.now();
  function loop(now) {
    if (dead) return;
    requestAnimationFrame(loop);
    acc = Math.min(acc + Math.max(0, (now - last) / 1000), 0.12); last = now;
    if (V.hold || document.hidden || !visible) { acc = 0; return; }
    try {
      let n = 0;
      while (acc >= STEP && n < MAX_STEPS) { game.update(STEP); acc -= STEP; n++; }
      if (n) game.render();
    } catch (e) { V.errors.push(String((e && e.stack) || e)); console.error(e); fail('Something went wrong. Reload the page.', String(e && e.message || e)); }
  }
  requestAnimationFrame(loop);
  V.ready = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
