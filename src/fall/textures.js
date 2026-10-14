// UNDERFOOT — baked textures: tileable noise, and two ground maps (near: 1 m texels over the town square;
// far: 18 m texels over the whole valley) that tell the terrain shader where streets, roads, fields,
// woods and water are.
import { texture } from '../lib/gl.js';
import { mulberry, smooth, clamp } from '../lib/noise.js';
const R0 = 0;
import { NEAR, height, normalAt, riverDist, RIVER_W, roadDist, streetDist, townR, forest, houses, wallSegs, towers, CHURCH, TOWN } from './world.js';

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
  for (let z = -CHURCH.d / 2; z <= CHURCH.d / 2 + 6; z += 2) for (const sx of [-1, 1]) stamp(CHURCH.x + sx * (CHURCH.w / 2 + 1), CHURCH.z + z, 3, 0.7);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -NEAR + (i + 0.5) * k, z = -NEAR + (j + 0.5) * k, o = (j * S + i) * 4;
    const inTown = townR(x, z) < 1.02;
    const st = streetDist(x, z);
    d[o] = inTown ? Math.round(clamp(1 - (st + 0.5) / 1.6) * 255) : 0;
    d[o + 1] = Math.round(clamp(ao[j * S + i]) * 255);
    const rd = roadDist(x, z);
    d[o + 2] = !inTown ? Math.round(clamp(1 - (rd - 1.6) / 2.2) * 255) : 0;
    d[o + 3] = Math.round(clamp((RIVER_W + 0.5 - riverDist(x, z)) / 2.5) * 255);
  }
  return texture(gl, S, S, { data: d, filter: 'linear' });
}

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
