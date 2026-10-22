// UNDERFOOT — the giant. A hooded pilgrim about three kilometres tall: a heavy robe and shoulder cape with
// woods growing on it, wrapped shins, bare stone-grey feet, and a lantern the size of a church on a chain
// from its right hand. Built in a rest pose (facing +z, its left at +x) as parts bound to 15 bones, skinned
// on the GPU. The walk is a step plan: feet are planted at given places and times, the pelvis rides between
// them, legs and arms are solved with two-bone IK.
import { M, STRIDE } from './mesh.js';
import { mulberry } from '../lib/noise.js';

// rest joints
export const REST = [
  [0, 1350, 0], [0, 1500, 0], [0, 2470, 20],
  [170, 1330, 0], [175, 700, 10], [180, 98, 0],
  [-170, 1330, 0], [-175, 700, 10], [-180, 98, 0],
  [330, 2370, 0], [345, 1850, -10], [355, 1370, 10],
  [-330, 2370, 0], [-345, 1850, -10], [-355, 1370, 10],
];
export const NB = 15;
const THIGH = 632, SHIN = 603, UPPER = 521, FORE = 481;
const LIFT0 = 12, LIFT_K = 0.0115;  // how high a swinging foot glides: a floor plus a share of its step (about 35 m on a 2 km stride)
const PITCH_UP = 0.08, PITCH_DOWN = 0.05;   // the toe pitched down as the foot lifts, up as it lands (radians)

