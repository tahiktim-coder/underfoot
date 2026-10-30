// UNDERFOOT — baked textures: tileable noise, and two ground maps (near: 1 m texels over the town square;
// far: 18 m texels over the whole valley) that tell the terrain shader where streets, roads, fields,
// woods and water are.
import { texture, upload } from '../lib/gl.js';
import { mulberry, smooth, clamp } from '../lib/noise.js';
const R0 = 0;
import { NEAR, height, normalAt, riverDist, RIVER_W, roadDist, streetAt, townR, forest, houses, wallSegs, towers, lowWalls, chapels, ruinWallList, CHURCH, TOWN } from './world.js';

export function noiseTex(gl) {
  const S = 256, d = new Uint8Array(S * S * 4), R = mulberry(99);
  const lat = (P) => { const a = new Float32Array(P * P); for (let i = 0; i < a.length; i++) a[i] = R(); return a; };
  const L = [lat(32), lat(64), lat(128)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4;
    [32, 64, 128].forEach((P, c) => {
      const f = P / S, fx = x * f, fy = y * f, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), g = L[c], at = (i, j) => g[((j % P + P) % P) * P + ((i % P + P) % P)];
      d[o + c] = Math.round((at(ix, iy) * (1 - su) * (1 - sv) + at(ix + 1, iy) * su * (1 - sv) + at(ix, iy + 1) * (1 - su) * sv + at(ix + 1, iy + 1) * su * sv) * 255);
    });
    d[o + 3] = Math.floor(R() * 256);
  }
  return texture(gl, S, S, { data: d, filter: 'linear', wrap: 'repeat' });
}

export function nearMap(gl) {
  const S = 512, k = (NEAR * 2) / S, d = new Uint8Array(S * S * 4);
  const ao = new Float32Array(S * S);
  const stamp = (x, z, r, a) => {
    const ci = (x + NEAR) / k, cj = (z + NEAR) / k, rr = r / k;
    for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
      if (i < 0 || j < 0 || i >= S || j >= S) continue;
      const dd = Math.hypot(i - ci, j - cj) / rr; if (dd < 1) ao[j * S + i] = Math.max(ao[j * S + i], a * (1 - dd * dd));
    }
  };
  for (const H of houses) { const c = Math.cos(H.rot), s = Math.sin(H.rot); for (let a = -0.5; a <= 0.5; a += 0.125) for (const b of [-0.5, 0.5]) { stamp(H.x + a * H.w * c + b * H.d * s, H.z - a * H.w * s + b * H.d * c, 2.4, 0.7); stamp(H.x + b * H.w * c + a * H.d * s, H.z - b * H.w * s + a * H.d * c, 2.4, 0.7); } }
  for (const W of wallSegs) for (let t = 0; t <= 1; t += 0.25) stamp(W.a[0] + (W.b[0] - W.a[0]) * t, W.a[1] + (W.b[1] - W.a[1]) * t, 3, 0.6);
  for (const T of towers) stamp(T.x, T.z, (T.r || 5) + 2.5, 0.7);
  if (CHURCH) { const c = Math.cos(CHURCH.rot), s = Math.sin(CHURCH.rot); for (let z = -CHURCH.d / 2; z <= CHURCH.d / 2 + 6; z += 2) for (const sx of [-1, 1]) { const lx = sx * (CHURCH.w / 2 + 1); stamp(CHURCH.x + lx * c + z * s, CHURCH.z - lx * s + z * c, 3, 0.7); } }
  for (const W of lowWalls) for (let t = 0; t <= 1; t += 0.25) stamp(W.a[0] + (W.b[0] - W.a[0]) * t, W.a[1] + (W.b[1] - W.a[1]) * t, 1.6, 0.4);
  for (const C of [...chapels, ...ruinWallList]) stamp(C.x, C.z, Math.max(C.w, C.d) / 2 + 2, 0.5);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -NEAR + (i + 0.5) * k, z = -NEAR + (j + 0.5) * k, o = (j * S + i) * 4;
    const inTown = townR(x, z) < 1.02;
    d[o] = inTown ? Math.round(clamp(streetAt(x, z)) * 255) : 0;
    d[o + 1] = Math.round(clamp(ao[j * S + i]) * 255);
    const rd = roadDist(x, z);
    d[o + 2] = !inTown ? Math.round(clamp(1 - (rd - 1.6) / 2.2) * 255) : 0;
    d[o + 3] = Math.round(clamp((RIVER_W + 0.5 - riverDist(x, z)) / 2.5) * 255);
  }
  return texture(gl, S, S, { data: d, filter: 'linear' });
}

