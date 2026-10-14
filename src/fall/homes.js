// UNDERFOOT — the houses through a night. Each house is lit (someone home, windows lit), dark, or taken (the
// light found it: dark, with a scorch, for the rest of the run). The shader gets one byte per house. The
// night's stragglers are the lit houses the giant's coming did not put out; they are what the lantern is
// drawn to when it has lost you.
import { houses, HOUSE_SLOTS } from './world.js';

export function createHomes(rnd) {
  // about two thirds of the houses have someone home
  for (const H of houses) { H.home = !!H.farm || rnd() < 0.65; H.state = H.home ? 'lit' : 'dark'; }
  const inTown = houses.filter((H) => H.inTown && H.home);
  const relightOrder = inTown.map((_, i) => inTown[(i * 37) % inTown.length]);
  const HM = {
    bytes: new Uint8Array(HOUSE_SLOTS), stragglers: new Set(), relightT: 0,
    lit: () => houses.filter((H) => H.state === 'lit'),
    // the stragglers still lit inside the walls: what the lantern is drawn to
    targets: () => houses.filter((H) => H.state === 'lit' && H.inTown && HM.stragglers.has(H.i)),
    sync() { for (const H of houses) HM.bytes[H.i] = H.state === 'lit' ? 255 : H.state === 'taken' ? 128 : 0; },
    // the N who did not hide: lit windows spread across the town, chosen when it starts to come
    pick(n) {
      const cand = inTown.filter((H) => H.state !== 'taken'), picked = [];
      if (cand.length) picked.push(cand[Math.floor(rnd() * cand.length)]);
      while (picked.length < n && picked.length < cand.length) {
        let best = null, bd = -1;
        for (const H of cand) { if (picked.includes(H)) continue; const d = Math.min(...picked.map((Q) => Math.hypot(Q.x - H.x, Q.z - H.z))); if (d > bd) { bd = d; best = H; } }
        picked.push(best);
      }
      HM.stragglers = new Set(picked.map((H) => H.i));
    },
    // windows go out, the closest to the boot first; the stragglers keep theirs
    out(n, from) {
      const lit = HM.lit().filter((H) => !HM.stragglers.has(H.i)).sort((a, b) => Math.hypot(a.x - from[0], a.z - from[1]) - Math.hypot(b.x - from[0], b.z - from[1]));
      for (const H of lit.slice(0, n)) H.state = 'dark';
    },
    // calm: all home lit. plant: only the stragglers. reset: a new run, the taken forgiven
    set(mode) {
      for (const H of houses) {
        if (H.state === 'taken' && mode !== 'reset') continue;
        H.state = H.home && (mode !== 'plant' || HM.stragglers.has(H.i)) ? 'lit' : 'dark';
      }
    },
    // after it passes, the windows come back one by one; the taken stay dark
    relight(dt) {
      HM.relightT += dt;
      if (HM.relightT < 0.8) return;
      HM.relightT = 0;
      const H = relightOrder.find((Q) => Q.state === 'dark');
      if (H) H.state = 'lit';
    },
    take(H) { H.state = 'taken'; },
  };
  return HM;
}
