// UNDERFOOT — the houses through a night. Each house is lit (someone home, windows lit) or dark; the shader
// gets one byte per house (a third value, taken, is kept for a house the light found, though nothing takes a
// house now). The windows go out in batches on the footfalls of the approach, every one is dark by the plant,
// and they come back one by one after it has passed.
import { houses, HOUSE_SLOTS } from './world.js';

export function createHomes(rnd) {
  // about two thirds of the houses have someone home
  for (const H of houses) { H.home = !!H.farm || rnd() < 0.65; H.state = H.home ? 'lit' : 'dark'; }
  const inTown = houses.filter((H) => H.inTown && H.home);
  const relightOrder = inTown.map((_, i) => inTown[(i * 37) % inTown.length]);
  const HM = {
    bytes: new Uint8Array(HOUSE_SLOTS), relightT: 0,
    lit: () => houses.filter((H) => H.state === 'lit'),
    sync() { for (const H of houses) HM.bytes[H.i] = H.state === 'lit' ? 255 : H.state === 'taken' ? 128 : 0; },
    // windows go out, the closest to the boot first
    out(n, from) {
      const lit = HM.lit().sort((a, b) => Math.hypot(a.x - from[0], a.z - from[1]) - Math.hypot(b.x - from[0], b.z - from[1]));
      for (const H of lit.slice(0, n)) H.state = 'dark';
    },
    // calm: all home lit. plant: every window dark. reset: a new run, the taken forgiven
    set(mode) {
      for (const H of houses) {
        if (H.state === 'taken' && mode !== 'reset') continue;
        H.state = H.home && mode !== 'plant' ? 'lit' : 'dark';
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
  };
  return HM;
}
