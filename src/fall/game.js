// UNDERFOOT — the piece. You are small, somewhere in a walled hill town. Something kilometres tall walks the
// valley with a lantern on a chain. When it stops over the town, its light searches the streets: keep to the
// shadows of the houses. If it finds you, the camera drops to the street and you look up at it.
//
// One cycle: calm (it walks far off) -> approach (footfalls, lights go out) -> plant (a foot lands outside
// the walls) -> search (the lantern sweeps) -> caught (the look up) or leave (it steps over the town).
import { createRenderer, VW, VH } from './renderer.js';
import { createGiant, buildGiantMesh, footAt } from './giant.js';
import { chain, lantern, person, beam } from './props.js';
import { millSails, M } from './mesh.js';
import { standY, height, blocked, segmentBlocked, inCover, houses, OCCLUDERS, TOWN, SQUARE, STREETS, CHURCH, townR } from './world.js';
import { drawWisp, measureWisp } from '../lib/wisp.js';
import { mulberry } from '../lib/noise.js';
import { createSound } from './sound.js';
import { LOOKS, LOOK_ORDER } from './looks.js';
import { NIGHTS, NIGHT_BONUS, BANK, night, RULE, nightCard, overCard, best } from './nights.js';
import { brain, walk, spawnPerson } from './people.js';
import { createHomes } from './homes.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// The light, the fog, the palette and the post settings come from the current look (looks.js).

// where the giant stops: its right foot just outside the west wall, its left far behind
const STANCE = { front: { foot: 1, x: -470, z: 26, yaw: Math.PI / 2 }, back: { foot: 0, x: -1240, z: -290, yaw: 1.78 } };
const STEP_T = 8.5, SWING = 7.2;
const CUT1 = 1.1, INTRO_CUT = 5.6;
const CATCH_LEN = 5.0;        // the catch, seen only from the street: the light narrows on you, you flare and come apart, a cut to black
const CATCH_BURN = 2.4;       // when the burn starts (it takes about 1.2 s)
const CATCH_CUT = 4.4;        // the hard cut to black, with the hit
const DIP_OUT = 0.12, DIP_IN = 0.2;   // the quick dip to dark on a camera cut
const LAN = 40, LAN_Y = 56;   // the lantern's size, and how high its ring rides over the ground while it searches
const LAN_BODY = 37;          // the lantern's body hangs this far below the ring (the drip is at its end)
const RING_CLEAR = LAN_BODY + 7, RING_CLEAR_TOWER = LAN_BODY + 13;   // the ring never hangs nearer a roof ridge (a tower top) than this: the drip clears it by 7 m (13 m)
const RING_REACH = 8, RING_SLOPE = 1.5;   // how far past a building's footprint the floor reaches, and how fast it falls off beyond (metres per metre)
const RAY_SPREAD = 30;        // the hiding test's rays reach points this far apart across the glass (metres); the drawn penumbra uses the same
const SHADOW_DRAIN = 0.3;     // how fast the eye empties per second in deep shadow
const OFF_PERIOD = 36;        // seconds for the lantern to drift from low to nearly overhead and back
const SPIN = 26;              // seconds for the lamp to go once round the mark, so every wall's far side gets lit in turn (the night table shortens it)
const ALERT_OFF = 24;         // the lamp's side offset once it has you: it pulls in, but a house still throws a few metres of shadow (at 8 it hung overhead and nothing did)
const ALERT_NARROW = 0.3;     // how much the beam tightens and brightens once it has you
const ALERT_LOST = 1.5;       // seconds after it loses you before the lamp swings back out and the beam opens
const DWELL = 4;              // seconds the light may sit on your hiding spot before it peers in and you count as half seen
const DWELL_R = 10;           // how near its mark's centre must be to you for that (metres)
const DWELL_MOVE = 8;         // moving this far from where it began to peer resets it: the counter is to leave, not to shuffle
const CHASE_LAG = 2;          // seen, it comes along your path this many trail samples (0.5 s) behind you, so it takes your corners
const DIM_LIT = 0.3;          // light fainter than this (the pool's edge, drawn nearly black) counts as half seen, never as seen
const GEAR_FROM = 8;          // seconds into a search before the catch-up gear may run
const TAKE_LIT = 1.2;         // seconds the light must hold a townsperson before it narrows on them
const TITLE_LOOP = 14;        // the title's slow push repeats every this many seconds until you begin
const CARD_HOLD = 4;          // a night card moves on by itself after this long
const LEAVE_LATER = 12;       // seconds of the leave from night 2 on (night 1 and the title loop keep the full 21)
const GIVE_UP = 5;            // the last seconds of a search, once it has lost you: the lantern lifts and the light widens and dims
const OVERTIME = 20;          // seconds past the search length it keeps hunting while it still has you, at most
const LIFT = 40;              // how much higher the lantern rides when it is giving up (metres)
const TELL_WORDS = true;      // the word over your head in the search (Hidden, Half seen, Seen) and the eye bar under it
const TELL_EDGE = true;       // the pulse at the screen's edges while the light has you: amber half seen, red seen
const PUFF_KEEP_OUT = 150;    // no footfall dust ring spawns closer to you than this (metres)

function walkPlan(t0, stepLen, back, front, far = 3500, wobble = 0) {
  // The walk in is planned backward from where it stops, so every stride is the same length: the last two
  // plants are the stance itself, and the plants before them step back along the line through it, one
  // stepLen apart, alternating feet, each foot to its own side. (Planned forward and patched at the end, one
  // stride came out half as long again, and for a second the giant stood in a 1.5 km split with a knee
  // thrown up to its hip.)
  const side = (p) => (p.foot === 0 ? 1 : -1);
  const u = nrm([front.x - back.x, 0, front.z - back.z]), yaw = Math.atan2(u[0], u[2]);
  const lx = Math.cos(yaw), lz = -Math.sin(yaw);
  // the stance plants' centreline points (each plant sits 175 m to its foot's side of the line)
  const cB = [back.x - lx * 175 * side(back), back.z - lz * 175 * side(back)];
  const cF = [front.x - lx * 175 * side(front), front.z - lz * 175 * side(front)];
  const rev = [{ ...front, t: 0 }, { ...back, t: 0 }];
  let foot = front.foot, c = cB, k = 1;
  while (Math.hypot(c[0] - cF[0], c[1] - cF[1]) < far) {
    c = [c[0] - u[0] * stepLen + lz * wobble * Math.sin(k * 1.7), c[1] - u[2] * stepLen - lx * wobble * Math.sin(k * 1.7)];
    const s = foot === 0 ? 1 : -1;
    rev.push({ foot, x: c[0] + lx * 175 * s, z: c[1] + lz * 175 * s, yaw, t: 0 });
    foot = 1 - foot; k++;
  }
  // each foot starts one stride behind its first plant, already planted
  const plants = rev.reverse();
  for (let i = 0; i < plants.length; i++) plants[i].t = t0 + i * STEP_T;
  const first = [0, 1].map((f) => plants.find((p) => p.foot === f));
  const start = first.map((p) => ({ foot: p.foot, x: p.x - u[0] * stepLen * 2, z: p.z - u[2] * stepLen * 2, yaw, t: t0 - 40 }));
  return [...start, ...plants];
}