// ------------------------------------------------------------------------------------------------ the face
// The helm's visor is a sculpted iron mask, calm and expressionless, about 310 m from chin to brow. maskZ gives
// its depth (z, toward the front) at a rest-pose x, y: a rounded base just in front of the skull, plus brow,
// sockets, nose, cheekbones, closed lips and chin as gaussian bumps and dips.
const g2 = (a, s) => Math.exp(-(a / s) * (a / s));
const sm0 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const FACE_Y0 = 2545, FACE_H = 310;
export const maskW = (v) => 150 * (0.6 + 0.4 * sm0(0.0, 0.42, v)) - 14 * sm0(0.86, 1.0, v);
export function maskZ(x, y) {
  const v = (y - FACE_Y0) / FACE_H, u = x / 150;
  let z = 30 + 186 * Math.sqrt(Math.max(0, 1 - (x / 175) ** 2));
  z -= 30 * sm0(0.82, 1.02, v) ** 2;                                                   // the brow rolls back into the skull
  z -= 34 * sm0(0.2, -0.02, v) ** 1.5;                                                 // under the chin it turns in
  return z + maskRelief(u, v);
}
// the features, over that base: a heavy brow drawn down in the middle, deep slanted sockets, a long straight
// nose, gaunt cheeks, folds from the nose to a thin mouth turned down at the corners, a square chin
export function maskRelief(u, v) {
  const au = Math.abs(u);
  const vb = 0.695 - 0.035 * g2(u, 0.18);
  let z = 16 * g2(v - vb, 0.042) * (1 - 0.3 * u * u) - 4 * g2(au - 0.05, 0.02) * g2(v - 0.68, 0.04);
  z -= 40 * g2(au - 0.34, 0.16) * g2(v - 0.6 - 0.09 * (au - 0.34), 0.058);
  const nose = sm0(0.36, 0.43, v) * (1 - sm0(0.6, 0.67, v));
  z += (28 + 14 * (1 - sm0(0.38, 0.62, v))) * g2(u, 0.08 + 0.045 * (1 - sm0(0.37, 0.5, v))) * nose;
  z -= 5 * g2(au - 0.075, 0.03) * g2(v - 0.375, 0.022);
  z += 12 * g2(au - 0.52, 0.16) * g2(v - 0.5, 0.07);
  z -= 9 * g2(au - 0.43, 0.17) * g2(v - 0.32, 0.09);
  // folds from the wings of the nose to the corners of the mouth
  const ax = 0.1, ay = 0.4, bx = 0.27, by = 0.245, dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((au - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  z -= 4.5 * g2(Math.hypot(au - (ax + dx * t), v - (ay + dy * t)), 0.016);
  const vm = 0.232 - 0.03 * (au / 0.24) ** 2, mw = 1 - sm0(0.2, 0.27, au);
  z += mw * (-7 * g2(v - vm, 0.009) + 3 * g2(v - vm - 0.022, 0.015) + 3 * g2(v - vm + 0.024, 0.016));
  z += 9 * g2(v - 0.09, 0.06) * g2(u, 0.33);
  return z;
}
// the eyes sit deep in the sockets
export const EYE_REST = [51, FACE_Y0 + 0.6 * FACE_H, 0]; EYE_REST[2] = maskZ(51, EYE_REST[1]) + 6;

// ------------------------------------------------------------------------------------------------ mesh
function makeBuf() {
  let a = new Float32Array(1 << 18), n = 0;
  return {
    v(p, nr, m, b0, b1, w) {
      if (n + 10 > a.length) { const b = new Float32Array(a.length * 2); b.set(a); a = b; }
      a[n++] = p[0]; a[n++] = p[1]; a[n++] = p[2]; a[n++] = nr[0]; a[n++] = nr[1]; a[n++] = nr[2]; a[n++] = m; a[n++] = b0; a[n++] = b1; a[n++] = w;
    },
    get data() { return a.subarray(0, n); },
  };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A grid surface P(i, j); skin(i, j, p) gives [b0, b1, w]; mat(i, j) the material. Normals are flat (each
// triangle its own face normal, so plates read as plates in a dithered palette) unless flat is false, when
// they are averaged over the neighbouring faces.
function surface(B, nu, nv, P, mat, skin, closeU = true, outward = null, flat = true) {
  const pts = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(P(closeU && i === nu ? 0 : i, j));
  const idx = (i, j) => j * (nu + 1) + i;
  const norms = pts.map(() => [0, 0, 0]);
  const faces = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    faces.push([a, b, c], [a, c, d]);
  }
  for (const f of faces) {
    let n = crs(sub(pts[f[1]], pts[f[0]]), sub(pts[f[2]], pts[f[0]]));
    for (const k of f) { norms[k][0] += n[0]; norms[k][1] += n[1]; norms[k][2] += n[2]; }
  }
  // seam: share normals across the closing column
  if (closeU) for (let j = 0; j <= nv; j++) { const a = idx(0, j), b = idx(nu, j); const s = add(norms[a], norms[b]); norms[a] = s; norms[b] = s.slice(); }
  let flip = 1;
  if (outward) { // make normals face away from the axis point
    let acc = 0; for (let k = 0; k < pts.length; k += 7) acc += dot(norms[k], sub(pts[k], outward(pts[k])));
    if (acc < 0) flip = -1;
  }
  for (let f of faces) {
    // wind each triangle counter-clockwise as seen from the side its normals face, so gl_FrontFacing is
    // true on the outside
    let gn = crs(sub(pts[f[1]], pts[f[0]]), sub(pts[f[2]], pts[f[0]]));
    const vn = add(add(norms[f[0]], norms[f[1]]), norms[f[2]]);
    if (dot(gn, vn) * flip < 0) { f = [f[0], f[2], f[1]]; gn = scl(gn, -1); }
    const fn = flat ? nrm(gn) : null;
    for (const k of f) {
      const i = k % (nu + 1), j = Math.floor(k / (nu + 1));
      const s = skin(i, j, pts[k]);
      B.v(pts[k], fn || scl(nrm(norms[k]), flip), mat(i, j), s[0], s[1], s[2]);
    }
  }
}
// flat-shaded triangle for chunky parts
function ftri(B, a, b, c, m, s, hint) {
  let n = nrm(crs(sub(b, a), sub(c, a)));
  if (hint && dot(n, sub(scl(add(add(a, b), c), 1 / 3), hint)) < 0) { n = scl(n, -1); [b, c] = [c, b]; }
  B.v(a, n, m, s[0], s[1], s[2]); B.v(b, n, m, s[0], s[1], s[2]); B.v(c, n, m, s[0], s[1], s[2]);
}
// a closed lofted tube along y with elliptical sections, smooth
function tube(B, y0, y1, nseg, nring, sec, mat, skin) {
  surface(B, nseg, nring, (i, j) => { const t = j / nring, y = y0 + (y1 - y0) * t, a = (i / nseg) * Math.PI * 2; const [cx, cz, rx, rz] = sec(t, a); return [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz]; }, () => mat, skin, true, (p) => { const [cx, cz] = sec((p[1] - y0) / (y1 - y0), 0); return [cx, p[1], cz]; });
}

export function buildGiantMesh() {
  // An armoured colossus: a great helm with a slit, plate over every limb, a tattered cloak down its back
  // with the hood thrown back, moss and small woods on its shoulders. Iron is G_IRON, the helm G_HELM.
  const B = makeBuf(), R = mulberry(2027);
  const one = (b) => () => [b, b, 0];
  const I = M.G_IRON, Hm = M.G_HELM, C = M.G_ROBE;
  const TAU = Math.PI * 2;
  // an ellipsoid patch: theta from the top, phi round y. `f` may bend each point.
  const shell = (c, r, th0, th1, ph0, ph1, nu, nv, mat, skin, f = null) => {
    const full = Math.abs(ph1 - ph0 - TAU) < 1e-6;
    surface(B, nu, nv, (i, j) => {
      const ph = ph0 + (ph1 - ph0) * (i / nu), th = th0 + (th1 - th0) * (j / nv);
      let p = [Math.sin(th) * Math.cos(ph) * r[0], Math.cos(th) * r[1], Math.sin(th) * Math.sin(ph) * r[2]];
      if (f) p = f(p, i / nu, j / nv);
      return add(c, p);
    }, () => mat, skin, full, () => c);
  };
  // a lofted tube along y: sec(t) -> [cx, cz, rx, rz], with an optional bend f(point, angle, t)
  const loft = (y0, y1, nu, nv, sec, mat, skin, f = null) => surface(B, nu, nv, (i, j) => {
    const t = j / nv, y = y0 + (y1 - y0) * t, a = (i / nu) * TAU, [cx, cz, rx, rz] = sec(t, a);
    let p = [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz];
    if (f) p = f(p, a, t);
    return p;
  }, () => mat, skin, true, (p) => { const t = (p[1] - y0) / (y1 - y0), [cx, cz] = sec(Math.max(0, Math.min(1, t)), 0); return [cx, p[1], cz]; });
  const sm = (a, b, x) => smooth(a, b, x);

  // ---- cuirass: a barrel of plate, a ridge down the front; three lames at the belly
  const cuR = (y) => 250 + 55 * sm(1450, 1950, y) - 15 * sm(1950, 2250, y) - 95 * sm(2250, 2440, y);
  loft(1640, 2440, 20, 12, (t) => { const y = 1640 + 800 * t, r = cuR(y); return [0, 6, r, r * 0.72]; }, I, one(1), (p, a) => { if (Math.sin(a) > 0) p[2] += 20 * Math.exp(-((p[0] / 55) ** 2)); return p; });
  for (let k = 0; k < 3; k++) {
    const y0 = 1440 + k * 72, y1 = y0 + 92;
    loft(y0, y1, 20, 2, (t) => { const r = cuR(y0 + 92 * t) + 14 - 10 * t; return [0, 6, r, r * 0.72]; }, I, () => [0, 1, sm(1400, 1700, y0)]);
  }
  // gorget
  loft(2400, 2520, 16, 2, (t) => [0, 10, 182 - 40 * t, 150 - 30 * t], I, one(1));
  // ---- helm: a rounded skull with a comb over the top, a sculpted face-mask visor, mail hanging behind
  loft(2515, 2870, 20, 6, (t) => [0, 30, 168 - 6 * t, 180 - 8 * t], Hm, one(2));
  shell([0, 2868, 30], [162, 70, 172], 0, Math.PI / 2, 0, TAU, 20, 4, Hm, one(2));
  surface(B, 46, 60, (i, j) => {
    const v = j / 60, x = (-1 + (i / 46) * 2) * maskW(v), y = FACE_Y0 + v * FACE_H;
    return [x, y, maskZ(x, y)];
  }, () => M.G_FACE, one(2), false, (p) => [0, p[1], 30], false);
  surface(B, 20, 4, (i, j) => {
    const a = Math.PI / 2 + 0.78 + (i / 20) * (TAU - 1.56), t = j / 4;
    const wave = 1 + 0.03 * Math.sin(a * 15) * t;
    return [Math.cos(a) * (172 + 50 * t * t) * wave, 2545 - t * 125, 30 + Math.sin(a) * (182 + 42 * t * t) * wave];
  }, () => M.G_MAIL, (i, j) => [2, 1, j / 4], false, (p) => [0, p[1], 30]);
  // the comb: a thin blade over the crown, front to back
  for (const sx of [-1, 1]) surface(B, 1, 14, (i, j) => {
    const u = -1 + (j / 14) * 2, z = 30 + u * 175, top = 2868 + Math.sqrt(Math.max(0, 1 - u * u)) * 70;
    return [sx * 7, top + (i ? 46 * Math.sqrt(Math.max(0, 1 - u * u)) + 4 : -6), z];
  }, () => I, one(2), false, () => [sx * -50, 2900, 30]);
  // ---- pauldrons: a great shell and one lame over each shoulder, a standing flange by the neck
  for (const side of [1, -1]) {
    const sh = REST[side > 0 ? 9 : 12], b = side > 0 ? 9 : 12;
    for (let k = 0; k < 2; k++) {
      const c = add(sh, [side * (40 + k * 8), 60 - k * 95, 0]), r = [235 + k * 18, 175 - k * 12, 220 + k * 16];
      shell(c, r, k === 0 ? 0 : 0.95, 1.3 + k * 0.1, 0, TAU, 18, k === 0 ? 6 : 2, I, () => [b, 1, 0.25]);
    }
    // haute-piece: a curved plate standing up along the inner edge
    surface(B, 12, 2, (i, j) => {
      const u = -1 + (i / 12) * 2, z = u * 165, x = sh[0] - side * (150 - 40 * u * u);
      const y0 = sh[1] + 140 - 60 * u * u, h = (1 - u * u * 0.75) * 120;
      return [x - side * j * 6, y0 + (j / 2) * h, z];
    }, () => I, () => [b, 1, 0.3], false, () => [sh[0] + side * 400, sh[1] + 150, 0]);
  }
  // ---- arms: rerebrace, couter, vambrace, gauntlet
  for (const side of [1, -1]) {
    const sh = REST[side > 0 ? 9 : 12], el = REST[side > 0 ? 10 : 13], wr = REST[side > 0 ? 11 : 14];
    const bU = side > 0 ? 9 : 12, bF = side > 0 ? 10 : 13, bH = side > 0 ? 11 : 14;
    loft(el[1] + 40, sh[1] - 40, 16, 4, (t) => [sh[0], sh[2], 100 + 6 * t, 96 + 6 * t], I, one(bU));
    shell(el, [120, 120, 120], 0.3, 2.6, 0, TAU, 16, 6, I, () => [bU, bF, 0.6], (p) => { p[2] -= Math.max(0, -p[2]) * 0.25; return p; });
    loft(wr[1] + 10, el[1] - 30, 16, 3, (t) => [wr[0], wr[2], 82 + 12 * t, 80 + 12 * t], I, one(bF));
    // the cuff flares over the wrist
    loft(wr[1] - 80, wr[1] + 30, 16, 2, (t) => [wr[0], wr[2], 112 - 26 * t, 108 - 24 * t], I, one(bH));
  }
  // gauntlets: the back of the hand a plate; the right closes round the chain
  const finger = (pts, r0, r1, b, mat) => {
    const n = pts.length - 1, ring = 6;
    surface(B, ring, n, (i, j) => {
      const c = pts[j], nx = pts[Math.min(n, j + 1)], pv = pts[Math.max(0, j - 1)];
      const d = nrm(sub(nx, pv)), u0 = nrm(crs(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), v0 = crs(d, u0);
      const a = (i / ring) * TAU, r = r0 + (r1 - r0) * (j / n);
      return add(c, add(scl(u0, Math.cos(a) * r), scl(v0, Math.sin(a) * r)));
    }, () => mat, () => [b, b, 0], true, (p) => { let best = pts[0], bd = 1e9; for (const q of pts) { const dd = Math.hypot(...sub(p, q)); if (dd < bd) { bd = dd; best = q; } } return best; });
  };
  {
    const wr = REST[14], g = [wr[0] - 10, wr[1] - 175, wr[2]];
    loft(g[1] + 20, wr[1] - 70, 12, 2, () => [wr[0], wr[2], 70, 85], I, one(14));
    for (let k = 0; k < 4; k++) { const y = g[1] + 45 - k * 30, pts = []; for (let q = 0; q <= 6; q++) { const a = -2.2 + (q / 6) * 3.6; pts.push([g[0] + Math.cos(a) * 38, y - q * 1.5, g[2] + Math.sin(a) * 38]); } finger(pts, 17, 13, 14, I); }
    finger([[g[0] + 25, g[1] + 55, g[2] + 32], [g[0] + 32, g[1] + 25, g[2] + 42], [g[0] + 22, g[1] + 5, g[2] + 44]], 17, 13, 14, I);
  }
  {
    const wr = REST[11];
    loft(wr[1] - 170, wr[1] - 70, 12, 2, () => [wr[0], wr[2], 68, 84], I, one(11));
    for (let k = 0; k < 4; k++) { const x = wr[0] + 12, z = wr[2] - 48 + k * 32, y0 = wr[1] - 165; finger([[x, y0, z], [x + 5, y0 - 50, z + 4], [x + 2, y0 - 92 + k * 6, z + 12]], 16, 11, 11, I); }
  }
  // ---- faulds and tassets
  for (let k = 0; k < 2; k++) {
    const y1 = 1450 - k * 70, y0 = y1 - 95;
    loft(y0, y1, 20, 2, (t) => { const r = 300 - 26 * t + k * 12; return [0, 6, r, r * 0.74]; }, I, (i, j) => [0, 0, 0]);
  }
  for (const side of [1, -1]) {
    const hip = REST[side > 0 ? 3 : 6], b = side > 0 ? 3 : 6;
    for (let k = 0; k < 3; k++) {
      const y1 = 1290 - k * 95, y0 = y1 - 115;
      surface(B, 10, 2, (i, j) => {
        const u = i / 10, a = side > 0 ? -0.5 * Math.PI + u * 1.15 * Math.PI : 1.5 * Math.PI - u * 1.15 * Math.PI, t = j / 2, y = y0 + (y1 - y0) * t;
        const r = 150 + k * 6 + 14 * (1 - t);
        return [hip[0] + Math.cos(a) * r, y, hip[2] + Math.sin(a) * r * 0.9 + 10];
      }, () => I, one(b), false, () => [hip[0], 1100, hip[2]]);
    }
  }
  // ---- legs: cuisses, poleyns with a side wing, greaves
  for (const side of [1, -1]) {
    const hip = REST[side > 0 ? 3 : 6], kn = REST[side > 0 ? 4 : 7], an = REST[side > 0 ? 5 : 8];
    const bT = side > 0 ? 3 : 6, bS = side > 0 ? 4 : 7;
    const keel = (a) => Math.exp(-(((Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) / 0.16) ** 2));
    loft(kn[1] + 60, hip[1] - 60, 18, 4, (t) => [hip[0], hip[2], 128 - 10 * (1 - t), 122 - 10 * (1 - t)], I, one(bT), (p, a) => { p[2] += 22 * keel(a); return p; });
    shell(add(kn, [0, 10, 30]), [128, 120, 110], 0.2, 2.5, -0.2, Math.PI + 0.2, 12, 6, I, one(bS));
    shell(add(kn, [side * 105, 0, 10]), [40, 120, 95], 0.3, 2.8, side > 0 ? -1.6 : 1.6, side > 0 ? 1.6 : 4.7, 10, 6, I, one(bS));
    loft(an[1] + 40, kn[1] - 40, 18, 6, (t) => { const calf = Math.exp(-((t - 0.65) ** 2) / 0.05); return [an[0] + (kn[0] - an[0]) * t, 0, 84 + 16 * t + 14 * calf, 88 + 14 * t + 20 * calf]; }, I, one(bS), (p, a) => { p[2] += 26 * keel(a); return p; });
  }
  // ---- sabatons: lames from the heel to a blunt point, the sole flat on the ground
  for (const side of [1, -1]) {
    const an = REST[side > 0 ? 5 : 8], b = side > 0 ? 5 : 8, gy = an[1] - 98;
    const W = (z) => (z < 40 ? 86 + 10 * sm(-120, 40, z) : 96 - 60 * sm(60, 330, z) - 10 * sm(300, 330, z));
    const H = (z) => (z < 20 ? 150 - 25 * sm(-60, 20, z) : 125 - 85 * sm(20, 300, z) - 15 * sm(300, 330, z));
    const lames = [[-125, 10], [0, 70], [60, 120], [110, 165], [155, 210], [200, 255], [245, 300], [290, 335]];
    for (const [z0, z1] of lames) {
      surface(B, 14, 2, (i, j) => {
        const a = (i / 14) * Math.PI, t = j / 2, z = z0 + (z1 - z0) * t;
        const w = W(z) + 6 * (1 - t), h = H(z) + 8 * (1 - t) + 16 * Math.exp(-(((a - Math.PI / 2) / 0.17) ** 2)) * sm(-120, 40, z);
        return [an[0] + Math.cos(a) * w, gy + Math.sin(a) * h + 1, an[2] + z];
      }, () => I, one(b), false, () => [an[0], gy - 50, an[2] + (z0 + z1) / 2]);
    }
    // sole and the toe cap end
    surface(B, 1, 10, (i, j) => { const z = -125 + (j / 10) * 460; return [an[0] + (i ? 1 : -1) * W(z), gy + 1, an[2] + z]; }, () => I, one(b), false, () => [an[0], gy + 100, an[2]]);
    // the heel is closed, so nothing shows inside the boot
    surface(B, 8, 1, (i, j) => { const a = (i / 8) * Math.PI; return j ? [an[0], gy + 2, an[2] - 125] : [an[0] + Math.cos(a) * (W(-125) + 6), gy + Math.sin(a) * (H(-125) + 8) + 1, an[2] - 125]; }, () => I, one(b), false, () => [an[0], gy, an[2] - 40]);
    surface(B, 8, 1, (i, j) => { const a = (i / 8) * Math.PI; return j ? [an[0], gy + 2, an[2] + 338] : [an[0] + Math.cos(a) * W(335), gy + Math.sin(a) * H(335) + 1, an[2] + 335]; }, () => I, one(b), false, () => [an[0], gy, an[2] + 300]);
  }
  // ---- the cloak: down the back from under the pauldrons, ragged, the hood thrown back as a heavy roll
  const CU = 36, CV = 14, cTop = 2400, cHem = 430;
  const cj = Array.from({ length: CU + 1 }, () => (R() - 0.7) * 220);
  const cloakP = (i, j) => {
    const u = i / CU, a = Math.PI - 0.55 + u * (Math.PI + 1.1), t = j / CV;
    let y = cTop - (cTop - cHem) * t;
    if (j === CV) y += cj[i];
    // it hangs close under the pauldrons and flares to a wide ragged hem
    const r = (cuR(Math.max(1450, y)) + 35) * (1 - t) + (400 + 110 * Math.abs(Math.cos(a))) * t * (1 + 0.25 * t * t);
    const fold = 1 + 0.07 * t * Math.sin(a * 11 + 0.6 * Math.sin(a * 4));
    let x = Math.cos(a) * r * fold, z = Math.sin(a) * r * 0.8 * fold - 30 * t;
    if (y > 2200) { const k = sm(2200, 2400, y); x *= 1 + 0.15 * k; }
    return [x, y, z];
  };
  surface(B, CU, CV, cloakP, () => C, (i, j, p) => {
    const y = p[1];
    if (y > 1500) return [1, 1, 0];
    const side = sm(0.1, 0.7, Math.abs(p[0]) / 300);
    return [1, p[0] > 0 ? 3 : 6, Math.min(1, (1500 - y) / 700) * side * 0.8];
  }, false, (p) => [0, p[1], 60]);
  // the hood, down: a thick roll round the back of the neck
  surface(B, 20, 6, (i, j) => {
    const a = Math.PI - 0.9 + (i / 20) * (Math.PI + 1.8), b = (j / 6) * TAU;
    const rr = 230 + Math.cos(b) * 62, y = 2445 + Math.sin(b) * 55;
    return [Math.cos(a) * rr, y, Math.sin(a) * rr * 0.85 + 5];
  }, () => C, one(1), false, () => [0, 2445, 0]);
  // ---- woods and moss on the pauldrons and the crown of the helm
  const RT = mulberry(9);
  const tree = (x, y, z, h, b) => {
    const w = h * 0.34, base = [x, y - 4, z], tip = [x, y + h, z];
    for (let k = 0; k < 4; k++) { const a0 = (k / 4) * TAU + RT(), a1 = a0 + Math.PI / 2; ftri(B, add(base, [Math.cos(a0) * w, 0, Math.sin(a0) * w]), add(base, [Math.cos(a1) * w, 0, Math.sin(a1) * w]), tip, M.G_TREE, [b, b, 0], [x, y - 20, z]); }
  };
  for (const side of [1, -1]) {
    const sh = REST[side > 0 ? 9 : 12], c = add(sh, [side * 40, 60, 0]), b = side > 0 ? 9 : 12;
    for (let k = 0; k < 70; k++) {
      const th = RT() * 0.95, ph = RT() * TAU;
      const p = add(c, [Math.sin(th) * Math.cos(ph) * 233, Math.cos(th) * 173, Math.sin(th) * Math.sin(ph) * 218]);
      tree(p[0], p[1], p[2], 18 + RT() * 26, b);
    }
  }
  return { data: B.data };
}

// ------------------------------------------------------------------------------------------------ pose
// 4x4 column-major helpers
function m4(R, p) { // rotation columns X, Y, Z and translation
  return [R[0][0], R[0][1], R[0][2], 0, R[1][0], R[1][1], R[1][2], 0, R[2][0], R[2][1], R[2][2], 0, p[0], p[1], p[2], 1];
}
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, -s], [0, 1, 0], [s, 0, c]]; }
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; }
function mulR(A, Bm) { // A*B, both as column arrays
  const col = (v) => [A[0][0] * v[0] + A[1][0] * v[1] + A[2][0] * v[2], A[0][1] * v[0] + A[1][1] * v[1] + A[2][1] * v[2], A[0][2] * v[0] + A[1][2] * v[1] + A[2][2] * v[2]];
  return [col(Bm[0]), col(Bm[1]), col(Bm[2])];
}
const apply = (Rm, v) => [Rm[0][0] * v[0] + Rm[1][0] * v[1] + Rm[2][0] * v[2], Rm[0][1] * v[0] + Rm[1][1] * v[1] + Rm[2][1] * v[2], Rm[0][2] * v[0] + Rm[1][2] * v[1] + Rm[2][2] * v[2]];
// a frame whose -Y runs along dir and whose Z leans toward pole
function limbFrame(dir, pole) {
  const Y = scl(nrm(dir), -1);
  let Z = sub(pole, scl(Y, dot(pole, Y)));
  if (Math.hypot(...Z) < 1e-4) Z = [0, 0, 1];
  Z = nrm(Z);
  const X = crs(Y, Z);
  return [X, Y, Z];
}
// two-bone IK: from root toward target, segment lengths a, b, bending toward pole. `cap` (radians) is the
// most the joint may bend: nearer than that allows, the joint is placed as if the reach were longer, so the
// limb reads as nearly straight and the far segment gives a little (a colossus does not fold its knee)
function ik(root, target, a, b, pole, cap = 0) {
  let d = sub(target, root); let L = Math.hypot(...d);
  const maxL = (a + b) * 0.999; if (L > maxL) { d = scl(d, maxL / L); L = maxL; }
  const u = nrm(d);
  let v = sub(pole, scl(u, dot(pole, u))); v = Math.hypot(...v) < 1e-5 ? [0, 0, 1] : nrm(v);
  const Lc = cap > 0 ? Math.max(L, Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(Math.PI - cap))) : L;
  const ca = Math.max(-1, Math.min(1, (a * a + Lc * Lc - b * b) / (2 * a * Lc))), sa = Math.sqrt(1 - ca * ca);
  const mid = add(root, add(scl(u, a * ca), scl(v, a * sa)));
  return { mid, end: add(root, d) };
}
const KNEE_CAP = 35 * Math.PI / 180;

