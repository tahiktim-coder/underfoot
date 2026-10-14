// UNDERFOOT — things rebuilt every frame into the per-frame mesh: the chain and the lantern, people, sails.
import { M, quad, tri, box, frame, cyl } from './mesh.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// a box between two points with a given cross-section, oriented by `side`
function bar(A, a, b, w, d, side, m, seed = 0) {
  const ax = nrm(sub(b, a));
  let u = nrm(crs(ax, side)); if (!isFinite(u[0])) u = [1, 0, 0];
  const v = crs(u, ax);
  const c = scl(add(a, b), 0.5);
  const P = (p, su, sv) => add(p, add(scl(u, su * w), scl(v, sv * d)));
  const ring = (p) => [P(p, -1, -1), P(p, 1, -1), P(p, 1, 1), P(p, -1, 1)];
  const ra = ring(a), rb = ring(b);
  for (let k = 0; k < 4; k++) quad(A, ra[k], ra[(k + 1) % 4], rb[(k + 1) % 4], rb[k], m, [0, 0], [1, 0], [1, 1], [0, 1], seed, c);
}

// The chain: links along a gently sagging curve from the hand to the lantern ring, each turned 90 degrees
// from the last.
export function chain(A, from, to, link = 26, thick = 5.5) {
  const L = Math.hypot(...sub(to, from)), n = Math.max(2, Math.round(L / link));
  const dir = nrm(sub(to, from));
  let side = nrm(crs(dir, [0, 1, 0])); if (!isFinite(side[0]) || Math.hypot(...crs(dir, [0, 1, 0])) < 1e-3) side = [1, 0, 0];
  const sag = Math.min(40, L * 0.02);
  const at = (t) => add(add(from, scl(sub(to, from), t)), [0, -Math.sin(Math.PI * t) * sag, 0]);
  for (let i = 0; i < n; i++) {
    const a = at(i / n), b = at((i + 1) / n);
    const s2 = i & 1 ? side : crs(nrm(sub(b, a)), side);
    const ax = nrm(sub(b, a)), e = scl(ax, link * 0.12);
    const w = link * 0.32;
    const pl = add(scl(nrm(s2), w), [0, 0, 0]);
    // a link: two long sides and two short ends, as bars
    bar(A, add(sub(a, e), pl), add(add(b, e), pl), thick * 0.5, thick * 0.5, s2, M.G_CHAIN);
    bar(A, sub(sub(a, e), pl), sub(add(b, e), pl), thick * 0.5, thick * 0.5, s2, M.G_CHAIN);
    bar(A, add(sub(a, e), pl), sub(sub(a, e), pl), thick * 0.5, thick * 0.5, ax, M.G_CHAIN);
    bar(A, add(add(b, e), pl), sub(add(b, e), pl), thick * 0.5, thick * 0.5, ax, M.G_CHAIN);
  }
}

// The lantern: an iron cage, eight sides, glass panes lit from inside, a cap and a ring. `top` is the ring,
// `up` the axis from the lantern toward the chain.
export function lantern(A, top, up, size = 64, t = 0) {
  up = nrm(up);
  let X = nrm(crs(up, [0, 0, 1])); if (Math.hypot(...crs(up, [0, 0, 1])) < 1e-3) X = [1, 0, 0];
  const Z = crs(X, up);
  const P = (x, y, z) => add(top, add(add(scl(X, x), scl(up, y)), scl(Z, z)));
  const H = size, R = size * 0.34, rC = R * 1.15;
  const yTop = -H * 0.2, yBot = -H * 0.9, yBase = -H * 0.97;
  const ring = (y, r, k) => { const a = (k / 8) * Math.PI * 2; return P(Math.cos(a) * r, y, Math.sin(a) * r); };
  const ctr = P(0, (yTop + yBot) / 2, 0);
  for (let k = 0; k < 8; k++) {
    // glass
    quad(A, ring(yBot, R, k), ring(yBot, R, k + 1), ring(yTop, R, k + 1), ring(yTop, R, k), M.G_GLASS, [0, 0], [1, 0], [1, 1], [0, 1], 0, ctr);
    // corner bars
    const c0 = ring(yBot - 2, R + 1.5, k), c1 = ring(yTop + 2, R + 1.5, k);
    bar(A, c0, c1, 2.6, 2.6, nrm(sub(c0, P(0, yBot, 0))), M.G_CAGE);
    // a cross bar half way
    bar(A, ring((yTop + yBot) / 2, R + 1.4, k), ring((yTop + yBot) / 2, R + 1.4, k + 1), 1.4, 1.4, up, M.G_CAGE);
    // cap: a stepped roof
    quad(A, ring(yTop, rC, k), ring(yTop, rC, k + 1), ring(yTop + H * 0.1, rC * 0.7, k + 1), ring(yTop + H * 0.1, rC * 0.7, k), M.G_CAGE, [0, 0], [1, 0], [1, 1], [0, 1], 0, P(0, yTop - 5, 0));
    tri(A, ring(yTop + H * 0.1, rC * 0.7, k), ring(yTop + H * 0.1, rC * 0.7, k + 1), P(0, -H * 0.04, 0), M.G_CAGE, [0, 0], [1, 0], [0.5, 1], 0, P(0, yTop - 5, 0));
    // base: a basin
    quad(A, ring(yBot, R * 1.05, k), ring(yBot, R * 1.05, k + 1), ring(yBase, R * 0.5, k + 1), ring(yBase, R * 0.5, k), M.G_CAGE, [0, 0], [1, 0], [1, 1], [0, 1], 0, P(0, yBot + 5, 0));
  }
  // the flame inside, seen through the glass
  const f = P(0, (yTop + yBot) / 2 - 2, 0), fr = R * 0.38 * (1 + 0.08 * Math.sin(t * 9));
  for (let k = 0; k < 6; k++) { const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2; tri(A, add(f, add(scl(X, Math.cos(a0) * fr), scl(Z, Math.sin(a0) * fr))), add(f, add(scl(X, Math.cos(a1) * fr), scl(Z, Math.sin(a1) * fr))), add(f, scl(up, R * 0.9)), M.G_FLAME, [0, 0], [1, 0], [0.5, 1], 0, f); }
  // the ring at the top
  for (let k = 0; k < 6; k++) { const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2; bar(A, add(top, add(scl(up, -4 + Math.sin(a0) * 6), scl(X, Math.cos(a0) * 6))), add(top, add(scl(up, -4 + Math.sin(a1) * 6), scl(X, Math.cos(a1) * 6))), 1.4, 1.4, Z, M.G_CAGE); }
}