export function createGame(canvas, opts = {}) {
  const gmesh = buildGiantMesh();
  const R = createRenderer(canvas, gmesh, { width: opts.res && opts.res[0], height: opts.res && opts.res[1] });
  const uiK = () => VW / R.PW;   // picture pixels to HUD pixels
  if (!R) return null;
  const G = createGiant();
  const snd = createSound();
  // the look: palette, light, sky, post. Only the picture changes; the game is the same under every look.
  let LK = LOOKS[opts.look] || LOOKS.ashwake, lookName = LOOKS[opts.look] ? opts.look : 'ashwake';
  R.setPalette(LK.palette.greys, LK.palette.hues);
  const rnd = mulberry(4242);
  // the night: how long it searches, how far behind you it aims, how many windows stay lit (nights.js)
  // the credit shows only once it is filled in (never the placeholder); the hints and prompts know a touch screen
  const firstNight = Math.max(1, opts.night | 0 || 1), credit = opts.credit && !/____/.test(opts.credit) ? opts.credit : '', isTouch = !!opts.touch;
  let NT = night(firstNight);
  // where a sound is, left to right on screen (the play camera's right is +x -z)
  const panOf = (x, z) => { const dx = x - S.player.x, dz = z - S.player.z, d = Math.hypot(dx, dz) || 1; return (dx * 0.7071 - dz * 0.7071) / d; };
  const S = {
    t: 0, phase: 'calm', pt: 0, cycle: 0,
    player: { x: -12, z: 8, yaw: 0.8, ph: 0, run: 0, seen: 0, lit: false, tier: 'none', crouch: 0 },
    cam: { x: -12, y: 10, z: 8, yaw: Math.PI / 4, pitch: 0.84, hh: 26, D: 1500, snap: 1 },
    look: 0, view: null, intro: opts.noIntro ? null : { t: 0, cutAt: null },
    lan: { pos: [-4000, 300, -800], vel: [0, 0, 0], len: 1100, I: 1.5, on: 1 }, dim: 0,
    attn: [TOWN.x, TOWN.z], aim: [TOWN.x, TOWN.z], aimS: [TOWN.x, TOWN.z], aimT: 0, autoLook: 0, trail: [], trailT: 0, lanOff: 48, aimPh: 0, giveUp: 0, raySpread: RAY_SPREAD,
    swingPh: 0, alert: 0, alertLost: 0, dwell: 0,
    camMode: 'play', dipT: -1, dipTo: null, lookT: 0,
    plan: [], lastPlant: -1, planEnd: 0, shake: 0, windows: 0.65, prints: new Float32Array(24), nPrint: 0,
    fade: 0, flash: 0, eye: 1, input: { x: 0, y: 0, look: false }, idle: 99, auto: true, hint: 1,
    birds: [], stats: { caught: 0, passed: 0 },
    // the run: which night, whether anyone has begun (until then the town plays itself under the title),
    // the card between nights, the score (the banked tens plus fifty a night passed) and the unbanked remainder
    night: firstNight, played: false, card: null, retry: false, score: 0, nightScore: 0,
    // this night's seconds in all (the banked tens leave nightScore), the bank flash, how the eye filled
    // (in the open, in the half light, under its peer) and how far you ran with the light on you: the cause on
    // the card (all counted over the stretch that ended the night: they clear once it has lost you)
    nightSecs: 0, nightBanked: 0, bankT: 0, fillLit: 0, fillShallow: 0, fillPeer: 0, runHigh: 0, cause: '',
    // where the light last saw you, which trail sample its mark walks to next, where its peer began
    lastSeen: null, trailI: null, dwellAt: null,
    // how much chimney smoke is up, how many doors have slammed tonight, the light you are putting out,
    // when the lantern next goes to check a lit window
    smokeLevel: 1, slams: 0,
    // the townspeople out tonight, the one the light is taking, how long since it last saw you, every stain
    people: [], take: null, spawned: 0, stains: [],
  };
  // (they roost on open ground only: a bird placed inside a house rose out of its roof when the footfalls came)
  for (let i = 0; i < 26; i++) { let x = TOWN.x, z = TOWN.z; for (let k = 0; k < 20; k++) { const a = rnd() * 6.28, r = 20 + rnd() * 60; x = TOWN.x + Math.cos(a) * r; z = TOWN.z + Math.sin(a) * r; if (!blocked(x, z)) break; } S.birds.push({ x, z, y: standY(x, z) + 0.3, fly: 0, ph: rnd(), hx: 0, hz: 0, seed: rnd() }); }
  // the houses: lit, dark or taken (homes.js)
  const HM = createHomes(rnd);

  // ---------------------------------------------------------------------------------- the cycle
  function setPhase(p) {
    S.phase = p; S.pt = 0; S.giveUp = 0;
    if (p === 'search') {
      // it starts looking a little way off from you, so you have a moment
      // (night 1 keeps its breath; later nights start the light a little nearer, never so near that the
      // first word on the square is 'Seen')
      const P = S.player, a = Math.atan2(TOWN.z - P.z, TOWN.x - P.x) + (rnd() - 0.5) * 1.2, off = Math.max(32, 40 - 4 * (S.night - 1));
      S.attn = [P.x + Math.cos(a) * off, P.z + Math.sin(a) * off]; S.aim = S.attn.slice(); S.aimS = S.attn.slice(); S.aimT = 3;
      AP.t = 0; AP.goal = null;
      S.people = []; S.spawned = 0; S.take = null;
      S.alert = 0; S.alertLost = 0; S.dwell = 0; S.dwellAt = null; S.lastSeen = null; S.trailI = null;
      S.fillLit = 0; S.fillShallow = 0; S.fillPeer = 0; S.runHigh = 0; S.cause = '';
    }
    if (p === 'caught') {
      snd.caught(CATCH_CUT); S.hitDone = false; S.burnt = false; S.camMode = 'play'; S.dipT = -1; S.dipTo = null; S.aim = [S.player.x, S.player.z];
      // why: the share of the eye that filled under its peer, a long run with the light on you, the half light, the open
      const total = S.fillLit + S.fillShallow + S.fillPeer || 1;
      S.cause = S.fillPeer / total > 0.5 || (S.dwell > DWELL + 1 && S.fillPeer > 0.1 * total) ? 'You stayed too long under it.' : S.runHigh > 20 ? 'It chased you down.' : S.fillShallow > S.fillLit ? 'Caught in the half light.' : 'Caught in the open.';
    }
  }
  function startCycle() {
    S.cycle++;
    S.plan = walkPlan(S.t + 3, 1000, STANCE.back, STANCE.front, 3500, 60 + rnd() * 120);
    S.lastPlant = 1; S.planEnd = Math.max(...S.plan.map((p) => p.t));
    setPhase('calm');
    S.windows = 0.65; S.player.seen = 0; S.attn = [TOWN.x, TOWN.z]; S.aim = [TOWN.x, TOWN.z]; S.aimS = [TOWN.x, TOWN.z]; S.aimT = 0;
    S.lanReset = true;
  }
  // A night begins: you back at the start, the night's table in force. The full walk in from the valley is
  // the title's; a night starts late in the approach. The first night starts at the last footfall ('last':
  // the town already dark, the boot comes down outside the wall, 'Hide' about 13 s
  // after the click); later nights start two plants out ('late', about 20 s), with the look up at it coming.
  function startNight(n, from = 'late') {
    S.night = Math.max(1, n); NT = night(S.night);
    S.nightScore = 0; S.nightSecs = 0; S.nightBanked = 0; S.bankT = 0; S.card = null; S.retry = false;
    HM.set('calm'); S.smokeLevel = 1; S.slams = 0;
    Object.assign(S.player, { x: -12, z: 8, yaw: 0.8, seen: 0, lit: false, run: 0 });
    S.trail = []; S.camMode = 'play'; S.dipT = -1; S.dipTo = null; S.autoLook = 0; S.lookHeld = false;
    startCycle();
    if (from === 'last') {
      S.t = S.planEnd - STEP_T - 0.5; setPhase('approach'); S.pt = 17;
      // two booms' worth of windows already out, the smoke mostly gone, the sky already dim
      const b = S.plan[S.plan.length - 2];
      for (let k = 0; k < 2; k++) HM.out(Math.ceil(HM.lit().length * 0.45), [b.x, b.z]);
      S.smokeLevel = 0.25; S.windows = 0.3; S.dim = 0.9; S.slams = 1;
    } else if (from === 'late') {
      S.t = S.planEnd - 2 * STEP_T; setPhase('approach'); S.autoLook = 6.5;
    }
    updateGiant(0); stepLantern(0.016);
    Object.assign(smoothCam, playCam());
  }
  // straight to the plant of the current night, no walk in: the restart after it found you
  function enterAtPlant() {
    S.card = null; S.retry = true; S.fade = 0; S.flash = 0;
    Object.assign(S.player, { seen: 0, lit: false });
    S.trail = []; S.camMode = 'play'; S.dipT = -1; S.dipTo = null; S.autoLook = 0; S.lookHeld = false;
    startCycle();
    S.t = S.planEnd - 0.3; setPhase('approach'); pose.search = 0;
    HM.set('plant'); S.smokeLevel = 0;
    S.windows = 0.16; S.lanReset = true;
    updateGiant(0); stepLantern(0.016);
    Object.assign(smoothCam, playCam());
  }
  // the run's slate: the score, the taken houses and the stains. Cleared for a new run, and at the title cut,
  // so nothing the town did to itself under the title carries into your first night
  function resetRun() { S.score = 0; S.nightScore = 0; S.nightSecs = 0; S.nightBanked = 0; S.bankT = 0; HM.set('reset'); R.clearStains(); S.stains = []; }
  // a new run: night 1 from the plant (the walk in was the title's)
  function newRun() { resetRun(); startNight(firstNight); enterAtPlant(); S.retry = false; }
  // a night only counts, for the score and the best, once you have begun and the title has cut away
  const inRun = () => S.played && !S.intro;
  const card = (kind, lines) => ({ kind, lines, t: 0 });
  function dismissCard() {
    const c = S.card; if (!c) return;
    S.card = null;
    if (c.kind === 'night') startNight(S.night + 1, 'last');   // from the last footfall: the walk in was night 1's
    else newRun();
  }
  // the first key or click: it starts the sound, takes the town off its own autopilot for good, and cuts
  // from the title to the first night
  function begin() {
    S.played = true; S.auto = false; S.idle = 0;
    canvas.focus({ preventScroll: true });
    if (S.intro) S.intro.cutAt = S.intro.t + 0.5;
    else newRun();   // (the dev page's ?nointro: a clean run, nothing the town did to itself carries in)
  }
  // the one gesture everything waits for: the title, then the cards. 'go' is Space, Enter or a click.
  function gesture(kind) {
    snd.init();
    if (!S.played) { begin(); return true; }
    if (S.card && S.card.t > 0.6 && (kind === 'go' || S.card.kind === 'over')) { dismissCard(); return true; }
    return !!S.card;
  }
  function leavePlan() {
    const t0 = S.t + 3.0;
    // over the south side of the town, then off to the south-east: across the picture, never toward the
    // play camera, so it never walks through the camera's line of sight
    const pl = [
      { foot: 0, x: STANCE.back.x, z: STANCE.back.z, yaw: STANCE.back.yaw, t: t0 - 40 },
      { foot: 1, x: STANCE.front.x, z: STANCE.front.z, yaw: STANCE.front.yaw, t: t0 - 40 },
      // the two steps over the town lift the sole 90 m and 60 m, well over the church tower (31 m)
      { foot: 0, x: 480, z: 20, yaw: 1.95, t: t0 + SWING, lift: 90 },   // lands east of the farms, not on one
      { foot: 1, x: 1060, z: -470, yaw: 2.3, t: t0 + SWING + STEP_T, lift: 60 },
    ];
    const w = [0.62, -0.78], L = [-0.78, -0.62], mid = [710, -230];
    let foot = 0;
    for (let k = 1; k <= 8; k++) { const a = 404 + 900 * k, side = foot === 0 ? 1 : -1; pl.push({ foot, x: mid[0] + w[0] * a + L[0] * 175 * side, z: mid[1] + w[1] * a + L[1] * 175 * side, yaw: 2.47, t: t0 + SWING + STEP_T * (k + 1) }); foot = 1 - foot; }
    S.plan = pl; S.lastPlant = 1; S.planEnd = Math.max(...pl.map((q) => q.t));
  }

  // ---------------------------------------------------------------------------------- input
  // keys are read on the window, by position (e.code), so any layout works and nothing has to be focused
  const keys = new Set();
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyL: 'look', Space: 'go', Enter: 'go' };
  const typing = (e) => e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName);
  // a key that counts as 'any key': letters, digits, the arrows, Space and Enter; never Escape (it leaves
  // fullscreen), Tab, the modifiers, the function keys or the media keys
  const REAL_KEY = /^(Key|Digit|Numpad\d|Arrow|Space$|Enter$)/;
  const onKey = (e, down) => {
    if (typing(e)) return;
    if (e.code === 'KeyM') { if (down && !e.repeat) { snd.init(); snd.setMuted(!snd.muted); } return; }
    const k = KEYMAP[e.code];
    if (!k) { if (down && !e.repeat && REAL_KEY.test(e.code)) gesture('key'); return; }
    e.preventDefault();
    if (down) { if (!e.repeat && gesture(k === 'go' ? 'go' : 'key')) return; keys.add(k); } else keys.delete(k);
    S.idle = 0; if (S.played) S.auto = false;
  };
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { keys.clear(); S.lookHeld = false; });
  // one pointer walks (the mouse held where you want to go, or a finger dragged as a stick); the right
  // button, or a second finger, looks up. The look-up follows the buttons actually down, so it never sticks.
  let ptr = null, lookPtr = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    S.idle = 0; if (S.played) S.auto = false;
    if (gesture('go')) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (e.button === 2 || (ptr && e.pointerType === 'touch')) { lookPtr = e.pointerId; S.lookHeld = true; return; }
    if (ptr) return;
    ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ptr && e.pointerId === ptr.id) { ptr.x = e.clientX; ptr.y = e.clientY; }
    if (e.pointerType === 'mouse' && S.lookHeld && !(e.buttons & 2)) { S.lookHeld = false; lookPtr = null; }
  });
  const up = (e) => {
    if (e.pointerId === lookPtr || e.button === 2 || (e.pointerType === 'mouse' && !(e.buttons & 2))) { S.lookHeld = false; lookPtr = null; }
    if (ptr && e.pointerId === ptr.id) ptr = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') up(e); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // on iOS a touch's pointerdown does not count as a gesture for audio, so the context made there stays
  // suspended; the end of the same touch does count, and init() resumes a context that is not running
  canvas.addEventListener('pointerup', () => snd.init());
  canvas.addEventListener('click', () => snd.init());
  document.addEventListener('touchend', () => snd.init(), { passive: true });
  function readInput() {
    let x = 0, y = 0;
    if (keys.has('left')) x -= 1;
    if (keys.has('right')) x += 1;
    if (keys.has('up')) y += 1;
    if (keys.has('down')) y -= 1;
    if (ptr && !S.card) {
      const r = canvas.getBoundingClientRect();
      let dx, dy;
      if (ptr.touch) { dx = ptr.x - ptr.x0; dy = ptr.y - ptr.y0; const m = Math.hypot(dx, dy); if (m < 8) { dx = 0; dy = 0; } else { const k = Math.min(1, m / 40) / m; dx *= k; dy *= k; } }
      else {
        const pp = R.project([S.player.x, standY(S.player.x, S.player.z) + 1, S.player.z]);
        dx = ((ptr.x - r.left) / r.width) * R.PW - pp[0]; dy = ((ptr.y - r.top) / r.height) * R.PH - pp[1];
        const m = Math.hypot(dx, dy); if (m < 3) { dx = 0; dy = 0; } else { dx /= m; dy /= m; }
      }
      x += dx; y -= dy;
    }
    if (S.drive) { x = S.drive.x; y = S.drive.y; }   // the headless tools steer you through this
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    S.input.x = x; S.input.y = y;
    S.input.look = keys.has('look') || !!S.lookHeld || !!S.lookButton;
  }

  // ---------------------------------------------------------------------------------- the lantern
  function lanLight() {
    const L = S.lan, grip = G.W.gripR || [0, 1000, 0];
    const hang = nrm(sub(L.pos, grip)), pos = add(L.pos, scl(hang, LAN * 0.55));
    const mark = [S.aimS[0], height(S.aimS[0], S.aimS[1]) + 1, S.aimS[1]];
    const k = ease(pose.search);
    const dir = nrm(lerp3([0, -1, 0], nrm(sub(mark, pos)), k));
    const narrow = S.phase === 'caught' ? ease(S.pt / 1.2) : S.take ? ease(S.take.t / 0.9) * (1 - ease((S.take.t - 1.4) / 0.8)) : 0;
    // once it suspects you the beam tightens and brightens on the spot (the hiding test reads this too),
    // but only once its mark is nearly on you, so it never narrows itself past you
    const dm = Math.hypot(S.aimS[0] - S.player.x, S.aimS[1] - S.player.z);
    const al = ALERT_NARROW * ease(S.alert) * (1 - clamp((dm - 8) / 12));
    return { pos, dir, cosOuter: Math.cos((0.36 - narrow * 0.2) * (1 - al)), cosInner: Math.cos((0.11 - narrow * 0.07) * (1 - al)), I: L.I * (1 + narrow * 1.2 + al), on: L.on };
  }
  // How lit a point is. The lantern is 40 m of glass, so it is tested with three rays to points across it;
  // the tier is how many are blocked: 'deep' (all three, or outside the beam, or under a cover: safe), 'shallow'
  // (one or two: the edge of a shadow, where you are half seen and the eye fills slowly) or 'lit' (none).
  // L is the light that would reach the point with nothing in the way. Never reads the look.
  const DEEP = { L: 0, rays: 3, tier: 'deep' };
  function isLit(p) {
    // nothing counts until the lantern is down: while it is still descending the whole town is deep, so
    // 'Hide' and the pool arrive together and nobody is 'Seen' by a lamp 300 m in the air; and the beam's
    // far tail never counts either
    if (pose.search < 0.9 || S.lan.pos[1] - ringFloor(S.lan.pos[0], S.lan.pos[2]) > 30) return DEEP;
    if (Math.hypot(p[0] - S.aimS[0], p[2] - S.aimS[1]) > 45) return DEEP;
    const lp = lanLight();
    const d = sub(p, lp.pos), dist = len(d), ld = scl(d, 1 / dist);
    const c = dot(ld, lp.dir);
    if (c < lp.cosOuter) return DEEP;
    const cone = clamp((c - lp.cosOuter) / (lp.cosInner - lp.cosOuter));
    const L = cone * lp.I / (1 + (dist / 260) ** 2);
    if (L < 0.12) return DEEP;
    if (inCover(p[0], p[2])) return DEEP;
    // the three points across the glass: its centre and two S.raySpread apart on a line tilted a little
    const side = nrm(crs(lp.dir, [0, 1, 0])), up = crs(side, lp.dir), h = S.raySpread * 0.5, v = S.raySpread * 0.21;
    let rays = 0;
    for (const o of [[0, 0], [h, v], [-h, -v]]) if (segmentBlocked(p, add(lp.pos, add(scl(side, o[0]), scl(up, o[1]))))) rays++;
    return { L, rays, tier: rays === 3 ? 'deep' : rays > 0 || L < DIM_LIT ? 'shallow' : 'lit' };
  }
  // the lowest the ring may hang over a point: LAN_Y over the ground, or clear of any roof ridge or tower
  // top the lantern's body would pass through, the floor sloping down away from each building so the lantern
  // rises as it comes rather than jumping
  function ringFloor(x, z) {
    let f = height(x, z) + LAN_Y;
    for (const O of OCCLUDERS) {
      const d = Math.hypot(O.x - x, O.z - z) - Math.hypot(O.w, O.d) * 0.5 - RING_REACH;
      const need = O.top !== undefined ? O.top + RING_CLEAR_TOWER : O.ridge + RING_CLEAR;
      if (need <= f) continue;
      if (d <= 0) f = need; else if (need - d * RING_SLOPE > f) f = need - d * RING_SLOPE;
    }
    return f;
  }
  function stepLantern(dt) {
    const L = S.lan, grip = G.W.gripR;
    if (S.lanReset) { L.pos = add(grip, [0, -L.len, 0]); L.vel = [0, 0, 0]; S.lanReset = false; }
    // a long chain and a heavy lantern: it trails the hand, swings a little past, settles; it hangs straight
    // below the grip on the chain's length, and never lower than just over the roofs
    const n = 2, h = dt / n;
    for (let k = 0; k < n; k++) {
      const ax = (grip[0] - L.pos[0]) * 0.9 - L.vel[0] * 1.25, az = (grip[2] - L.pos[2]) * 0.9 - L.vel[2] * 1.25;
      L.vel[0] += ax * h; L.vel[2] += az * h;
      L.pos[0] += L.vel[0] * h; L.pos[2] += L.vel[2] * h;
    }
    const hd = Math.hypot(grip[0] - L.pos[0], grip[2] - L.pos[2]);
    L.pos[1] = Math.max(grip[1] - Math.sqrt(Math.max(0, L.len * L.len - hd * hd)), ringFloor(L.pos[0], L.pos[2]));
  }

  // ---------------------------------------------------------------------------------- footfalls
  function footfall(pl) {
    const P = S.player, d = Math.hypot(pl.x - P.x, pl.z - P.z);
    S.shake = Math.max(S.shake, clamp(2600 / d, 0.3, 7));
    snd.footfall(d, panOf(pl.x, pl.z));
    S.prints.set([pl.x, pl.z, -pl.yaw, pl.foot === 0 ? -1 : 1], (S.nPrint % 6) * 4); S.nPrint++;
    // the town is afraid: each boom of the approach puts out the windows nearest the boot and thins the
    // smoke; the plant puts out the last of them; close booms bang the shutters
    if (S.phase === 'approach') {
      HM.out(Math.ceil(HM.lit().length * 0.45), [pl.x, pl.z]);
      S.smokeLevel *= 0.5;
      if (d < 1600) { snd.shutters(panOf(pl.x, pl.z), S.slams < 2); S.slams++; }
    } else if (S.phase === 'plant') { HM.set('plant'); S.smokeLevel = 0; }
    const fx = Math.sin(pl.yaw), fz = Math.cos(pl.yaw);
    for (let k = 0; k < 40; k++) {
      // a ring round the sole, pushed out along the ground
      const a = (k / 40) * Math.PI * 2, u = Math.cos(a), v = Math.sin(a);
      const lx = u * (150 + rnd() * 50), lz = 100 + v * (290 + rnd() * 60);
      const cx = pl.x + fx * lz + fz * lx, cz = pl.z + fz * lz - fx * lx;
      const ox = fx * v + fz * u, oz = fz * v - fx * u;
      const vy = 5 + rnd() * 8, life = 6 + rnd() * 4, size = 80 + rnd() * 80;
      // never near you or over the town: from the play camera one of these billboards is a wall across the
      // whole picture (a disc while small, a checkerboard once big)
      if (Math.hypot(cx - P.x, cz - P.z) < PUFF_KEEP_OUT || townR(cx, cz) < 1.2) continue;
      R.puff(cx, height(cx, cz) + 12, cz, S.t, ox * 34, vy, oz * 34, life, 30, size, 0);
    }
    if (d < 1500) {
      for (let k = 0; k < 70; k++) {
        const H = houses[Math.floor(rnd() * houses.length)];
        const x = H.x + (rnd() - 0.5) * H.w, z = H.z + (rnd() - 0.5) * H.d;
        if (Math.hypot(x - P.x, z - P.z) > 90) continue;
        R.puff(x, (H.ridgeY || height(x, z) + 8) - rnd() * 4, z, S.t + rnd() * 0.3, (rnd() - 0.5) * 2, -1 - rnd() * 2, (rnd() - 0.5) * 2, 2.5 + rnd() * 2, 0.8, 3 + rnd() * 3, 0);
      }
      if (S.birds.some((b) => !b.fly)) snd.birds(0);
      for (const b of S.birds) if (!b.fly) { b.fly = 0.01; b.hx = (rnd() - 0.5) * 14; b.hz = (rnd() - 0.5) * 14; }
    }
  }
  // chimney smoke: thin grey wisps from a third of the town's chimneys, on their own random numbers so the
  // game's sequence stays what it was
  const smokers = houses.filter((H) => H.chimneyTop && townR(H.x, H.z) < 1).filter((_, i) => i % 3 === 0);
  const srnd = mulberry(77);
  function updateSmoke(dt) {
    // it comes back slowly after it has gone, house by house; none while it is here
    if (S.phase === 'calm' || (S.phase === 'leave' && S.pt > 8)) S.smokeLevel = Math.min(1, S.smokeLevel + dt / 16);
    if (S.phase === 'search' || S.phase === 'caught' || S.phase === 'plant') S.smokeLevel = 0;
    const active = Math.floor(S.smokeLevel * smokers.length + 1e-3);
    S.smokeT = (S.smokeT || 0) + dt; S.smokeN = S.smokeN || 0;
    if (!active) { S.smokeT = Math.min(S.smokeT, 0.3); return; }
    while (S.smokeT > 0.3) {
      S.smokeT -= 0.3;
      const c = smokers[S.smokeN++ % active].chimneyTop;
      R.puff(c[0] + (srnd() - 0.5) * 0.3, c[1], c[2] + (srnd() - 0.5) * 0.3, S.t, 0.3 + srnd() * 0.25, 0.5 + srnd() * 0.25, 0.1 + (srnd() - 0.5) * 0.15, 7 + srnd() * 3, 0.35, 2.4 + srnd() * 1.2, 2);
    }
  }
  function lifted(pl) {
    const d = Math.hypot(pl.x - S.player.x, pl.z - S.player.z);
    snd.lift(d, panOf(pl.x, pl.z));
    if (d > 2600) return;
    const fx = Math.sin(pl.yaw), fz = Math.cos(pl.yaw);
    for (let k = 0; k < 40; k++) {
      const u = rnd() * 400 - 110, v = (rnd() - 0.5) * 150, x = pl.x + fx * u + fz * v, z = pl.z + fz * u - fx * v;
      const y0 = height(x, z) + 20 + rnd() * 120, t0 = S.t + 0.6 + rnd() * 2.2, size = 0.5 + rnd() * 1.5;
      // never over the town or near you: from the play camera a clod falling past the lens is a circle
      if (townR(x, z) < 1.3 || Math.hypot(x - S.player.x, z - S.player.z) < 200) continue;
      R.puff(x, y0, z, t0, fx * 25, 20 + rnd() * 10, fz * 25, 9, size, 0, 1);
    }
  }

  // ---------------------------------------------------------------------------------- the giant
  const pose = { search: 0 };
  function updateGiant(dt) {
    const t = S.t;
    for (const f of [0, 1]) {
      const fa = footAt(S.plan, f, t, SWING);
      // the boot stands on the highest ground under its sole, heel to toe, so it never sinks into a slope
      const sy = Math.sin(fa.yaw), cy = Math.cos(fa.yaw);
      const gy = Math.max(height(fa.p[0], fa.p[2]), height(fa.p[0] + sy * 300, fa.p[2] + cy * 300), height(fa.p[0] - sy * 110, fa.p[2] - cy * 110));
      G.feet[f].p = [fa.p[0], gy + fa.p[1], fa.p[2]];
      G.feet[f].yaw = fa.yaw; G.feet[f].pitch = fa.pitch;
      if (fa.swing > 0 && fa.from && !fa.from.lifted) { fa.from.lifted = true; lifted(fa.from); }
    }
    for (let i = S.lastPlant + 1; i < S.plan.length; i++) { const p = S.plan[i]; if (p.t <= t) { if (p.t > t - 0.5) footfall(p); S.lastPlant = i; } else break; }
    const fL = G.feet[0], fR = G.feet[1];
    G.yaw = Math.atan2(Math.sin(fL.yaw) + Math.sin(fR.yaw), Math.cos(fL.yaw) + Math.cos(fR.yaw));
    G.x = (fL.p[0] + fR.p[0]) / 2; G.z = (fL.p[2] + fR.p[2]) / 2;
    const search = S.phase === 'search' || S.phase === 'caught' ? 1 : 0;
    pose.search += (search - pose.search) * Math.min(1, dt * 0.4);
    const k = ease(pose.search);
    // it stands tall; searching, it holds the lantern out over the town on the whole length of the chain
    G.lean = lerp(0.12, 0.2, k) + Math.sin(t * 0.21) * 0.015;
    G.headPitch = 0.3;
    G.pelvisDrop = lerp(15, 70, k);
    G.twist = Math.sin(t * (Math.PI / STEP_T)) * 0.033 * (1 - k) - 0.12 * k;
    G.roll = Math.sin(t * (Math.PI / STEP_T)) * 0.017 * (1 - k);
    G.handR = null; G.headLook = null; G.t = t;
    G.pose();
    const sh = G.W.shoulderR;
    const hang = add(sh, add(scl(G.W.left, -120), add([0, -760, 0], scl(G.W.fwd, 330))));
    // It follows you a few steps behind: it walks your trail, NT.lag samples (2 to 6 s by night) behind you,
    // always a little slower than you can walk. Seen, it comes along your path half a second behind you.
    const P = S.player, srch = S.phase === 'search' ? 1 : 0;
    if (srch) {
      // It walks your trail, sample by sample, so it goes round the corners you went round and never cuts
      // through a house; it may come as far as NT.lag samples behind you. Seen, it comes along your path
      // CHASE_LAG samples back at the hunt speed (still under yours, so a corner can lose it); half seen,
      // or just after it lost you, it goes to where it last saw you and picks the trail up from there.
      // While it takes someone it holds on them. Nothing else draws it.
      const tr = S.trail;
      const onYou = P.seen > 0.3 || P.lit, halfSeen = P.tier === 'shallow' || P.seen > 0.1;
      if (P.tier === 'shallow' || P.tier === 'lit') S.lastSeen = [P.x, P.z];
      const nearest = (p) => { let bi = 0, bd = 1e9; for (let i = 0; i < tr.length; i++) { const d = Math.hypot(tr[i][0] - p[0], tr[i][1] - p[1]); if (d < bd) { bd = d; bi = i; } } return bi; };
      let want, speed;
      if (S.take) { want = S.take.pos; speed = 6.5; S.trailI = null; }
      else if (P.lit || onYou || halfSeen) {
        // along your path while it sees you; to the last place it saw you once it does not
        const head = Math.max(0, tr.length - 1 - CHASE_LAG);
        if (P.lit && tr.length) { if (S.trailI === null) S.trailI = nearest(S.attn); const dp = Math.hypot(P.x - S.attn[0], P.z - S.attn[1]); if (dp < 12 && !segmentBlocked([S.attn[0], standY(S.attn[0], S.attn[1]) + 1.6, S.attn[1]], [P.x, standY(P.x, P.z) + 1.6, P.z])) S.trailI = head; S.trailI = Math.min(S.trailI, head); while (S.trailI < head && Math.hypot(tr[S.trailI][0] - S.attn[0], tr[S.trailI][1] - S.attn[1]) < 1.5) S.trailI++; want = tr[S.trailI]; }
        else { want = S.lastSeen || [P.x, P.z]; S.trailI = null; }
        speed = onYou ? NT.hunt : NT.walk;
      } else if (tr.length) {
        const head = Math.max(0, tr.length - 1 - NT.lag);
        if (S.trailI === null) S.trailI = nearest(S.attn);
        // (nearer than the lag allows, say where it just lost you, it waits there until the trail has grown)
        S.trailI = Math.min(S.trailI, tr.length - 1);
        while (S.trailI < head && Math.hypot(tr[S.trailI][0] - S.attn[0], tr[S.trailI][1] - S.attn[1]) < 1.5) S.trailI++;
        want = tr[S.trailI];
        // a catch-up gear: measured along the path (so a standing player pulls it no faster), a mark more than
        // 4 m of your walking behind the trail's head closes at up to 2x; running away only buys time, and
        // the light is never more than a few steps behind someone who keeps moving. Off for the first
        // seconds of a search, so night 1 keeps its breath.
        let far = Math.hypot(tr[S.trailI][0] - S.attn[0], tr[S.trailI][1] - S.attn[1]);
        for (let i = S.trailI; i < head; i++) far += Math.hypot(tr[i + 1][0] - tr[i][0], tr[i + 1][1] - tr[i][1]);
        speed = NT.walk * (1 + (S.pt > GEAR_FROM ? clamp((far - 4) / 10) : 0));
      } else { want = [P.x, P.z]; speed = NT.walk; }
      const dx = want[0] - S.attn[0], dz = want[1] - S.attn[1], dd = Math.hypot(dx, dz), stepM = Math.min(dd, speed * dt);
      if (dd > 1e-3) { S.attn[0] += (dx / dd) * stepM; S.attn[1] += (dz / dd) * stepM; }
      // the alert: it rises fast while it has you (to a third while it only half sees you), and only falls
      // once it has lost you for a couple of seconds, slowly, so the pressure releases visibly
      const aT = onYou ? 1 : halfSeen ? 0.35 : 0;
      if (aT >= S.alert) { S.alertLost = 0; S.alert += (aT - S.alert) * Math.min(1, dt * 1.5); }
      // (it lets go faster once you are properly dark than while it still half sees you)
      else { S.alertLost += dt; if (S.alertLost > ALERT_LOST) S.alert += (aT - S.alert) * Math.min(1, dt / (P.tier === 'deep' && P.seen <= 0.1 ? 1.5 : 3)); }
      // once it has lost you the cause counters start over: the card describes the stretch that ended the night
      if (S.alert < 0.3 && P.seen <= 0) { S.runHigh = 0; S.fillLit = 0; S.fillShallow = 0; S.fillPeer = 0; }
      // the light hunts a little round that point, as if looking; on a take it holds still; giving up, it
      // wanders wider and slower
      const g = ease(S.giveUp), w = (S.take ? Math.max(0, 1 - S.take.t * 2) : 1) * (1 + 1.5 * g);
      S.aimPh += dt * (1 - 0.5 * g);
      const ph = S.aimPh;
      S.aim = [S.attn[0] + (7 * Math.sin(ph * 0.9) + 3 * Math.sin(ph * 2.1)) * w, S.attn[1] + (6 * Math.cos(ph * 0.73) + 3 * Math.sin(ph * 1.7 + 1)) * w];
    }
    S.aimS[0] += (S.aim[0] - S.aimS[0]) * Math.min(1, dt * 2.2); S.aimS[1] += (S.aim[1] - S.aimS[1]) * Math.min(1, dt * 2.2);
    // the lantern is held to one side of the mark, swinging slowly round it, so the beam comes in low and
    // every house's shadow turns as it moves. How far to the side drifts over the search between the night's
    // bounds: low (long shadows, breathing room) to nearly overhead (short shadows everywhere: move now)
    // The lamp goes all the way round the mark over the search (SPIN seconds a turn, with a wobble), so no
    // wall keeps its far side dark for long; once it has you it pulls the lamp in to ALERT_OFF instead.
    const toG = Math.atan2(G.z - S.aimS[1], G.x - S.aimS[0]);
    if (S.phase === 'search') S.swingPh += dt * (Math.PI * 2) / (NT.spin || SPIN);
    const swing = toG + S.swingPh + 0.4 * Math.sin(t * 0.16) + 0.2 * Math.sin(t * 0.37 + 1.3);
    const offT = S.phase === 'search' ? S.pt : S.phase === 'caught' ? NT.search : 0;
    const cycOff = lerp(NT.offLo, NT.offHi, 0.5 + 0.5 * Math.cos((offT / OFF_PERIOD) * Math.PI * 2)) * (1 + 0.3 * ease(S.giveUp));
    S.lanOff = lerp(cycOff, ALERT_OFF, ease((S.alert - 0.35) / 0.65));
    const lanAt = [S.aimS[0] + Math.cos(swing) * S.lanOff, S.aimS[1] + Math.sin(swing) * S.lanOff];
    const sweep = [lanAt[0], 2000 + 40 * Math.sin(t * 0.13), lanAt[1]];
    let target = lerp3(hang, sweep, k);
    if (S.phase === 'caught') target = lerp3(target, [P.x + Math.cos(swing) * S.lanOff, 1960, P.z + Math.sin(swing) * S.lanOff], ease(S.pt / 3));
    G.handR = target;
    if (k > 0.01) {
      // the lantern hangs from the grip, a long way past the wrist: shift the wrist so the grip is over the mark
      G.pose();
      const g = G.W.gripR;
      G.handR = [target[0] - (g[0] - target[0]) * k, target[1], target[2] - (g[2] - target[2]) * k];
    }
    // it looks where its light falls; once it has you, at you
    const pool = [S.aimS[0], 0, S.aimS[1]];
    let look = lerp3(add(sh, scl(add(G.W.fwd, [0, -0.5, 0]), 2000)), pool, k);
    if (S.alert > 0.5) look = lerp3(look, [P.x, standY(P.x, P.z), P.z], ease((S.alert - 0.5) * 2));
    if (S.phase === 'caught') { const P = S.player; look = lerp3(look, [P.x, standY(P.x, P.z), P.z], ease(S.pt / 1.5)); }
    G.headLook = look;
    G.pose();
    // the chain is paid out until the lantern rides about LAN_Y over the ground under it (higher over a tall
    // roof or the church tower, the same floor the lantern itself keeps, so the spring never fights it);
    // giving up, it draws the lantern up by LIFT, so the pool widens and dims (the hiding test reads the real
    // position)
    const want = G.W.gripR[1] - ringFloor(S.lan.pos[0], S.lan.pos[2]) - 2 - LIFT * ease(S.giveUp);
    S.lan.len = lerp(1100, want, k);
  }

  // ---------------------------------------------------------------------------------- the player
  // under the title the town plays itself: a hider on odd cycles, the curious one on even
  const AP = { goal: null, t: 0 };
  const env = { get aimS() { return S.aimS; }, get attn() { return S.attn; }, get pt() { return S.pt; }, isLit, rnd };
  function autopilot(dt) {
    const mode = S.phase !== 'search' ? 'stroll' : S.cycle % 2 === 0 ? 'curious' : 'hider';
    return brain(S.player, AP, mode, env, dt);
  }
  function updatePlayer(dt) {
    const P = S.player;
    let ix = S.input.x, iy = S.input.y;
    if (S.auto) { const a = autopilot(dt); ix = a[0]; iy = a[1]; }
    // no walking blind under the wide boot shot, the look up, the catch or a card
    if (S.phase === 'caught' || S.camMode === 'look' || S.card || S.cam.hh > 60) { ix = 0; iy = 0; }
    const px = P.x, pz = P.z;
    walk(P, ix, iy, dt);
    if (S.phase === 'search' && S.alert > 0.8) S.runHigh += Math.hypot(P.x - px, P.z - pz);   // how far you really ran with the light on you
    let li = S.phase === 'search' ? isLit([P.x, standY(P.x, P.z) + 1.6, P.z]) : { L: 0, rays: 3, tier: 'none' };
    // no spot is safe forever: when its mark sits on your hiding place for DWELL seconds it peers in, and
    // deep shadow counts as half seen until you move away from under it
    if (S.phase === 'search') {
      // (measured from the mark's centre, not the point it loops round, so the loops do not reset it)
      // (it counts while its centre is near; moving DWELL_MOVE from where you last stood still resets it, and
      // so does its centre moving off: the way out is to leave, and the peer never follows you to the next
      // spot. A cover is one spot however long it is: under a roof nothing resets until you step out.)
      const dm = Math.hypot(S.attn[0] - P.x, S.attn[1] - P.z), cov = inCover(P.x, P.z);
      if (dm < (cov ? DWELL_R * 2 : DWELL_R)) {
        if (!S.dwellAt || P.run < 0.3) S.dwellAt = [P.x, P.z];   // (the anchor is where you last stood)
        if (!cov && Math.hypot(P.x - S.dwellAt[0], P.z - S.dwellAt[1]) > DWELL_MOVE) { S.dwell = 0; S.dwellAt = [P.x, P.z]; }
        else S.dwell += dt;
      } else if (!cov) { S.dwell = 0; S.dwellAt = null; }
      if (li.tier === 'deep' && S.dwell > DWELL) li = { L: Math.max(li.L, 0.5), rays: 2, tier: 'shallow', peer: true };
    }
    const was = P.tier;
    P.lit = li.tier === 'lit'; P.tier = li.tier;
    if (P.lit && was !== 'lit') snd.notice();
    if (S.phase === 'search') {
      // the eye: fills in the light, at the night's fraction of that in shallow shadow, empties in deep
      const rate = (0.08 + 0.17 * Math.min(1.4, li.L)) * (P.run > 0.3 ? 1.2 : 1) * NT.fill;
      // (reaching deep from a chase is felt: the eye empties twice as fast while you are still moving)
      const was_ = P.seen;
      P.seen = clamp(P.seen + (li.tier === 'lit' ? dt * rate : li.tier === 'shallow' ? dt * rate / NT.k : -dt * SHADOW_DRAIN * (P.crouch < 0.5 ? 2 : 1)));
      const gained = Math.max(0, P.seen - was_);
      if (li.peer) S.fillPeer += gained; else if (li.tier === 'lit') S.fillLit += gained; else if (li.tier === 'shallow') S.fillShallow += gained;
      if (P.seen >= 1) { setPhase('caught'); S.stats.caught++; }
    } else if (S.phase !== 'caught') P.seen = Math.max(0, P.seen - dt * 0.5);
    P.crouch += ((!P.lit && S.phase === 'search' && P.run < 0.2 ? 1 : 0) - P.crouch) * Math.min(1, dt * 4);
  }

  // ---------------------------------------------------------------------------------- the townspeople
  // Night 1: five seconds into the search the curious one steps out with a candle, walks into the square
  // and looks up. Later nights: bad hiders, out from the start. One the light holds for a moment is taken:
  // the beam narrows on them, a flash, a pop, and a stain where they stood.
  function updatePeople(dt) {
    if (S.phase !== 'search') { if (S.phase !== 'caught') S.people = S.people.filter((p) => p.state === 'out' && S.phase === 'plant'); S.take = null; return; }
    const want = NT.people, at = S.night === 1 ? 5 : 1.5;
    if (S.pt > at && S.spawned < want && (S.spawned === 0 || S.pt > at + S.spawned * 1.5)) {
      S.people.push(spawnPerson(S.night === 1 ? 'curious' : 'hider', rnd, [S.player.x, S.player.z])); S.spawned++;
    }
    for (const p of S.people) {
      if (p.state !== 'out') continue;
      const taking = S.take && S.take.p === p;
      if (!taking) { const [ix, iy] = brain(p, p.mem, p.mode, env, dt); walk(p, ix, iy, dt, 3.6); }
      else walk(p, 0, 0, dt);
      p.tier = isLit([p.x, standY(p.x, p.z) + 1.6, p.z]).tier;
      p.litT = p.tier === 'lit' ? p.litT + dt : Math.max(0, p.litT - dt * 2);
      if (!S.take && p.litT > TAKE_LIT) S.take = { p, pos: [p.x, p.z], t: 0 };
    }
    if (S.take) {
      const T = S.take, p = T.p; T.t += dt;
      if (p) T.pos = [p.x, p.z];
      // the take, seen where it happens and nowhere else: the beam has narrowed on them, they flare and come
      // apart upward through the dither over 1.2 s (the same burn as the catch), the candle dies, a stain and
      // a scorch ring stay. A dry crackle, placed and faint, only when it is near enough to be on screen.
      if (T.t >= 1.0 && !T.done) {
        T.done = true;
        if (p) {
          p.burning = true; R.stain(p.x, p.z, 1.4, rnd); S.stains.push([p.x, p.z]);
          const dp = Math.hypot(p.x - S.player.x, p.z - S.player.z);
          if (dp < 70) snd.crackle(panOf(p.x, p.z), 1 - dp / 70);
        }
      }
      if (T.t >= 2.2 && p && p.state === 'out') p.state = 'taken';
      if (T.t > 2.4) S.take = null;
    }
  }
  // ---------------------------------------------------------------------------------- the story
  function updateStory(dt) {
    S.pt += dt;
    if (S.phase === 'calm') {
      if (S.t > S.planEnd - 3 * STEP_T - 1) { setPhase('approach'); if (S.cycle > 1) S.autoLook = 6.5; }
      S.windows += (0.65 - S.windows) * Math.min(1, dt * 0.2);
      HM.relight(dt);
    } else if (S.phase === 'approach') {
      S.windows = Math.max(0.16, S.windows - dt * 0.025);
      if (S.t >= S.planEnd) setPhase('plant');
    } else if (S.phase === 'plant') {
      S.windows = Math.max(0.16, S.windows - dt * 0.2);
      if (S.pt > 3.5) setPhase('search');
    } else if (S.phase === 'search') {
      // the score: every second you last in its search, overtime at half so running late is not the best play.
      // The seconds are banked ten at a time as they tick (a chime, the plate flashes), and a catch keeps them.
      const gain = dt * (S.pt - dt > NT.search ? 0.5 : 1);
      S.nightScore += gain; S.nightSecs += dt;
      if (S.nightScore >= BANK - 1e-9) { S.nightScore -= BANK; if (inRun()) { S.score += BANK; S.nightBanked += BANK; S.bankT = 1; snd.bank(); } }
      // it takes what its light finds: the search cannot end while it has you. Past its time it keeps
      // hunting until you break its line of sight (or the eye fills), with a cap so a night never stalls.
      // In the last seconds before it can end, once it has lost you, it gives up: the lantern lifts, the
      // light widens and dims, and the label says so; finding you again brings it straight back down.
      const P = S.player, hasYou = P.lit || P.seen >= 0.2;
      const give = hasYou ? 0 : clamp((S.pt - (NT.search - GIVE_UP)) / GIVE_UP);
      S.giveUp += (give - S.giveUp) * Math.min(1, dt * 2.5);
      if ((S.pt > NT.search && !hasYou) || S.pt > NT.search + OVERTIME) { setPhase('leave'); leavePlan(); S.stats.passed++; }
    } else if (S.phase === 'caught') {
      // it found you: the run is over; the banked tens stay, the seconds since the last bank are lost
      // the burn leaves a stain where you stood (the attract loop's too; a new run clears them)
      if (S.pt > CATCH_BURN + 0.8 && !S.burnt) { S.burnt = true; const P = S.player; R.stain(P.x, P.z, 1.4, rnd); S.stains.push([P.x, P.z]); }
      if (S.pt > CATCH_LEN && !S.card) {
        if (!inRun()) startCycle();
        else {
          // what is banked stays; the seconds since the last bank are lost with the night
          const secs = Math.floor(S.nightSecs + 1e-6), bs = best.secs(S.night);   // (floored, like the bank: never a second the plate did not show)
          S.nightScore = 0; S.card = card('over', overCard(S.night, secs, bs, S.cause, S.score, best.get()));
          best.set(S.score); best.setSecs(S.night, secs);
        }
      }
    } else if (S.phase === 'leave') {
      if (S.pt > 5) HM.relight(dt);
      if (S.pt > (S.night > 1 ? LEAVE_LATER : 15) && !S.card) {
        if (!inRun()) startCycle();
        else {
          // the card counts the scored seconds (overtime at half), so its sum always matches the score
          const rem = Math.round(S.nightScore + 1e-6), secs = S.nightBanked + rem;
          S.score += rem + NIGHT_BONUS; S.nightScore = 0;
          best.set(S.score); best.setSecs(S.night, secs);
          S.card = card('night', nightCard(S.night, S.score, secs));
        }
      }
    }
    if (S.card) { S.card.t += dt; if (S.card.kind === 'night' && S.card.t > CARD_HOLD) dismissCard(); }
    S.bankT = Math.max(0, S.bankT - dt);
    const dimT = { calm: 0, approach: clamp(S.pt / 18), plant: 1, search: 1, caught: 1, leave: 1 - clamp((S.pt - 6) / 12) }[S.phase];
    S.dim += (dimT - S.dim) * Math.min(1, dt * 0.6);
    const pulse = (c, w) => clamp(1 - Math.abs(S.pt - c) / w);
    S.flash = S.phase === 'caught' ? Math.max(pulse(CATCH_BURN + 0.15, 0.2) * 0.5, pulse(CATCH_CUT, 0.1) * 0.7) : Math.max(0, S.flash - dt * 3);
    // the catch fades to black at 7.7 s; the title's attract loop fades back up to the street, a real run
    // stays black straight into the game-over card
    S.fade = S.phase === 'caught' ? (S.pt >= CATCH_CUT ? 1 : 0) : Math.max(0, S.fade - dt * 1.5);
    if (S.card && S.card.kind === 'over') S.fade = 1;
    if (S.intro) {
      // the title loops through a dip to dark; when you begin, one more dip and the cut to the first night
      const tm = S.intro.t % TITLE_LOOP;
      S.fade = Math.max(S.fade, S.intro.cutAt !== null ? clamp(1 - Math.abs(S.intro.t - S.intro.cutAt) / 0.5) : clamp(1 - Math.min(tm, TITLE_LOOP - tm) / 0.5));
    }
    S.eye = S.phase === 'caught' ? 1 + 2.5 * ease((S.pt - 4.6) / 1.6) : 1;
  }

  // ---------------------------------------------------------------------------------- camera
  function lookFrom(eye, target, fov) {
    const d = sub(eye, target), D = len(d), o = scl(d, 1 / D);
    return { x: target[0], y: target[1], z: target[2], pitch: Math.asin(o[1]), yaw: Math.atan2(o[0], o[2]), D, hh: D * Math.tan(fov / 2) };
  }
  function playCam() {
    const P = S.player, py = standY(P.x, P.z);
    const tp = S.t - S.planEnd;   // seconds since the last plant of the walk in
    const wide = (S.phase === 'approach' || S.phase === 'plant') ? ease((tp + 4.2) / 1.6) * (1 - ease((tp - 3.2) / 1.2)) : 0;
    const hh = 26 * (S.phase === 'search' ? 1.15 : 1) * (1 + wide * 5.6);
    return { x: lerp(P.x, -250, wide * 0.85), y: py + 1, z: lerp(P.z, 0, wide * 0.85), yaw: Math.PI / 4, pitch: 0.84, hh, D: 1500 };
  }
  // eye/target/fov form, for moves between the near-orthographic play camera and real ones
  function toEye(c) { const cp = Math.cos(c.pitch), off = [Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp]; return { eye: add([c.x, c.y, c.z], scl(off, c.D)), tgt: [c.x, c.y, c.z], fov: 2 * Math.atan(c.hh / c.D) }; }
  const fromEye = (e) => lookFrom(e.eye, e.tgt, e.fov);
  // Looking up: over the roofs on the far side of you from it, toward its chest, settling in slowly after the
  // cut. When it leaves: from the street, at the boot going over, then at it striding away.
  const lookAim = { p: null };
  function lookEye(dt) {
    const P = S.player, py = standY(P.x, P.z);
    if (S.phase === 'leave') {
      const f = add(G.feet[0].p, [0, 60, 100]);
      lookAim.p = lookAim.p ? lerp3(lookAim.p, f, Math.min(1, dt * 3.5)) : f;
      return { eye: [P.x + 26, py + 16, P.z + 26], tgt: lookAim.p, fov: 1.45 };
    }
    lookAim.p = null;
    const d = nrm([P.x - G.x, 0, P.z - G.z]), k = ease(S.lookT / 3), r = 270 - 30 * k;
    return { eye: [P.x + d[0] * r, py + 110 - 10 * k, P.z + d[2] * r], tgt: add(G.W.chest, [0, -150, 0]), fov: 1.3 - 0.04 * k };
  }
  // keep a real camera out of the legs and boots (it never needs to be there; this is a guard)
  function keepOut(cam) {
    const cp = Math.cos(cam.pitch), off = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp];
    const tgt = [cam.x, cam.y, cam.z], W = G.W;
    let eye = add(tgt, scl(off, cam.D)), moved = false;
    const caps = [[W.heelL, W.toeL, 150], [W.heelR, W.toeR, 150], [W.ankleL, W.kneeL, 135], [W.ankleR, W.kneeR, 135], [W.kneeL, G.pelvis, 175], [W.kneeR, G.pelvis, 175]];
    for (const [a, b, r] of caps) {
      if (!a || !b) continue;
      const ab = sub(b, a), t = clamp(dot(sub(eye, a), ab) / Math.max(1e-6, dot(ab, ab))), c = add(a, scl(ab, t)), dv = sub(eye, c), dl = len(dv);
      if (dl < r + 25) { eye = add(c, scl(dl > 1e-3 ? scl(dv, 1 / dl) : [1, 0, 0], r + 25)); moved = true; }
    }
    return moved ? { ...lookFrom(eye, tgt, 2 * Math.atan(cam.hh / cam.D)), near: cam.near, far: cam.far, snap: cam.snap } : cam;
  }
  // the catch: low behind the town, on the roofs and the light; then up the chain, the legs, the body, to the
  // face, which is looking at you; then in on it
  function tiltEye(k, push) {
    const town = [TOWN.x, standY(TOWN.x, TOWN.z), TOWN.z], away = nrm([1, 0, 0.62]);
    const eye = add(town, add(scl(away, 300 - 25 * push), [0, 45, 0]));
    const d0 = nrm(sub(add(town, [0, 4, 0]), eye)), d1 = nrm(sub(add(G.W.head, [0, 30, 0]), eye));
    const th = Math.acos(clamp(d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2], -1, 1)), sn = Math.sin(th) || 1;
    const dir = add(scl(d0, Math.sin((1 - k) * th) / sn), scl(d1, Math.sin(k * th) / sn));
    return { eye, tgt: add(eye, scl(dir, 1000)), fov: Math.exp(lerp(Math.log(0.95), Math.log(0.19), push)) };
  }
  // the face, from the street: it looks down at you
  function faceEye(push = 0) {
    // from its left side, where the arm with the chain is not in the way
    const P = S.player, py = standY(P.x, P.z), d = nrm(add(nrm([P.x - G.x, 0, P.z - G.z]), scl(G.W.left, 0.9)));
    return { eye: [P.x + d[0] * 170, py + 30, P.z + d[2] * 170], tgt: add(G.W.head, [0, -40, 0]), fov: 0.5 - 0.16 * push };
  }
  // the wide: low behind the town, which sits at the bottom; the giant over it
  function wideEye(drift = 0) {
    const town = [TOWN.x, standY(TOWN.x, TOWN.z) + 10, TOWN.z], away = nrm([1, 0, 0.62]);
    const eye = add(town, add(scl(away, 1080 - drift * 120), [0, 200 + drift * 30, 0]));
    // frame it so the town sits near the bottom edge and the crown near the top
    const dT = nrm(sub(add(town, [0, -15, 0]), eye)), dH = nrm(sub(add(G.W.head, [0, 330, 0]), eye));
    const span = Math.acos(clamp(dT[0] * dH[0] + dT[1] * dH[1] + dT[2] * dH[2], -1, 1));
    return { eye, tgt: add(eye, scl(nrm(add(dT, dH)), 1000)), fov: span / 0.86 };
  }
  // the title: low over the east end of the town, the giant far up the valley left of centre; a slow push
  function introEye(k = 0) {
    const town = [TOWN.x, standY(TOWN.x, TOWN.z), TOWN.z];
    const eye = add(town, [430 - 60 * k, 120 - 10 * k, 340 - 50 * k]), g = [G.x, 640, G.z];
    const f = nrm(sub(g, eye)), right = nrm(crs(f, [0, 1, 0]));
    return { eye, tgt: add(g, scl(right, len(sub(g, eye)) * 0.3)), fov: 0.98 - 0.06 * k };
  }
  function mixCam(a, b, t) {
    return {
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t),
      yaw: a.yaw + angDiff(a.yaw, b.yaw) * t, pitch: lerp(a.pitch, b.pitch, t),
      hh: Math.exp(lerp(Math.log(a.hh), Math.log(b.hh), t)), D: Math.exp(lerp(Math.log(a.D), Math.log(b.D), t)),
    };
  }
  const smoothCam = playCam();
  function updateCamera(dt) {
    const pc = playCam(), k = Math.min(1, dt * 3.2);
    smoothCam.x = lerp(smoothCam.x, pc.x, k); smoothCam.y = lerp(smoothCam.y, pc.y, k); smoothCam.z = lerp(smoothCam.z, pc.z, k);
    smoothCam.hh = lerp(smoothCam.hh, pc.hh, Math.min(1, dt * 2.5));
    let cam = { ...smoothCam };
    // looking up is a quick dip to dark and a cut, both ways: no long blended moves through the middle.
    // It stepping over the town at the end of a night is seen from where you stand, on the play camera:
    // no cut to a street shot. Holding L still looks up at it.
    if (S.autoLook > 0) S.autoLook -= dt;
    const want = (S.input.look || S.autoLook > 0) && S.phase !== 'caught' && !S.intro ? 'look' : 'play';
    if (S.dipT < 0 && want !== S.camMode) { S.dipT = 0; S.dipTo = want; }
    if (S.dipT >= 0) {
      S.dipT += dt;
      if (S.dipTo && S.dipT >= DIP_OUT) { S.camMode = S.dipTo; S.dipTo = null; S.lookT = 0; lookAim.p = null; }
      if (S.dipT >= DIP_OUT + DIP_IN) S.dipT = -1;
    }
    S.lookT += dt;
    if (S.camMode === 'look' && S.phase !== 'caught') cam = fromEye(lookEye(dt));
    if (S.phase === 'caught') {
      // a breath on the street; cut to the wide; cut to its face from the street
      const t = S.pt;
      // the catch stays on the street: a slow push in on you; what takes you is never shown
      cam = mixCam(smoothCam, { ...smoothCam, hh: 12 }, ease(t / 2.6));
    }
    if (S.intro && (S.intro.cutAt === null || S.intro.t < S.intro.cutAt)) cam = fromEye(introEye((S.intro.t % TITLE_LOOP) / TITLE_LOOP));
    const physical = cam.hh > 60 || S.camMode === 'look' || S.phase === 'caught' || !!S.intro;
    cam.near = physical ? 2 : undefined; cam.far = physical ? 60000 : undefined; cam.snap = physical ? 0 : 1;
    if (physical) cam = keepOut(cam);
    S.cam = S.view || cam;
  }

  function updateBirds(dt) {
    for (const b of S.birds) {
      b.ph += dt * (b.fly ? 3.2 : 0.5);
      if (!b.fly) continue;
      b.fly += dt;
      // (it comes down only over open ground; over a house it holds its height and flies on)
      b.x += b.hx * dt; b.z += b.hz * dt;
      const over = blocked(b.x, b.z);
      b.y += (b.fly < 3 ? 6 : b.fly > 12 ? (over ? 0 : -4) : 0.5) * dt;
      b.hx += Math.sin(S.t * 0.7 + b.seed * 9) * dt * 3; b.hz += Math.cos(S.t * 0.6 + b.seed * 7) * dt * 3;
      if (Math.hypot(b.x - TOWN.x, b.z - TOWN.z) > 160) { b.hx -= (b.x - TOWN.x) * dt * 0.05; b.hz -= (b.z - TOWN.z) * dt * 0.05; }
      const gy = standY(b.x, b.z);
      if (b.fly > 12 && !over && b.y <= gy + 0.3) { b.fly = 0; b.y = gy + 0.3; }
    }
  }

  // ---------------------------------------------------------------------------------- UI at 480x270
  function drawUI(ctx) {
    ctx.clearRect(0, 0, VW, VH);
    if (S.noUI) return false;
    const C = LK.ui;
    const plot = (c) => (x, y) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const plate = (x, y, w, h) => { ctx.fillStyle = C.plate; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); };
    // the three tiers of shadow in the HUD: deep is the look's cold ramp, shallow a dim amber, lit the accent
    const H = LK.palette.hues, tierCol = (t) => (t === 'lit' ? (H[3] ? H[3][4] : C.accent) : t === 'shallow' ? (H[0] ? H[0][3] : C.dim) : (H[2] ? H[2][2] : C.edge));
    const label = S.retry && (S.phase === 'approach' || S.phase === 'plant') ? 'It is still here' : { calm: 'Quiet', approach: 'It is coming', plant: 'It is here', search: S.giveUp > 0.3 ? 'It is giving up' : 'It is looking', caught: 'It sees you', leave: 'It is passing' }[S.phase];
    if (!S.intro && !S.card) {
      // the plates keep their places: the label plate is as wide as its widest word, the eye slot is always
      // there (an open eye only in the search), so nothing slides when the phase changes
      const w = measureWisp('It is still here') + 12;
      plate(8, 8, w, 15);
      drawWisp(label, 14, 12, plot(S.phase === 'search' || S.phase === 'caught' ? C.accent : C.text));
      const eye = S.phase === 'search' || (S.phase === 'caught' && S.pt < 3);
      const x0 = 8 + w + 6, o = eye ? S.player.seen : 0;
      plate(x0, 8, 30, 15);
      for (let x = -9; x <= 9; x++) {
        const hg = Math.round(Math.sqrt(Math.max(0, 1 - (x / 9.5) ** 2)) * (1.6 + 3.4 * o));
        ctx.fillStyle = C.dim; ctx.fillRect(x0 + 15 + x, 15 - hg, 1, 1); ctx.fillRect(x0 + 15 + x, 15 + hg, 1, 1);
        if (hg > 1 && eye) { ctx.fillStyle = tierCol(S.player.tier); ctx.fillRect(x0 + 15 + x, 15 - hg + 1, 1, hg * 2 - 1); }
      }
      // the pupil: always a dot, growing as it sees you
      const ps = 1 + Math.round(2 * o); ctx.fillStyle = eye ? LK.palette.greys[0] : C.dim; ctx.fillRect(x0 + 15 - (ps >> 1), 15 - (ps >> 1), ps, ps);
      // (the plate shows what is banked and would stay on a catch; each ten lands with a flash and the chime)
      const nl = 'Night ' + S.night + '   Score ' + S.score, nw = measureWisp(nl) + 12, nx = x0 + 36;
      plate(nx, 8, nw, 15);
      drawWisp(nl, nx + 6, 12, plot(S.bankT > 0.5 ? C.accent : C.dim));
    }
    // over your head in the search: the word for your shadow and the eye filling in its colour, so what the
    // light sees is never a guess
    if (TELL_WORDS && S.phase === 'search' && !S.card && S.player.tier !== 'none') {
      const P = S.player, tier = P.tier, hp = R.project([P.x, standY(P.x, P.z) + 3.4, P.z]).map((v, i) => (i < 2 ? v * uiK() : v));   // over the helm (3 m), in HUD pixels
      if (hp[2]) {
        const word = tier === 'lit' ? 'Seen' : tier === 'shallow' ? 'Half seen' : 'Hidden', col = tierCol(tier);
        const ww = measureWisp(word), x = Math.round(hp[0] - ww / 2), y = Math.round(hp[1]) - 16;
        ctx.globalAlpha = tier === 'shallow' ? 0.85 + 0.15 * Math.sin(S.t * 7) : 1;   // a pulse, never a blink
        ctx.fillStyle = C.plate; ctx.fillRect(x - 2, y - 2, ww + 4, 11);
        drawWisp(word, x, y, plot(col));
        ctx.globalAlpha = 1;
        const bx = Math.round(hp[0]) - 8, by = y + 11;
        plate(bx, by, 17, 5); ctx.fillStyle = col; ctx.fillRect(bx + 1, by + 1, Math.round(15 * clamp(P.seen)), 3);
      }
    }
    if (S.hint > 0.01 && !S.intro && !S.card && S.phase !== 'caught') {
      ctx.globalAlpha = Math.min(1, S.hint);
      const h1 = isTouch ? 'Drag: move' : 'WASD or drag: move', h2 = isTouch ? 'Hold the button: look up' : 'Hold L or right-click: look up';
      plate(8, VH - 30, Math.max(measureWisp(h1), measureWisp(h2)) + 12, 25);
      drawWisp(h1, 14, VH - 26, plot(C.dim)); drawWisp(h2, 14, VH - 16, plot(C.dim));
      ctx.globalAlpha = 1;
    }
    if (S.intro) {
      // the title: the name, the line, the rule, and the prompt that waits for you
      const c = S.intro.cutAt;
      ctx.globalAlpha = Math.min(1, S.intro.t / 1.2) * (c === null ? 1 : 1 - ease((S.intro.t - c + 0.9) / 0.8));
      // every line is drawn over its own shadow, so it reads on the pale sky
      const shadowed = (text, x, y, col, sc = 1) => { drawWisp(text, x + 1, y + 1, plot(LK.palette.greys[0]), sc); drawWisp(text, x, y, plot(col), sc); };
      const T = 'UNDERFOOT', w = measureWisp(T, 3);
      const cx = Math.round(VW * 0.69);
      shadowed(T, cx - Math.round(w / 2), 58, C.title, 3);
      const s2 = 'Something is walking the valley.';
      shadowed(s2, cx - Math.round(measureWisp(s2) / 2), 86, C.sub);
      shadowed(RULE, cx - Math.round(measureWisp(RULE) / 2), 102, C.sub);
      const s3 = 'Stay in the dark.';
      shadowed(s3, cx - Math.round(measureWisp(s3) / 2), 112, C.sub);
      if (credit) shadowed(credit, cx - Math.round(measureWisp(credit) / 2), 132, C.sub);
      if (!S.played) {
        const p = isTouch ? 'tap to begin' : 'click or press any key';
        ctx.globalAlpha *= 0.55 + 0.45 * Math.sin(S.intro.t * 2.2);
        shadowed(p, cx - Math.round(measureWisp(p) / 2), VH - 30, C.sub);
      }
      ctx.globalAlpha = 1;
    }
    if (S.card) {
      // a card between nights: the first line large, the rest under it, and what to press
      const L = S.card.lines, k = S.card.kind;
      ctx.globalAlpha = Math.min(1, S.card.t / 0.6);
      const ws = L.map((l, i) => measureWisp(l, i === 0 ? 2 : 1)), w = Math.max(...ws) + 28, h = 24 + 10 * (L.length - 1) + 22;
      const x0 = Math.round((VW - w) / 2), y0 = Math.round((VH - h) / 2) - 6;
      plate(x0, y0, w, h);
      let y = y0 + 8;
      L.forEach((l, i) => { const sc = i === 0 ? 2 : 1; drawWisp(l, Math.round((VW - ws[i]) / 2), y, plot(i === 0 ? (k === 'over' ? C.accent : C.text) : C.dim), sc); y += sc === 2 ? 16 : 10; });
      const p = k === 'night' ? (isTouch ? 'tap: next night' : 'click or Space: next night') : (isTouch ? 'tap: again' : 'click or any key: again');
      if (S.card.t > 0.6) { ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(S.card.t * 2.2); drawWisp(p, Math.round((VW - measureWisp(p)) / 2), y + 4, plot(C.dim)); }
      if (k === 'over' && credit) drawWisp(credit, Math.round((VW - measureWisp(credit)) / 2), VH - 18, plot(C.dim));
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'caught' && S.pt > 1.0 && S.pt < CATCH_CUT) {
      ctx.globalAlpha = ease((S.pt - 1.0) / 0.6) * (1 - ease((S.pt - CATCH_BURN - 0.6) / 0.6));
      const T = 'it sees you';
      drawWisp(T, Math.round((VW - measureWisp(T, 2)) / 2), VH - 40, plot(C.accent), 2);
      ctx.globalAlpha = 1;
    }
    return true;
  }

  // where the lantern's glass is, how big it is on screen (pixels), and the depths just in front of and
  // behind it. The halo is only hidden by things nearer than its front, so the cage never dims it.
  function lanScreen() {
    const up_ = nrm(sub(G.W.gripR, S.lan.pos)), c = add(S.lan.pos, scl(up_, -LAN * 0.55));
    const cp = R.project(c);
    if (!cp[4]) return null;
    const toC = nrm(sub(c, R.view.eye));
    const a = R.project(add(c, scl(up_, LAN * 0.5))), b = R.project(add(c, scl(up_, -LAN * 0.4)));
    const size = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const zNear = R.project(sub(c, scl(toC, LAN * 0.7)))[3], zFar = R.project(add(c, scl(toC, LAN * 0.7)))[3];
    const bp = R.project(add(c, scl(lanLight().dir, 300)));
    const beam = nrm([bp[0] - cp[0], -(bp[1] - cp[1]), 0]);
    const onScreen = cp[0] > -size && cp[0] < R.PW + size && cp[1] > -size && cp[1] < R.PH + size;
    return { x: cp[0], y: cp[1], size, zNear, zFar, beam, onScreen };
  }
  // screen glows: the lantern in the air (a wide warm halo and a hot core), the eyes when they burn
  function glows() {
    const out = [];
    const ls = lanScreen();
    if (ls && ls.onScreen && S.lan.on > 0) {
      out.push([ls.x, ls.y, ls.zNear, Math.max(8, ls.size * 1.4), 0.22, 1]);
      out.push([ls.x, ls.y, ls.zNear, Math.max(4, ls.size * 0.5), 0.12, 1]);
    }
    for (const p of S.people) if (p.state === 'out') { const cp = R.project([p.x + Math.sin(p.yaw) * 0.4, standY(p.x, p.z) + 1.0, p.z + Math.cos(p.yaw) * 0.4]); if (cp[2] && out.length < 4) out.push([cp[0], cp[1], cp[3], 2.2, 0.35, 1]); }
    // the catch: you flare before you come apart, a glow over the knight that swells and goes out; a take
    // flares the same way over whoever the light has
    if (S.phase === 'caught' && S.pt > 1.2) {
      const P = S.player, fl = ease((S.pt - 1.2) / 1.2) * (1 - ease((S.pt - CATCH_BURN - 0.6) / 1.2));
      const kp = R.project([P.x, standY(P.x, P.z) + 1.4, P.z]);
      if (kp[2] && fl > 0.01) out.unshift([kp[0], kp[1], kp[3], 3 + 7 * fl, 1.4 * fl, 1]);
    } else if (S.take && S.take.p && S.take.t > 0.3) {
      const p = S.take.p, fl = ease((S.take.t - 0.3) / 0.7) * (1 - ease((S.take.t - 1.6) / 0.8));
      const kp = R.project([p.x, standY(p.x, p.z) + 1.2, p.z]);
      if (kp[2] && fl > 0.01) out.unshift([kp[0], kp[1], kp[3], 3 + 6 * fl, 1.2 * fl, 1]);
    }
    if (G.W.eyes) for (const e of G.W.eyes) { const ep = R.project(e); if (ep[2]) out.push([ep[0], ep[1], ep[3], 1.5 + 0.8 * S.player.seen + 1.4 * (S.eye - 1), 0.15 + 0.35 * S.player.seen + 0.14 * (S.eye - 1), 2]); }
    return out;
  }
  // ---------------------------------------------------------------------------------- frame
  function update(dt) {
    S.t += dt;
    readInput();
    if (Math.hypot(S.input.x, S.input.y) > 0.05 || S.input.look) { S.idle = 0; if (S.played) S.auto = false; } else { S.idle += dt; if (S.idle > 8 && !S.played) S.auto = true; }
    if (S.intro) {
      S.intro.t += dt;
      const c = S.intro.cutAt;
      if (c !== null && S.intro.t >= c && !S.intro.cut) { S.intro.cut = true; resetRun(); startNight(firstNight, 'last'); }
      if (c !== null && S.intro.t > c + 0.5) S.intro = null;
    }
    // the controls hint stays up until a dozen seconds into the first search, when it has done its work
    if (!S.intro && S.played) S.hint = Math.max(0, S.hint - dt * (S.phase === 'search' && S.pt > 12 ? 0.15 : 0));
    S.inputT = Math.hypot(S.input.x, S.input.y) > 0.05 ? (S.inputT || 0) + dt : 0;
    S.trailT += dt;
    if (S.trailT >= 0.25) { S.trailT = 0; S.trail.push([S.player.x, S.player.z]); if (S.trail.length > 40) { S.trail.shift(); if (S.trailI !== null) S.trailI = Math.max(0, S.trailI - 1); } }
    updateStory(dt);
    updateSmoke(dt);
    updateGiant(dt);
    stepLantern(dt);
    updatePlayer(dt);
    updatePeople(dt);
    updateBirds(dt);
    updateCamera(dt);
    S.shake = Math.max(0, S.shake - dt * (S.shake * 1.8 + 0.2));
    // sound
    if (S.phase === 'caught' && S.pt > CATCH_CUT - 0.05 && !S.hitDone) { S.hitDone = true; snd.hit(); }
    const Pp = S.player, lp = S.lan.pos, dl = Math.hypot(lp[0] - Pp.x, lp[1] - standY(Pp.x, Pp.z), lp[2] - Pp.z);
    const tension = { search: 1 - 0.5 * S.giveUp, caught: S.pt < 6.5 ? 1 : 0, plant: 0.7, approach: 0.25, leave: 1 - clamp(S.pt / 8), calm: 0 }[S.phase];
    snd.update(dt, { wind: 0.25 + 0.7 * S.dim, roar: clamp(1 - (dl - 50) / 380), tension: clamp(tension + 0.5 * S.alert), chain: clamp(1 - dl / 700), move: clamp(Math.hypot(S.lan.vel[0], S.lan.vel[2]) / 10 + S.alert), lanPan: panOf(lp[0], lp[2]), tick: Pp.tier === 'shallow' ? clamp(Pp.seen) : 0 });
  }
  function dimmed(k) {
    const L = LK.light, D = LK.dimK, f = (c, a) => c.map((v) => v * (1 - k * a));
    // overcast: the sun goes, the sky light stays mostly from above, the bounce off the ground falls
    return { ...L, sunCol: f(L.sunCol, D.sun), skyCol: f(L.skyCol, D.sky), gndCol: f(L.gndCol, D.gnd), fogCol: f(L.fogCol, D.fog), fogSunCol: f(L.fogSunCol, D.fogSun), exposure: L.exposure * (1 + D.exp * k) };
  }
  function render() {
    const A = R.dyn; A.reset();
    const grip = G.W.gripR, up_ = nrm(sub(grip, S.lan.pos));
    chain(A, add(S.lan.pos, scl(up_, 4)), grip, 20, 4.2);
    lantern(A, S.lan.pos, up_, LAN, S.t);
    millSails(A, S.t);
    const P = S.player, py = standY(P.x, P.z);
    // you: the figure, a pale ring on the ground under your feet (stronger when you crouch in the dark), and
    // an inverted hull just over a pixel wide in the darkest grey, so the figure reads on any ground
    const ring = (P.tier === 'none' ? 0.45 : 0.7) + 0.3 * P.crouch;
    person(A, P.x, py, P.z, P.yaw, P.ph, P.run, { crouch: P.crouch, ring, knight: true });
    // the ring's colour and arc: blue in deep shadow; dim amber, pulsing, closing as the eye fills, in shallow;
    // bright amber when the light has you; the plain pale ring outside the search
    const lc = LK.light.lanCol, tier = P.tier, pulse = 0.75 + 0.25 * Math.sin(S.t * (6 + 10 * P.seen));
    const ringU = tier === 'lit' ? [lc[0] * 0.9, lc[1] * 0.9, lc[2] * 0.9, 1]
      : tier === 'shallow' ? [lc[0] * 0.4 * pulse, lc[1] * 0.4 * pulse, lc[2] * 0.4 * pulse, Math.max(0.08, 1 - P.seen)]
      : tier === 'deep' ? [0.12, 0.22, 0.55, 1] : [0.3, 0.3, 0.32, 1];
    // the townspeople: pale coats, bare heads, a candle in the hand; then every figure's outline hull
    const out = S.people.filter((p) => p.state === 'out'), candles = new Float32Array(16);
    out.forEach((p, i) => {
      const yy = standY(p.x, p.z);
      person(A, p.x, yy, p.z, p.yaw, p.ph, p.run, { cloak: M.P_LIGHT, hood: false, scarf: false, candle: true });
      if (i < 4) candles.set([p.x + Math.sin(p.yaw) * 0.4, yy + 1.0, p.z + Math.cos(p.yaw) * 0.4, 0.5], i * 4);
    });
    const inflate = clamp((2 * S.cam.hh / R.PH) * 1.1, 0.05, 0.5);   // never thinner than a pixel's worth at play zoom
    // the beam in the air, from the glass to the pool (drawn after the solid things, never into a shadow map)
    A.beam();
    if (S.lan.on > 0) beam(A, lanLight(), LAN, height);
    A.hull();
    person(A, P.x, py, P.z, P.yaw, P.ph, P.run, { crouch: P.crouch, inflate, mat: M.P_OUTLINE, knight: true });
    for (const p of out) person(A, p.x, standY(p.x, p.z), p.z, p.yaw, p.ph, p.run, { hood: false, scarf: false, inflate, mat: M.P_OUTLINE });
    const sh = S.phase === 'caught' ? 0 : S.shake;
    const ll = lanLight(), ls = lanScreen();
    // the screen's edges pulse while the light has you: amber half seen, red seen, stronger as the eye fills
    const lcol = LK.light.lanCol, ep = 0.7 + 0.3 * Math.sin(S.t * 6);
    const edge = TELL_EDGE && S.phase === 'search' && !S.card && (P.tier === 'lit' || P.tier === 'shallow')
      ? (P.tier === 'lit' ? [0.75, 0.12, 0.06, (0.28 + 0.4 * P.seen) * ep] : [lcol[0] * 0.8, lcol[1] * 0.6, lcol[2] * 0.3, (0.16 + 0.3 * P.seen) * ep])
      : [0, 0, 0, 0];
    HM.sync();
    // the drawn light grows as the lamp comes down to the streets, like the hiding test's gate (which counts
    // nothing until the lamp is within 30 m of its floor): the town is no longer flooded amber under 'Hidden'
    const hAbove = S.lan.pos[1] - ringFloor(S.lan.pos[0], S.lan.pos[2]), down = 0.25 + 0.75 * ease(clamp(1 - (hAbove - 30) / 120));
    // looking up, the air is thicker and the sky darker: the body goes into the murk and the lantern, the
    // chain and the eyes are what you see (a colossus seen whole is a model; half seen it is a thing)
    const Ld = dimmed(S.dim), light = S.camMode === 'look' ? { ...Ld, fogA: Ld.fogA * 3, fogB: Ld.fogB * 0.5, skyCol: scl(Ld.skyCol, 0.4), fogSunCol: scl(Ld.fogSunCol, 0.35), fogCol: scl(Ld.fogCol, 0.7) } : Ld;
    R.render({
      t: S.t, cam: S.cam, light,
      giant: { bones: G.bones, sway: G.sway },
      lantern: { ...ll, I: ll.I * LK.lanI / 1.5 * (1 - 0.4 * ease(S.giveUp)) * down }, lanGlow: LK.light.lanCol,   // giving up, the drawn light fades as it lifts
      lanShaft: ls && S.lan.on > 0 ? { ...ls, strength: (LK.lanShaft ?? 1) * LK.lanI / 1.5 } : null,
      glows,
      windows: Math.max(LK.winMin, S.windows), houses: HM.bytes, ring: ringU, candles, prints: S.prints, streetAlb: LK.streetAlb, winPool: LK.winPool, player: LK.player ? [...LK.player.armour, ...LK.player.cape, 0, 0, 0, LK.player.fill || 0, P.tier === 'deep' ? P.crouch : 0, 0] : null,
      cloudK: S.cam.hh > 120 ? Math.min(1, (S.cam.hh - 120) / 400) : 0, holeC: [-300, 0], cloudCov: LK.cloudCov,
      cut: S.cam.hh < 60 ? [P.x, standY(P.x, P.z) + 1.2, P.z] : null,
      gCentre: [lerp(G.x, TOWN.x, 0.5), 0, lerp(G.z, TOWN.z, 0.5)],
      tilt: clamp(1 - (S.cam.hh - 40) / 60) * LK.tilt, focus: 0.5, grain: LK.grain, vignette: LK.vignette, edge,
      // the beam in the air is faint from the play camera, which looks down through it, and full from the
      // wide and cinematic cameras, which see it from the side
      beamK: S.cam.snap === 0 ? 1 : clamp((S.cam.hh - 40) / 40), raySpread: S.raySpread,
      shake: [Math.sin(S.t * 63) * sh, Math.cos(S.t * 71) * sh * 0.7],
      fade: Math.max(S.fade, S.dipT < 0 ? 0 : S.dipT < DIP_OUT ? S.dipT / DIP_OUT : 1 - (S.dipT - DIP_OUT) / DIP_IN), flash: S.flash * 0.85, eye: S.eye, seen: S.player.seen,
      birds: S.birds.map((b) => [b.x, b.y + 0.4, b.z, b.fly ? b.ph : 0.25]),
      ash: S.cam.hh < 60 ? LK.ash.amount : 0, ashLum: LK.ash.lum, ashFall: S.phase === 'caught' && S.pt > 1.2 ? -LK.ash.fall * 1.6 : LK.ash.fall,
      burn: S.phase === 'caught' ? [P.x, P.z, 2.4, clamp((S.pt - CATCH_BURN) / 1.2)] : S.take && S.take.p && S.take.t >= 1.0 ? [S.take.p.x, S.take.p.z, 2.4, clamp((S.take.t - 1.0) / 1.2)] : null,
      chromaLo: LK.chroma[0], chromaHi: LK.chroma[1], contrast: LK.contrast, lift: LK.lift || 0, gamma: LK.gamma || 1, dither: LK.dither, bloom: LK.bloom,
      stars: LK.stars, sunSize: LK.sunSize, sunDisc: LK.sunDisc, snow: LK.snow,
      ui: drawUI,
    });
  }

  startCycle();
  updateGiant(0);

  const api = {
    R, G, S, gmesh, snd, LOOKS, LOOK_ORDER, NIGHTS, nightTable: night, isLit, inCover, blocked, standY, height, lanLight, segmentBlocked, OCCLUDERS, houses, brain, HM, ringFloor, CHURCH, LAN_BODY,
    setPicture: (w, h) => R.setPicture(w, h),
    get look() { return lookName; },
    get night() { return S.night; },
    begin, startNight, newRun, dismissCard,
    setLook(name) { if (!LOOKS[name]) return; LK = LOOKS[name]; lookName = name; R.setPalette(LK.palette.greys, LK.palette.hues); },
    frame(dt) { update(dt); render(); },
    update, render, lookFrom,
    // jump to a moment (for tests and the page's buttons)
    force(name) {
      S.intro = null; S.view = null; S.card = null; S.retry = false;
      S.camMode = 'play'; S.dipT = -1; S.dipTo = null; S.autoLook = 0; S.trail = [];
      startCycle(); HM.set('calm'); S.smokeLevel = 1; S.slams = 0;
      if (name === 'approach') { S.t = S.planEnd - 3 * STEP_T + 1; setPhase('approach'); }
      if (name === 'plant') { S.t = S.planEnd - 0.3; setPhase('approach'); }
      if (name === 'search' || name === 'caught' || name === 'leave') { S.t = S.planEnd + 4; S.lastPlant = S.plan.length - 1; HM.set('plant'); S.smokeLevel = 0; setPhase('search'); pose.search = 1; }
      if (name === 'caught') setPhase('caught');
      if (name === 'leave') { setPhase('leave'); leavePlan(); }
      S.lanReset = true;
      updateGiant(0); stepLantern(0.016);
      Object.assign(smoothCam, playCam());
    },
    // fixed cameras for checking the look
    view(name) {
      G.pose();
      const v = {
        town: { x: 0, y: 8, z: 0, yaw: Math.PI / 4, pitch: 0.84, hh: 70, D: 2500 },
        foot: { x: -160, y: 10, z: 0, yaw: Math.PI / 4, pitch: 0.84, hh: 90, D: 2500 },
        foot2: { x: -330, y: 30, z: 30, yaw: Math.PI / 4, pitch: 0.84, hh: 150, D: 3000, near: 400, far: 30000, snap: 0 },
        foot3: { ...lookFrom([-120, 40, 160], [-380, 60, 30], 1.0), near: 2, far: 60000, snap: 0 },
        up: { ...lookFrom([-30, 22, 25], add(G.W.head, [0, -500, 0]), 1.45), near: 2, far: 60000, snap: 0 },
        up3: { ...lookFrom([120, 25, 160], add(G.W.chest, [0, -300, 0]), 1.2), near: 2, far: 60000, snap: 0 },
        w1: { ...lookFrom(add(lerp3([0, 0, 0], G.W.head, 0.55), scl(nrm([1, 0.12, 0.55]), 3600)), lerp3([0, 0, 0], G.W.head, 0.55), 1.0), near: 2, far: 60000, snap: 0 },
        w2: { ...lookFrom(add(lerp3([0, 0, 0], G.W.head, 0.5), scl(nrm([1, 0.25, 0.8]), 4200)), lerp3([0, 0, 0], G.W.head, 0.5), 0.95), near: 2, far: 60000, snap: 0 },
        w3: { ...lookFrom(add(lerp3([0, 0, 0], G.W.head, 0.6), scl(nrm([1, 0.05, 0.25]), 3000)), lerp3([0, 0, 0], G.W.head, 0.6), 1.05), near: 2, far: 60000, snap: 0 },
        face: { ...lookFrom(faceEye().eye, faceEye().tgt, faceEye().fov), near: 2, far: 60000, snap: 0 },
        wide: { ...lookFrom(wideEye().eye, wideEye().tgt, wideEye().fov), near: 2, far: 60000, snap: 0 },
        intro: { ...lookFrom(introEye().eye, introEye().tgt, introEye().fov), near: 2, far: 60000, snap: 0 },
        look: { ...lookFrom(lookEye(0).eye, lookEye(0).tgt, lookEye(0).fov), near: 2, far: 60000, snap: 0 },
        st1: { ...lookFrom(add(G.W.chest, [3800, -700, 2400]), add(G.W.chest, [0, -500, 0]), 0.9), near: 2, far: 60000, snap: 0 },
        st2: { ...lookFrom(add(G.W.chest, [1500, 300, -3800]), add(G.W.chest, [0, -500, 0]), 0.9), near: 2, far: 60000, snap: 0 },
        st3: { ...lookFrom(add(G.W.chest, [-3200, -200, 2500]), add(G.W.chest, [0, -500, 0]), 0.9), near: 2, far: 60000, snap: 0 },
        hero: { x: -650, y: 1450, z: -120, yaw: Math.PI / 2 + 0.3, pitch: -0.12, hh: 1900, D: 3900, near: 20, far: 60000, snap: 0 },
        hero2: { x: -700, y: 1400, z: -120, yaw: Math.PI / 2 + 0.55, pitch: 0.18, hh: 2400, D: 7800, near: 30, far: 60000, snap: 0 },
        valley: { x: -1000, y: 600, z: 0, yaw: Math.PI / 4, pitch: 0.6, hh: 4200, D: 9000, near: 50, far: 60000, snap: 0 },
      }[name];
      S.view = v || null;
    },
  };
  return api;
}
