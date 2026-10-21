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

// The lantern: a tall iron cage of twelve narrow panes with a mid-band, a steep cap with a spire and a hook
// ring, a basin and a pointed drip under it, a flame inside seen through the glass. `top` is the hook ring,
// `up` the axis from the lantern toward the chain, `size` its height from the ring to the drip.
export function lantern(A, top, up, size = 64, t = 0) {
  up = nrm(up);
  let X = nrm(crs(up, [0, 0, 1])); if (Math.hypot(...crs(up, [0, 0, 1])) < 1e-3) X = [1, 0, 0];
  const Z = crs(X, up);
  const P = (x, y, z) => add(top, add(add(scl(X, x), scl(up, y)), scl(Z, z)));
  const N = 12, TAU = Math.PI * 2, H = size, R = size * 0.15, C = M.G_CAGE;
  const yPeak = -H * 0.2, yCone = -H * 0.27, yRim = -H * 0.31, yTop = -H * 0.33, yMid = -H * 0.55, yBot = -H * 0.77, yBase = -H * 0.84, yTip = -H * 0.92;
  const ring = (y, r, k) => { const a = (k / N) * TAU; return P(Math.cos(a) * r, y, Math.sin(a) * r); };
  const ctr = P(0, (yTop + yBot) / 2, 0), uv4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const Q = (a, b, c, d, m, hint) => quad(A, a, b, c, d, m, ...uv4, 0, hint);
  for (let k = 0; k < N; k++) {
    // a pane: uv runs 0..1 across and 0..1 up, so the shader can light it from the flame
    quad(A, ring(yBot, R, k), ring(yBot, R, k + 1), ring(yTop, R, k + 1), ring(yTop, R, k), M.G_GLASS, [0, 0], [1, 0], [1, 1], [0, 1], k, ctr);
    // a corner bar a metre thick, and three rails: under the cap, a band half way, over the basin
    const c0 = ring(yBot - 0.6, R + 0.55, k), c1 = ring(yTop + 0.6, R + 0.55, k);
    bar(A, c0, c1, 0.5, 0.5, nrm(sub(c0, P(0, yBot, 0))), C);
    for (const [y, w] of [[yTop + 0.3, 0.55], [yMid, 0.42], [yBot - 0.3, 0.55]]) bar(A, ring(y, R + 0.5, k), ring(y, R + 0.5, k + 1), w, w, up, C);
    // the cap: a lip, an overhanging slope, then a steep roof to the peak
    Q(ring(yTop, R * 1.3, k), ring(yTop, R * 1.3, k + 1), ring(yRim, R * 1.3, k + 1), ring(yRim, R * 1.3, k), C, P(0, yRim, 0));
    Q(ring(yRim, R * 1.3, k), ring(yRim, R * 1.3, k + 1), ring(yCone, R * 0.72, k + 1), ring(yCone, R * 0.72, k), C, P(0, yRim - 6, 0));
    tri(A, ring(yCone, R * 0.72, k), ring(yCone, R * 0.72, k + 1), P(0, yPeak, 0), C, [0, 0], [1, 0], [0.5, 1], 0, P(0, yCone - 6, 0));
    // the base: a basin closing to a point
    Q(ring(yBot, R * 1.12, k), ring(yBot, R * 1.12, k + 1), ring(yBase, R * 0.45, k + 1), ring(yBase, R * 0.45, k), C, P(0, yBot + 6, 0));
    tri(A, ring(yBase, R * 0.45, k), ring(yBase, R * 0.45, k + 1), P(0, yTip, 0), C, [0, 0], [1, 0], [0.5, 1], 0, P(0, yBase + 6, 0));
  }
  // the spire over the cap, with a knop, up to the hook ring
  const sp = (y, r, k) => { const a = (k / 4) * TAU + Math.PI / 4; return P(Math.cos(a) * r, y, Math.sin(a) * r); };
  for (let k = 0; k < 4; k++) {
    Q(sp(yPeak, R * 0.22, k), sp(yPeak, R * 0.22, k + 1), sp(-H * 0.16, R * 0.09, k + 1), sp(-H * 0.16, R * 0.09, k), C, P(0, yPeak - 4, 0));
    Q(sp(-H * 0.16, R * 0.09, k), sp(-H * 0.16, R * 0.09, k + 1), sp(-H * 0.1, R * 0.07, k + 1), sp(-H * 0.1, R * 0.07, k), C, P(0, -H * 0.2, 0));
  }
  bar(A, P(0, -H * 0.175, 0), P(0, -H * 0.145, 0), R * 0.2, R * 0.2, X, C);
  // the hook ring at the top, where the chain ends
  for (let k = 0; k < 8; k++) { const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU, rr = H * 0.1; bar(A, add(top, add(scl(up, -H * 0.06 + Math.sin(a0) * rr), scl(X, Math.cos(a0) * rr))), add(top, add(scl(up, -H * 0.06 + Math.sin(a1) * rr), scl(X, Math.cos(a1) * rr))), H * 0.013, H * 0.013, Z, C); }
  // the flame: a fan of tongues, white-hot at the root, amber at the tips (the shader reads v)
  const f = P(0, yMid - R * 0.45, 0), fr = R * 0.5 * (1 + 0.08 * Math.sin(t * 9)), fh = R * 1.35 * (1 + 0.1 * Math.sin(t * 7 + 1));
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU, lean = 0.12 * Math.sin(t * 11 + k);
    tri(A, add(f, add(scl(X, Math.cos(a0) * fr), scl(Z, Math.sin(a0) * fr))), add(f, add(scl(X, Math.cos(a1) * fr), scl(Z, Math.sin(a1) * fr))), add(f, add(scl(up, fh), scl(X, lean * fh))), M.G_FLAME, [0, 0], [1, 0], [0.5, 1], 0, f);
  }
}