// A small person: legs, a long coat, a hood or bare head, a scarf. `run` 0..1, `ph` the stride phase,
// `crouch` 0..1. Built at 1.6x life size so they read at 5 px/m. look.inflate (metres) grows every part
// outward and look.mat draws it all in one material: together they build the outline hull. look.ring (0..1)
// adds a dithered disc on the ground under the feet.
export function person(A, x, y, z, yaw, ph, run, look = {}) {
  const k = 1.6, P0 = frame(x, y, z, yaw);
  const crouch = look.crouch || 0;
  const P = (lx, ly, lz) => P0(lx * k, ly * k * (1 - crouch * 0.25), lz * k);
  const sw = Math.sin(ph) * (0.25 + 0.35 * run), lift = Math.max(0, Math.cos(ph)) * 0.15 * run;
  const only = look.mat, mat = (m) => only ?? m;
  const o = look.inflate || 0, ol = o / k;
  const cloak = mat(look.cloak ?? M.P_CLOAK), hood = mat(M.P_HOOD), skin = mat(M.P_SKIN), dark = mat(M.P_DARK), scarf = mat(M.P_SCARF);
  const lean = run * 0.18 + crouch * 0.3;
  const Q = (lx, ly, lz) => P(lx, ly, lz + ly * lean * 0.5);
  // the two primitives, grown by the inflation
  const barI = (a, b, w, d, side, m) => { const ax = nrm(sub(b, a)); bar(A, sub(a, scl(ax, o)), add(b, scl(ax, o)), w + o, d + o, side, m); };
  const boxI = (F, x0, y0, z0, x1, y1, z1, m, seed) => box(A, F, x0 - ol, y0 - ol, z0 - ol, x1 + ol, y1 + ol, z1 + ol, m, seed);
  if (look.ring > 0 && !only) {
    // the ring: a flat disc 1.8 m across just over the ground, a soft edge, dithered in the shader
    const n = 10, r = 0.9, c = P0(0, 0.12, 0), hint = P0(0, -2, 0);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      tri(A, c, P0(Math.cos(a0) * r, 0.12, Math.sin(a0) * r), P0(Math.cos(a1) * r, 0.12, Math.sin(a1) * r), M.P_RING, [0, 0], [Math.cos(a0), Math.sin(a0)], [Math.cos(a1), Math.sin(a1)], look.ring, hint);
    }
  }
  // legs
  for (const s of [-1, 1]) {
    const a = s * sw, hip = [s * 0.11, 0.86, 0], foot = [s * 0.12, 0.05 + (s > 0 ? lift : Math.max(0, -Math.cos(ph)) * 0.15 * run), Math.sin(a) * 0.62];
    barI(Q(...hip), P(...foot), 0.075 * k, 0.075 * k, [1, 0, 0], dark);
  }
  // coat: a tapered box from the shoulders to the knees
  const sway = Math.sin(ph * 2) * 0.03;
  boxI((lx, ly, lz) => Q(lx + sway * (1.4 - ly), ly, lz), -0.2, 0.62, -0.13, 0.2, 1.42, 0.14, cloak, 0.3);
  boxI((lx, ly, lz) => Q(lx * (1 + (0.9 - ly) * 0.5), ly, lz), -0.22, 0.42, -0.15, 0.22, 0.9, 0.16, cloak, 0.3);
  // arms
  for (const s of [-1, 1]) barI(Q(s * 0.23, 1.36, 0), Q(s * 0.26, 0.9, -Math.sin(s * sw) * 0.4 * (0.4 + run)), 0.06 * k, 0.06 * k, [0, 0, 1], cloak);
  // head and hood
  const hy = 1.62;
  boxI(Q, -0.1, hy - 0.12, -0.1, 0.1, hy + 0.1, 0.1, skin, 0.1);
  if (look.hood !== false) { boxI(Q, -0.13, hy - 0.08, -0.14, 0.13, hy + 0.16, 0.08, hood, 0.2); }
  // scarf
  if (look.scarf !== false) { boxI(Q, -0.15, 1.38, -0.13, 0.15, 1.5, 0.15, scarf, 0.1); barI(Q(0.08, 1.42, -0.13), Q(0.12 + Math.sin(ph) * 0.05, 1.05, -0.2 - run * 0.25), 0.05 * k, 0.02 * k, [0, 0, 1], scarf); }
}
void cyl;
