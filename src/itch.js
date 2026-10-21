// Boot for the itch.io page (page/itch.html): the game alone, under the Night look, with a sound button, a
// fullscreen button and, on touch screens, a hold-to-look button. The loop runs fixed 1/60 s steps capped at
// 60 Hz. The sound stops when the tab is hidden; a lost graphics context or a frame error shows a message
// instead of a frozen picture. window.__v16 is the same test hook as the dev page's.
import { createGame } from './fall/game.js';

export const AUTHOR = 'by ____';   // the credit on the title and the game-over card; fill it in before upload
const LOOK = 'night';
const STEP = 1 / 60, MAX_STEPS = 4, SLACK = 0.002, STALE_MS = 100;

const $ = (id) => document.getElementById(id);
const V = (window.__v16 = { ready: false, hold: /[?&]hold/.test(location.search), errors: [], game: null });
window.addEventListener('error', (e) => V.errors.push(String(e.message)));

function boot() {
  const canvas = $('fall'), msg = $('fallMsg'), box = $('box');
  // the picture's size: 960 x 540 on a large screen (every game pixel is a 2 x 2 block on a 1080p screen),
  // 480 x 270 otherwise; ?res=WxH overrides
  const rq = /[?&]res=(\d+)x(\d+)/.exec(location.search);
  const big = Math.min(screen.width, screen.height * 16 / 9) * (devicePixelRatio || 1) >= 1800;
  let res = rq ? [+rq[1], +rq[2]] : big ? [960, 540] : [480, 270];
  // the picture is shown at a whole multiple of its size whenever the multiple fills most of the window
  // (2x for 960 x 540 on a 1080p screen), so every pixel is the same size; otherwise it fills the window
  const fit = () => {
    const w = innerWidth, h = innerHeight, k = Math.floor(Math.min(w / res[0], h / res[1])), fill = Math.min(w, h * 16 / 9);
    if (box && k >= 1 && (res[0] * k) / fill >= 0.72) { box.style.width = res[0] * k + 'px'; box.style.height = res[1] * k + 'px'; }
    else if (box) { box.style.width = ''; box.style.height = ''; }
  };
  addEventListener('resize', fit); document.addEventListener('fullscreenchange', fit); fit();
  const show = (text, small) => { msg.hidden = false; msg.textContent = text; if (small) { const s = document.createElement('small'); s.textContent = small; msg.appendChild(s); } };
  let game = null, dead = false;
  const nq = /[?&]night=(\d+)/.exec(location.search);
  const touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  try { game = createGame(canvas, { noIntro: /nointro/.test(location.search), look: LOOK, night: nq ? +nq[1] : 1, credit: AUTHOR, touch, res }); }
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
  // after the first gesture the overlay buttons fade back so they never sit over the pool; they wake on hover
  const quiet = () => { const ov = document.querySelector('.ov'); if (ov) ov.classList.add('quiet'); };
  canvas.addEventListener('pointerdown', () => { setTimeout(syncSound, 0); quiet(); });
  window.addEventListener('keydown', () => { setTimeout(syncSound, 0); quiet(); });
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

  // the loop: fixed steps, at most 60 a second, a few at once after a hitch, never a catch-up of seconds.
  // A frame a hair short of a step still steps (the slack), so a 60 Hz display steps exactly once a frame
  // and a 120 Hz one every other frame, without a judder of zero-then-two.
  // the first hundred frames after warm-up are timed: on a large screen the picture starts at 960 x 540, and
  // if the display cannot keep up (frames averaging slower than 50 a second) it drops to 480 x 270 and stays
  // there; ?res= forces a size and skips this
  let acc = 0, last = performance.now(), drawn = 0, probeN = 0, probeMs = 0;
  function loop(now) {
    if (dead) return;
    requestAnimationFrame(loop);
    const gap = now - last;
    if (!document.hidden && visible && !V.hold) { probeN++; if (probeN > 30) probeMs += gap; if (!rq && probeN === 130 && res[0] > 480 && probeMs / 100 > 20) { res = [480, 270]; game.setPicture(480, 270); fit(); } }
    acc = Math.min(acc + Math.max(0, gap / 1000), 0.12); last = now;
    if (V.hold || document.hidden || !visible) { acc = 0; return; }
    try {
      let n = 0;
      while (acc >= STEP - SLACK && n < MAX_STEPS) { game.update(STEP); acc = Math.max(0, acc - STEP); n++; }
      if (n || now - drawn > STALE_MS) { game.render(); drawn = now; }
    } catch (e) { V.errors.push(String((e && e.stack) || e)); console.error(e); fail('Something went wrong. Reload the page.', String(e && e.message || e)); }
  }
  requestAnimationFrame(loop);
  V.ready = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