// A small person: legs, a long coat, a hood or bare head, a scarf; or, with look.knight, a knight in pale
// plate with a rounded helm, a dark visor slit and a red cape that swings with the stride and flares when
// running. `run` 0..1, `ph` the stride phase, `crouch` 0..1. Built at 1.6x life size so they read at 5 px/m.
// look.inflate (metres) grows every part outward and look.mat draws it all in one material: together they
// build the outline hull (the cape, a flat sheet, is left out of it). look.ring (0..1) adds a dithered disc
// on the ground under the feet.
export function person(A, x, y, z, yaw, ph, run, look = {}) {
  const k = look.knight ? 1.8 : 1.6, P0 = frame(x, y, z, yaw);   // the knight a little larger: he has to read from above
  const crouch = look.crouch || 0;
  const P = (lx, ly, lz) => P0(lx * k, ly * k * (1 - crouch * 0.25), lz * k);
  const sw = Math.sin(ph) * (0.25 + 0.35 * run), lift = Math.max(0, Math.cos(ph)) * 0.15 * run;
  const only = look.mat, mat = (m) => only ?? m;
  const o = look.inflate || 0, ol = o / k;
  const cloak = mat(look.cloak ?? M.P_CLOAK), hood = mat(M.P_HOOD), skin = mat(M.P_SKIN), dark = mat(M.P_DARK), scarf = mat(M.P_SCARF), armour = mat(M.P_ARMOUR), cape = mat(M.P_CAPE);
  const lean = run * 0.18 + crouch * 0.3;
  const Q = (lx, ly, lz) => P(lx, ly, lz + ly * lean * 0.5);
  // the two primitives, grown by the inflation
  const barI = (a, b, w, d, side, m) => { const ax = nrm(sub(b, a)); bar(A, sub(a, scl(ax, o)), add(b, scl(ax, o)), w + o, d + o, side, m); };
  const boxI = (F, x0, y0, z0, x1, y1, z1, m, seed) => box(A, F, x0 - ol, y0 - ol, z0 - ol, x1 + ol, y1 + ol, z1 + ol, m, seed);
  if (look.ring > 0 && !only) {
    // the ring: a flat disc 2.6 m across just over the ground, a soft edge, dithered in the shader
    const n = 12, r = 1.3, c = P0(0, 0.12, 0), hint = P0(0, -2, 0);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      tri(A, c, P0(Math.cos(a0) * r, 0.12, Math.sin(a0) * r), P0(Math.cos(a1) * r, 0.12, Math.sin(a1) * r), M.P_RING, [0, 0], [Math.cos(a0), Math.sin(a0)], [Math.cos(a1), Math.sin(a1)], look.ring, hint);
    }
  }
  // legs (greaves of plate on the knight)
  for (const s of [-1, 1]) {
    const a = s * sw, hip = [s * 0.11, 0.86, 0], foot = [s * 0.12, 0.05 + (s > 0 ? lift : Math.max(0, -Math.cos(ph)) * 0.15 * run), Math.sin(a) * 0.62];
    barI(Q(...hip), P(...foot), (look.knight ? 0.085 : 0.075) * k, 0.075 * k, [1, 0, 0], look.knight ? armour : dark);
  }
  if (look.knight) {
    // the cuirass, wider at the chest; a short skirt of faulds; a pauldron on each shoulder; the arms in plate
    boxI((lx, ly, lz) => Q(lx * (1 + (ly - 0.85) * 0.3), ly, lz), -0.2, 0.85, -0.13, 0.2, 1.42, 0.15, armour, 0.3);
    boxI((lx, ly, lz) => Q(lx * (1 + (0.9 - ly) * 0.4), ly, lz), -0.2, 0.62, -0.14, 0.2, 0.9, 0.15, dark, 0.3);
    // pauldrons wide enough to give him shoulders from above
    for (const s of [-1, 1]) boxI(Q, Math.min(s * 0.17, s * 0.4), 1.28, -0.16, Math.max(s * 0.17, s * 0.4), 1.5, 0.16, armour, 0.2);
    for (const s of [-1, 1]) barI(Q(s * 0.24, 1.36, 0), Q(s * 0.27, 0.9, -Math.sin(s * sw) * 0.4 * (0.4 + run)), 0.065 * k, 0.065 * k, [0, 0, 1], armour);
    // the helm: rounded (a box with a smaller crown), a dark slit for the eyes on the front
    boxI(Q, -0.12, 1.5, -0.12, 0.12, 1.78, 0.12, armour, 0.1);
    boxI(Q, -0.09, 1.78, -0.09, 0.09, 1.87, 0.09, armour, 0.1);
    if (!only) box(A, Q, -0.09, 1.64, 0.11, 0.09, 1.69, 0.145, dark, 0);
    // a red crest along the helm, leaning back: the second red mark on him, and the one the play camera sees
    boxI(Q, -0.03, 1.86, -0.16, 0.03, 2.1, 0.06, cape, 0.1);
    // a belt, and a sword hung at the left hip, angled back
    boxI(Q, -0.21, 0.84, -0.15, 0.21, 0.9, 0.16, dark, 0.1);
    barI(Q(-0.2, 0.92, -0.02), Q(-0.3, 0.3, -0.34), 0.025 * k, 0.05 * k, [1, 0, 0], dark);
    boxI(Q, -0.27, 0.86, -0.1, -0.15, 0.94, 0.02, armour, 0.1);
    // the cape: two halves from the shoulders to the calves, a little thick so it shows from any side,
    // swinging behind with the stride and flaring when running
    if (!only) {
      // wider and thicker than it was, so the red shows from the side and from above, not only from behind
      const hemBack = -0.22 - 0.3 * run - 0.06 * Math.max(0, Math.sin(ph * 2)), flare = 0.2 + 0.3 * run, hem = 0.24 + 0.12 * run, top = 1.46, th = 0.06;
      const side = Math.sin(ph) * 0.05 * run, hint = Q(0, 1, 1);
      // each half in three strips with a ragged hem: an old cape, not a new one
      for (const s of [-1, 1]) {
        const F = (lx, ly, lz) => { const u = lx * s, t = (top - ly) / (top - hem); return Q(u * (0.27 + flare * t) + side * t, ly, -0.17 + (hemBack + 0.17) * t + lz); };
        for (const [u0, u1, dh] of [[0, 0.36, 0.02], [0.36, 0.7, 0.09], [0.7, 1, -0.03]]) box(A, F, u0, hem + dh, -th, u1, top, 0, cape, 0.3, false);
      }
      void hint;
    }
    return;
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
  // a candle held out in front: a stub and a small flame (the glow is a screen glow and a point light)
  if (look.candle && !only) {
    const h = Q(0.22, 1.0, -0.2);
    bar(A, Q(0.22, 0.9, -0.2), h, 0.025 * k, 0.025 * k, [1, 0, 0], M.P_LIGHT);
    tri(A, add(h, [-0.04, 0, 0]), add(h, [0.04, 0, 0]), add(h, [0, 0.12, 0]), M.G_FLAME, [0, 0], [1, 0], [0.5, 1], 0, add(h, [0, -1, 0]));
    tri(A, add(h, [0, 0, -0.04]), add(h, [0, 0, 0.04]), add(h, [0, 0.12, 0]), M.G_FLAME, [0, 0], [1, 0], [0.5, 1], 0, add(h, [0, -1, 0]));
  }
  // scarf
  if (look.scarf !== false) { boxI(Q, -0.15, 1.38, -0.13, 0.15, 1.5, 0.15, scarf, 0.1); barI(Q(0.08, 1.42, -0.13), Q(0.12 + Math.sin(ph) * 0.05, 1.05, -0.2 - run * 0.25), 0.05 * k, 0.02 * k, [0, 0, 1], scarf); }
}
void cyl;

