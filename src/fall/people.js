// UNDERFOOT — the townspeople, and the brains that move small figures through the streets. The player's
// autopilot (under the title) and the townspeople share them: a stroller wanders the streets, a hider looks
// for a dark spot against a house, the curious one walks out to see the light and stands in it. A townsperson
// carries a candle, so the lantern is drawn to them; one the light finds is taken, and a stain stays.
import { standY, blocked, houses, SQUARE, STREETS, townR } from './world.js';

const lerp = (a, b, t) => a + (b - a) * t;
// screen axes to world: the play camera's right is +x -z, its forward -x -z
const YAW = Math.PI / 4, RX = Math.cos(YAW), RZ = -Math.sin(YAW), FX = -Math.sin(YAW), FZ = -Math.cos(YAW);

// Where a figure wants to go next. `who` has x, z and tier; `mem` keeps its goal and timer; `env` gives the
// phase, the lantern's mark (aimS), the hiding test and the game's random numbers. Returns [ix, iy] in the
// play camera's screen axes, like a stick.
export function brain(who, mem, mode, env, dt) {
  mem.t -= dt;
  const lp = env.aimS, here = [who.x, standY(who.x, who.z) + 1.6, who.z];
  if (mode === 'hider') {
    const near = Math.hypot(who.x - lp[0], who.z - lp[1]) < 30;
    // the light's centre nearly on it: it leaves before the peer, for somewhere 12 m or more from the centre
    const mark = env.attn || lp, crowded = Math.hypot(who.x - mark[0], who.z - mark[1]) < 9;
    if (crowded && !mem.fleeing) { mem.goal = null; mem.t = 0; }
    if (mem.t <= 0 || !mem.goal) {
      mem.t = mem.slow ? 2.4 : 0.8; mem.fleeing = crowded;
      if (env.isLit(here).tier !== 'deep' || !mem.goal || near) {
        // somewhere close that is dark now, tucked against a house, away from where the light is, and
        // inside the walls (out in the fields there is nothing to hide behind). A bad hider looks less far
        // and sometimes does not mind the light.
        const reach = mem.slow ? 15 : 27, careless = mem.slow && env.rnd() < 0.35;
        let best = null, bs = -1e9;
        for (let r = crowded ? 9 : 3; r <= Math.max(reach, crowded ? 21 : 0); r += 3) for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + r, x = who.x + Math.cos(a) * r, z = who.z + Math.sin(a) * r;
          if (blocked(x, z)) continue;
          if (crowded && Math.hypot(x - mark[0], z - mark[1]) < 12) continue;
          let clear = true; for (let q = 1; q < 8; q++) if (blocked(lerp(who.x, x, q / 8), lerp(who.z, z, q / 8))) { clear = false; break; }
          if (!clear) continue;
          let tucked = 0; for (let q = 0; q < 8; q++) if (blocked(x + Math.cos(q * 0.785) * 3, z + Math.sin(q * 0.785) * 3)) tucked++;
          const dark = careless || env.isLit([x, standY(x, z) + 1.6, z]).tier === 'deep';
          const sc = (dark ? 100 : 0) + Math.min(4, tucked) * 6 + Math.min(30, Math.hypot(x - lp[0], z - lp[1])) * 0.6 - r * 0.3 - (townR(x, z) > 0.92 ? 80 : 0);
          if (sc > bs) { bs = sc; best = [x, z]; }
        }
        mem.goal = best;
      }
    }
  } else if (mode === 'curious') {
    // walks out to see the light; once the light is on it, it stands there looking up into it
    if (mem.toSquare && Math.hypot(who.x - SQUARE.x, who.z - SQUARE.z) < 6) mem.toSquare = false;
    if (who.tier === 'lit') mem.goal = [who.x, who.z];
    else if (mem.t <= 0 || !mem.goal) { mem.t = 1.5; mem.goal = env.pt < 6 || mem.toSquare ? [SQUARE.x + (env.rnd() - 0.5) * 16, SQUARE.z + (env.rnd() - 0.5) * 12] : [lp[0], lp[1]]; }
  } else if (mem.t <= 0 || !mem.goal) {
    mem.t = 5 + env.rnd() * 5;
    const St = STREETS[Math.floor(env.rnd() * STREETS.length)], u = env.rnd();
    mem.goal = [lerp(St.a[0], St.b[0], u), lerp(St.a[1], St.b[1], u)];
  }
  if (!mem.goal) return [0, 0];
  const dx = mem.goal[0] - who.x, dz = mem.goal[1] - who.z, d = Math.hypot(dx, dz);
  if (d < 0.6) return [0, 0];
  const k = Math.min(1, d / 2);
  return [((dx * RX + dz * RZ) / d) * k, ((dx * FX + dz * FZ) / d) * k];
}

// move a figure by a stick input, sliding along walls, and keep its stride going
export function walk(who, ix, iy, dt, speed = 4.6) {
  let vx = RX * ix + FX * iy, vz = RZ * ix + FZ * iy;
  const m = Math.hypot(vx, vz), sp = speed * Math.min(1, Math.hypot(ix, iy));
  if (m > 1e-3) { vx = (vx / m) * sp; vz = (vz / m) * sp; who.yaw = Math.atan2(vx, vz); }
  const nx = who.x + vx * dt, nz = who.z + vz * dt;
  if (!blocked(nx, nz)) { who.x = nx; who.z = nz; } else if (!blocked(nx, who.z)) who.x = nx; else if (!blocked(who.x, nz)) who.z = nz;
  who.run += ((m > 1e-3 ? 1 : 0) - who.run) * Math.min(1, dt * 8);
  who.ph += dt * (6 + 5 * who.run) * who.run;
}

// a townsperson steps out of a door near the square: the curious one on night 1, bad hiders after
export function spawnPerson(mode, rnd, avoid) {
  const cand = houses.filter((H) => H.inTown && H.door && !blocked(H.door[0], H.door[1]) && Math.hypot(H.door[0] - SQUARE.x, H.door[1] - SQUARE.z) < 60 && (!avoid || Math.hypot(H.door[0] - avoid[0], H.door[1] - avoid[1]) > 25));
  const H = cand[Math.floor(rnd() * cand.length)] || houses[0];
  const d = H.door || [H.x, H.z];
  return { x: d[0], z: d[1], yaw: H.rot + Math.PI, ph: rnd() * 6, run: 0, tier: 'none', mode, mem: { goal: null, t: 0, slow: mode === 'hider', toSquare: mode === 'curious' }, litT: 0, state: 'out', candle: true, house: H };
}