export function createGiant() {
  const bones = new Float32Array(16 * 16);
  const W = {}; // world positions of interest, refreshed each pose()
  // state the director sets each frame
  const G = {
    x: -4200, z: -900, yaw: Math.PI / 2,
    feet: [{ p: [0, 0, 0], yaw: 0, pitch: 0 }, { p: [0, 0, 0], yaw: 0, pitch: 0 }], // L, R: ankle on the ground, yaw, toe pitch
    pelvisDrop: 0, lean: 0.12, twist: 0, roll: 0, headPitch: 0.15, headYaw: 0, headLook: null,
    handR: null, handL: null, sway: [0, 0, 0], t: 0,
    W, bones,
  };
  function setBone(i, R, p) {
    // skin matrix = [R | p] * T(-REST)
    const r = REST[i], t = [p[0] - apply(R, r)[0], p[1] - apply(R, r)[1], p[2] - apply(R, r)[2]];
    bones.set(m4(R, t), i * 16);
  }
  function pose() {
    const root = rotY(G.yaw);
    const toW = (v) => { const r = apply(root, v); return [r[0] + G.x, r[1], r[2] + G.z]; };
    const fwd = apply(root, [0, 0, 1]), leftV = apply(root, [1, 0, 0]);
    // pelvis: between the feet, as high as both legs allow
    const fL = G.feet[0].p, fR = G.feet[1].p;
    const mid = [(fL[0] + fR[0]) / 2, 0, (fL[2] + fR[2]) / 2];
    const pelR = mulR(root, mulR(rotY(G.twist), rotZ(G.roll)));
    let px = mid[0] + fwd[0] * 40, pz = mid[2] + fwd[2] * 40;
    if (G.pelvisAt) { px = G.pelvisAt[0]; pz = G.pelvisAt[2]; }
    let py = 1350 - G.pelvisDrop;
    const reach = (THIGH + SHIN) * 0.995;   // the planted leg stands nearly straight
    for (const [k, f] of [[3, fL], [6, fR]]) {
      const hip = add([px, 0, pz], apply(pelR, sub(REST[k], [0, 0, 0])));
      const dh = Math.hypot(hip[0] - f[0], hip[2] - f[2]);
      const maxY = f[1] + 98 + Math.sqrt(Math.max(0, reach * reach - dh * dh)) - REST[k][1] + 1350 - 20;
      py = Math.min(py, maxY);
    }
    const pel = [px, py, pz];
    G.pelvis = pel;
    setBone(0, pelR, pel);
    // chest: lean forward and twist
    const chestR = mulR(pelR, mulR(rotX(G.lean), rotY(-G.twist * 1.6)));
    const chestJ = add(pel, apply(pelR, sub(REST[1], REST[0])));
    setBone(1, chestR, chestJ);
    // head: from the chest, pitched down, turned
    const neck = add(chestJ, apply(chestR, sub(REST[2], REST[1])));
    let headR = mulR(chestR, mulR(rotY(G.headYaw), rotX(G.headPitch)));
    if (G.headLook) {
      // turn toward the target, but only as far as a neck allows: yaw and pitch in the chest's frame
      const d = nrm(sub(G.headLook, neck));
      const cx = [chestR[0][0], chestR[0][1], chestR[0][2]], cy = [chestR[1][0], chestR[1][1], chestR[1][2]], cz = [chestR[2][0], chestR[2][1], chestR[2][2]];
      const lx = dot(d, cx), ly = dot(d, cy), lz = dot(d, cz);
      const yaw = Math.max(-1.0, Math.min(1.0, Math.atan2(lx, lz)));
      const pitch = Math.max(-0.3, Math.min(1.25, Math.atan2(-ly, Math.hypot(lx, lz))));
      headR = mulR(chestR, mulR(rotY(yaw), rotX(pitch)));
    }
    setBone(2, headR, neck);
    W.neck = neck; W.head = add(neck, apply(headR, [0, 190, 40]));
    const er = sub(EYE_REST, REST[2]);
    W.eyes = [add(neck, apply(headR, [-er[0], er[1], er[2]])), add(neck, apply(headR, er))];
    W.headR = headR;
    // legs
    for (const [s, hb, f] of [[0, 3, G.feet[0]], [1, 6, G.feet[1]]]) {
      const hip = add(pel, apply(pelR, sub(REST[hb], REST[0])));
      const ankle = add(f.p, [0, 98, 0]);
      const footFwd = [Math.sin(f.yaw), 0, Math.cos(f.yaw)];
      const pole = add(footFwd, [0, 0.15, 0]);
      const sol = ik(hip, ankle, THIGH, SHIN, pole, KNEE_CAP);
      setBone(hb, limbFrame(sub(sol.mid, hip), pole), hip);
      setBone(hb + 1, limbFrame(sub(sol.end, sol.mid), pole), sol.mid);
      const footR = mulR(rotY(f.yaw), rotX(-f.pitch));
      setBone(hb + 2, footR, sol.end);
      W[s ? 'ankleR' : 'ankleL'] = sol.end;
      W[s ? 'toeR' : 'toeL'] = add(sol.end, apply(footR, [0, -98, 300]));
      W[s ? 'heelR' : 'heelL'] = add(sol.end, apply(footR, [0, -98, -110]));
      W[s ? 'kneeR' : 'kneeL'] = sol.mid; W[s ? 'hipR' : 'hipL'] = hip;
    }
    // arms
    for (const [s, sb] of [[0, 9], [1, 12]]) {
      const sh = add(chestJ, apply(chestR, sub(REST[sb], REST[1])));
      const side = s ? -1 : 1;
      let target = s ? G.handR : G.handL;
      if (!target) target = add(sh, add(scl(leftV, side * 70), add([0, -(UPPER + FORE - 60), 0], scl(fwd, 80))));
      const pole = add(apply(chestR, [side * 0.5, -0.2, -1]), [0, 0, 0]);
      const sol = ik(sh, target, UPPER, FORE, pole);
      setBone(sb, limbFrame(sub(sol.mid, sh), pole), sh);
      const foreR = limbFrame(sub(sol.end, sol.mid), pole);
      setBone(sb + 1, foreR, sol.mid);
      setBone(sb + 2, foreR, sol.end);
      W[s ? 'handR' : 'handL'] = sol.end;
      W[s ? 'gripR' : 'gripL'] = add(sol.end, apply(foreR, [-10, -175, 0]));
      W[s ? 'shoulderR' : 'shoulderL'] = sh;
    }
    W.chest = chestJ; W.chestR = chestR; W.root = [G.x, 0, G.z]; W.fwd = fwd; W.left = leftV;
    // the wind: the cloak's hem drifts to the side and trails behind, in slow gusts (the skin shader
    // applies it to the lower rows of the robe)
    const t = G.t, gust = Math.sin(t * 0.43) * 0.5 + 0.5;
    G.sway = add(scl(leftV, 45 * Math.sin(t * 0.61) + 18 * Math.sin(t * 1.7 + 1.0) * gust), scl(fwd, -30 - 35 * gust + 12 * Math.sin(t * 1.1)));
    void toW;
  }
  G.pose = pose;
  return G;
}