// The beam: the cone of the lantern's light in the air, from the glass to the pool, sixteen sides, its foot
// on the ground where the light lands (groundY gives the terrain). Drawn as dithered light (material G_BEAM).
export function beam(A, light, size, groundY) {
  const { pos, dir, cosOuter } = light;
  if (dir[1] > -0.2) return;
  let t = 100;
  for (let i = 0; i < 3; i++) { const p = add(pos, scl(dir, t)); t = Math.max(10, (pos[1] - groundY(p[0], p[2])) / -dir[1]); }
  if (t > 400) return;   // only once it hangs low over the town
  const n = 16, r0 = size * 0.22, r1 = t * Math.tan(Math.acos(cosOuter));
  let X = nrm(crs(dir, [0, 1, 0])); if (Math.hypot(...crs(dir, [0, 1, 0])) < 1e-3) X = [1, 0, 0];
  const Z = crs(X, dir), mid = add(pos, scl(dir, t * 0.5));
  const ring = (r, tt, k) => { const a = (k / n) * Math.PI * 2; return add(add(pos, scl(dir, tt)), add(scl(X, Math.cos(a) * r), scl(Z, Math.sin(a) * r))); };
  for (let k = 0; k < n; k++) quad(A, ring(r0, 0, k), ring(r0, 0, k + 1), ring(r1, t, k + 1), ring(r1, t, k), M.G_BEAM, [0, 0], [1, 0], [1, 1], [0, 1], 0, mid);
}