// Where lit windows throw light on the ground: a band round each house (1 at the wall, gone 3 m out), with
// the house's slot in R so the terrain shader lights it only while that house's windows are lit, and the
// strength in G. 1 m texels over the same square as the near map, unfiltered so a slot never blends.
export function poolMap(gl) {
  const S = 512, k = (NEAR * 2) / S, d = new Uint8Array(S * S * 2);
  for (const H of houses) {
    if (H.barn) continue;
    const c = Math.cos(H.rot), sn = Math.sin(H.rot), r = Math.hypot(H.w, H.d) / 2 + 5;
    for (let j = Math.floor((H.z - r + NEAR) / k); j <= Math.ceil((H.z + r + NEAR) / k); j++) for (let i = Math.floor((H.x - r + NEAR) / k); i <= Math.ceil((H.x + r + NEAR) / k); i++) {
      if (i < 0 || j < 0 || i >= S || j >= S) continue;
      const px = -NEAR + (i + 0.5) * k - H.x, pz = -NEAR + (j + 0.5) * k - H.z;
      const lx = px * c - pz * sn, lz = px * sn + pz * c;
      const dd = Math.hypot(Math.max(0, Math.abs(lx) - H.w / 2), Math.max(0, Math.abs(lz) - H.d / 2));
      const st = 1 - smooth(0.3, 3.4, dd);
      if (st <= 0) continue;
      const o = (j * S + i) * 2;
      if (st * 255 > d[o + 1]) { d[o] = H.i; d[o + 1] = Math.round(st * 255); }
    }
  }
  return texture(gl, S, S, { data: d, fmt: 'rg8', filter: 'nearest' });
}

// The stains: where the light took someone. A map of 0.5 m texels over the near square, empty at start,
// written at run time: 255 inside the stain, 110 in the scorched ring round it. The terrain shader reads it.
export const STAIN_S = 1024;
export function stainMap(gl) {
  return texture(gl, STAIN_S, STAIN_S, { data: new Uint8Array(STAIN_S * STAIN_S), fmt: 'r8', filter: 'linear' });
}
// (peak below 0.5 is a pressed print: the ground darkened, no burn in the middle; a stamp only ever darkens,
// so a wide print never wipes the stains under it: the map is mirrored here)
const STAIN_MIR = new Uint8Array(STAIN_S * STAIN_S);
export function stampStain(gl, t, x, z, r = 1.5, rnd = Math.random, peak = 1) {
  const k = (NEAR * 2) / STAIN_S, R = r * 2.1, n = Math.ceil(R / k) * 2 + 2;
  const i0 = Math.max(0, Math.floor((x - R + NEAR) / k)), j0 = Math.max(0, Math.floor((z - R + NEAR) / k));
  const w = Math.min(n, STAIN_S - i0), h = Math.min(n, STAIN_S - j0);
  if (w <= 0 || h <= 0) return;
  const d = new Uint8Array(w * h);
  const lobes = [[0, 0, r]]; for (let q = 0; q < 3; q++) { const a = rnd() * 6.28, rr = r * (0.4 + rnd() * 0.5); lobes.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, rr]); }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = -NEAR + (i0 + i + 0.5) * k - x, pz = -NEAR + (j0 + j + 0.5) * k - z;
    let inside = false; for (const [lx, lz, lr] of lobes) if (Math.hypot(px - lx, pz - lz) < lr) inside = true;
    const dd = Math.hypot(px, pz);
    const idx = (j0 + j) * STAIN_S + (i0 + i), v = Math.max(STAIN_MIR[idx], Math.round((inside ? 255 : dd < R ? 110 : 0) * peak));
    STAIN_MIR[idx] = v; d[j * w + i] = v;
  }
  upload(gl, t, d, i0, j0, w, h);
}
export function clearStains(gl, t) { STAIN_MIR.fill(0); upload(gl, t, new Uint8Array(STAIN_S * STAIN_S)); }

export function farMap(gl) {
  const S = 512, H = 9216, k = (H * 2) / S, d = new Uint8Array(S * S * 4);
  const nb = S + 2, Hg = new Float32Array(nb * nb);
  for (let j = 0; j < nb; j++) for (let i = 0; i < nb; i++) Hg[j * nb + i] = height(-H + (i - 0.5) * k, -H + (j - 0.5) * k);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -H + (i + 0.5) * k, z = -H + (j + 0.5) * k, o = (j * S + i) * 4;
    const r = Math.hypot(x, z);
    const y = Hg[(j + 1) * nb + i + 1];
    const dx = (Hg[(j + 1) * nb + i + 2] - Hg[(j + 1) * nb + i]) / (2 * k), dz = (Hg[(j + 2) * nb + i + 1] - Hg[j * nb + i + 1]) / (2 * k);
    const ny = 1 / Math.hypot(dx, 1, dz);
    const rd = r < 3200 ? roadDist(x, z) : 1e9;
    d[o] = Math.round(clamp(1 - (rd - 3) / 14) * 255);
    const fo = smooth(0.55, 0.62, forest(x, z)) * (1 - smooth(900, 1300, y));
    d[o + 1] = Math.round(fo * 255);
    let farm = smooth(100, 150, r) * (1 - smooth(1900, 3000, r)) * smooth(0.95, 0.985, ny) * (1 - fo) * smooth(18, 34, riverDist(x, z)) * (1 - smooth(60, 160, y));
    farm *= townR(x, z) > 1.25 ? 1 : 0;
    d[o + 2] = Math.round(clamp(farm) * 255);
    d[o + 3] = Math.round(clamp((RIVER_W + 6 - riverDist(x, z)) / 12) * 255);
  }
  return texture(gl, S, S, { data: d, filter: 'linear' });
}
void TOWN; void normalAt; void R0;