// ------------------------------------------------------------------------------------------------ walking
// A step plan: alternating plants. Each plant = {foot: 0|1, x, z, yaw, t} where t is when it lands.
export function footAt(plan, foot, t, swing) {
  const ps = plan.filter((p) => p.foot === foot);
  let prev = ps[0];
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i];
    if (t >= p.t) { prev = p; continue; }
    const t0 = p.t - swing;
    if (t <= t0) return { p: [prev.x, 0, prev.z], yaw: prev.yaw, pitch: 0, swing: 0, from: prev, to: p };
    const s = (t - t0) / swing;
    const e = s * s * (3 - 2 * s);
    // a colossus does not step: the foot rises a little in the first fifth of the swing, glides flat and low,
    // and settles in the last fifth, so the knee barely bends
    // (a plant may name its own lift: the steps over the town clear the church tower)
    const lift = (p.lift ?? (LIFT0 + Math.hypot(p.x - prev.x, p.z - prev.z) * LIFT_K)) * sm0(0, 0.2, s) * (1 - sm0(0.8, 1, s));
    const pitch = s < 0.3 ? -PITCH_UP * Math.sin((s / 0.3) * Math.PI * 0.5) : s < 0.8 ? -PITCH_UP + (PITCH_UP + PITCH_DOWN) * ((s - 0.3) / 0.5) : PITCH_DOWN * (1 - (s - 0.8) / 0.2);
    const yaw = prev.yaw + Math.atan2(Math.sin(p.yaw - prev.yaw), Math.cos(p.yaw - prev.yaw)) * e;
    return { p: [prev.x + (p.x - prev.x) * e, lift, prev.z + (p.z - prev.z) * e], yaw, pitch, swing: s, from: prev, to: p };
  }
  return { p: [prev.x, 0, prev.z], yaw: prev.yaw, pitch: 0, swing: 0, from: prev, to: null };
}
