// UNDERFOOT — sound, all synthesized with WebAudio (no files). Wind always. Each footfall is a long low boom
// that arrives late when the foot is far off, because sound takes seconds to cross a valley. Close by, the
// boom comes with a crack and the rattle of roofs. While it searches, the chain clinks, the lantern roars
// when it is near, and a low drone holds under everything. When it finds you, a slow horn swells.
// The context starts on the first key or tap (browsers require a gesture).

export function createSound() {
  let ctx = null, master = null, white = null, brown = null;
  let wind = null, whistle = null, roar = null, drone = null;
  const S = { muted: false, clinkT: 0, tickT: 0 };

  function makeNoise(seconds, brownian) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brownian) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function loop(buf, filters, gain) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    let n = s; for (const f of filters) { n.connect(f); n = f; }
    const g = ctx.createGain(); g.gain.value = gain; n.connect(g); g.connect(master); s.start(0, Math.random() * 2);
    return g;
  }
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = S.muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    white = makeNoise(3, false); brown = makeNoise(4, true);
    // wind: noise through a low-pass that wanders, and a thin whistle over it
    const wl = filt('lowpass', 380);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(wl.frequency); lfo.start();
    wind = loop(white, [wl], 0.05);
    const wb = filt('bandpass', 1150, 9);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.043; const lg2 = ctx.createGain(); lg2.gain.value = 260; lfo2.connect(lg2); lg2.connect(wb.frequency); lfo2.start();
    whistle = loop(white, [wb], 0.0);
    // the lantern: a low roar of fire
    roar = loop(brown, [filt('lowpass', 420), filt('peaking', 140, 1)], 0.0);
    // the drone under the search: two low tones a fifth apart, a little out of tune, breathing
    drone = ctx.createGain(); drone.gain.value = 0;
    const dl = filt('lowpass', 360);
    for (const [f, det] of [[73.4, -6], [110, 5], [55, 3]]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det; const g = ctx.createGain(); g.gain.value = f === 55 ? 0.5 : 0.35; o.connect(g); g.connect(dl); o.start(); }
    const trem = ctx.createOscillator(); trem.frequency.value = 0.11; const tg = ctx.createGain(); tg.gain.value = 0.35; trem.connect(tg);
    const dg = ctx.createGain(); dg.gain.value = 0.65; tg.connect(dg.gain); trem.start();
    dl.connect(dg); dg.connect(drone); drone.connect(master);
  }

  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function out(pan, lp) {
    const g = ctx.createGain();
    let n = g;
    if (lp) { const f = filt('lowpass', lp); n.connect(f); n = f; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); n.connect(p); n = p; }
    n.connect(master);
    return g;
  }
  function osc(type, f, f1, t, a, dur, peak, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.1);
    return o;
  }
  function burst(buf, t, a, dur, peak, dest, type, f, q = 0.8, f1 = null) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const fl = filt(type, f, q); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.1);
  }

  const api = {
    get on() { return !!ctx && !S.muted; },
    get muted() { return S.muted; },
    init,
    setMuted(m) { S.muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, now(), 0.05); },
    // a foot comes down `d` metres away
    footfall(d, pan) {
      if (!ctx) return;
      const t = now() + Math.min(5, d / 343), k = 1 / (1 + d / 1100), lp = 160 + 2600 / (1 + d / 260);
      const o = out(pan * 0.6, lp);
      osc('sine', 46, 24, t, 0.03, 3.2, 0.9 * k, o);
      osc('sine', 70, 34, t, 0.02, 1.2, 0.35 * k, o);
      burst(brown, t, 0.06, 4.5, 1.1 * k, o, 'lowpass', 240, 0.7, 70);
      if (d < 1600) {
        // close: the crack of it, then the town rattling
        burst(white, t, 0.005, 0.5, 0.5 * k, o, 'lowpass', 1400, 0.7, 300);
        for (let i = 0; i < 9; i++) burst(white, t + 0.15 + Math.random() * 1.6, 0.004, 0.12 + Math.random() * 0.2, 0.06 + Math.random() * 0.08, o, 'bandpass', 500 + Math.random() * 2400, 2.5);
      }
    },
    // a foot leaves the ground: iron groaning, earth falling off it
    lift(d, pan) {
      if (!ctx || d > 3000) return;
      const t = now() + Math.min(5, d / 343), k = 1 / (1 + d / 900), o = out(pan * 0.6, 900);
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(36, t); s.frequency.linearRampToValueAtTime(29, t + 2.6);
      const v = ctx.createOscillator(); v.frequency.value = 3.1; const vg = ctx.createGain(); vg.gain.value = 2.5; v.connect(vg); vg.connect(s.frequency);
      const bp = filt('bandpass', 170, 4); const g = ctx.createGain(); env(g, t, 0.6, 0.45 * k, 2.2);
      s.connect(bp); bp.connect(g); g.connect(o); s.start(t); v.start(t); s.stop(t + 3); v.stop(t + 3);
      burst(white, t + 0.8, 0.4, 2.8, 0.12 * k, o, 'lowpass', 700, 0.7, 250);
    },
    // the light has found you: a short rising note, dry
    notice() {
      if (!ctx) return;
      const t = now(), o = out(0, 2600);
      osc('triangle', 440, 1180, t, 0.03, 0.42, 0.14, o);
      osc('sine', 220, 590, t, 0.03, 0.42, 0.08, o);
    },
    // the town bolts itself in: a few wooden bangs round you, and now and then a door slammed
    shutters(pan, slam) {
      if (!ctx) return;
      const t = now(), o = out(pan * 0.5, 2400), n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const tt = t + 0.15 + Math.random() * 1.6, f = 260 + Math.random() * 520;
        burst(white, tt, 0.003, 0.04 + Math.random() * 0.05, 0.14, o, 'bandpass', f, 3);
        osc('sine', 160 + Math.random() * 110, 80, tt, 0.004, 0.08, 0.1, o);
      }
      if (slam) { const ts = t + 0.6 + Math.random() * 0.9; osc('sine', 120, 48, ts, 0.005, 0.3, 0.45, o); burst(white, ts, 0.002, 0.14, 0.22, o, 'lowpass', 1000, 0.7, 180); }
    },
    birds(pan) {
      if (!ctx) return;
      const t = now(), o = out(pan, 4000);
      for (let i = 0; i < 14; i++) burst(white, t + Math.random() * 0.9, 0.01, 0.06, 0.05, o, 'bandpass', 1800 + Math.random() * 1200, 1.5);
    },
    // it has you: a slow horn, rising
    caught() {
      if (!ctx) return;
      const t = now(), o = out(0, null);
      const lp = filt('lowpass', 140, 2); lp.frequency.setValueAtTime(140, t); lp.frequency.exponentialRampToValueAtTime(1100, t + 6);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 5.8); g.gain.setTargetAtTime(0.0001, t + 6.5, 0.08);
      for (const [f, det] of [[55, -8], [55, 7], [82.4, -4], [41.2, 0]]) { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = det; s.connect(lp); s.start(t); s.stop(t + 7.2); }
      lp.connect(g); g.connect(o);
    },
    hit() {
      if (!ctx) return;
      const t = now(), o = out(0, null);
      osc('sine', 62, 26, t, 0.005, 2.5, 0.9, o);
      burst(white, t, 0.003, 1.2, 0.5, o, 'lowpass', 3000, 0.7, 120);
    },
    // every frame: how windy, how near the lantern is (0..1) and where, how tense
    update(dt, st) {
      if (!ctx) return;
      const t = now();
      wind.gain.setTargetAtTime(0.09 + 0.12 * st.wind, t, 0.5);
      whistle.gain.setTargetAtTime(0.03 * st.wind, t, 0.8);
      roar.gain.setTargetAtTime(0.5 * st.roar * st.roar, t, 0.2);
      drone.gain.setTargetAtTime(0.055 * st.tension, t, 1.2);
      // in shallow shadow a faint tick, quicker as your time there runs out (st.tick 0 = none, 1 = fastest)
      S.tickT -= dt;
      if (st.tick > 0 && S.tickT <= 0) {
        S.tickT = 0.9 - 0.72 * st.tick;
        const o = out(0, 3200);
        burst(white, t, 0.001, 0.025, 0.07 + 0.05 * st.tick, o, 'bandpass', 2600 + 900 * st.tick, 6);
      }
      // the chain: a clink now and then, more when the lantern is moving
      S.clinkT -= dt;
      if (st.chain > 0.02 && S.clinkT <= 0) {
        S.clinkT = 0.25 + Math.random() * (1.4 - st.move);
        const o = out(st.lanPan * 0.8, null), f = 520 + Math.random() * 900;
        burst(white, t, 0.002, 0.5, 0.05 * st.chain, o, 'bandpass', f, 30);
        burst(white, t + 0.03 + Math.random() * 0.05, 0.002, 0.35, 0.035 * st.chain, o, 'bandpass', f * 1.48, 30);
      }
    },
  };
  return api;
}
