// UNDERFOOT — static geometry. Flat-shaded triangles in world space, sorted into chunks with bounding boxes
// so each pass draws only what its camera can see. Vertex: position 3, normal 3, material 1, uv 2, seed 1.
import { NEAR, height, houses, towers, wallSegs, trees, props, CHURCH, HALL, WELL, MILL, BRIDGE, TOWN, houseKey } from './world.js';
import { mulberry } from '../lib/noise.js';

export const STRIDE = 10;
// Material ids: each is a branch in FS_MESH (shaders.js) that decides albedo, emission and colour.
export const M = {
  TERRAIN: 0, PLASTER: 1, PLASTER_FRONT: 2, TIMBER: 3, SHINGLE: 4, TILE: 5, SLATE: 6, STONE: 7, STONE_FRONT: 8, DARK: 9,
  STONE_HOUSE: 10, PINE: 11, BROAD: 12, BARK: 13, HAY: 14, PLANK: 15, SAIL: 16, IRON: 17, WALLTOP: 19, CHURCH: 20,
  // the giant
  G_ROBE: 30, G_ROBE_IN: 31, G_WRAP: 32, G_SKIN: 33, G_NAIL: 34, G_HOOD_IN: 35, G_EYE: 36, G_CHAIN: 37, G_GLASS: 38, G_CAGE: 39, G_FLAME: 40, G_TREE: 41, G_MANTLE: 42, G_IRON: 43, G_HELM: 44, G_FACE: 45, G_MAIL: 46,
  // people
  P_CLOAK: 50, P_SCARF: 51, P_SKIN: 52, P_DARK: 53, P_LIGHT: 54, P_HOOD: 55, P_OUTLINE: 56, P_RING: 57, P_ARMOUR: 58, P_CAPE: 59,
};

export function makeArr(cap = 4096) {
  let a = new Float32Array(cap), n = 0, mark = -1;
  return {
    push10(x, y, z, nx, ny, nz, m, u, v, s) {
      if (n + 10 > a.length) { const b = new Float32Array(a.length * 2); b.set(a); a = b; }
      a[n++] = x; a[n++] = y; a[n++] = z; a[n++] = nx; a[n++] = ny; a[n++] = nz; a[n++] = m; a[n++] = u; a[n++] = v; a[n++] = s;
    },
    get n() { return n; }, get data() { return a.subarray(0, n); }, reset() { n = 0; mark = -1; },
    // everything pushed after hull() is an inverted hull (an outline): the renderer draws it with its front
    // faces culled, and leaves it out of the shadow maps
    hull() { mark = n; }, get hull0() { return mark < 0 ? n : mark; },
  };
}
export function tri(A, a, b, c, m, ta, tb, tc, s, hint) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
  nx /= l; ny /= l; nz /= l;
  let flip = false;
  if (hint) {
    const cx = (a[0] + b[0] + c[0]) / 3 - hint[0], cy = (a[1] + b[1] + c[1]) / 3 - hint[1], cz = (a[2] + b[2] + c[2]) / 3 - hint[2];
    if (nx * cx + ny * cy + nz * cz < 0) { nx = -nx; ny = -ny; nz = -nz; flip = true; }
  }
  A.push10(a[0], a[1], a[2], nx, ny, nz, m, ta[0], ta[1], s);
  if (flip) { A.push10(c[0], c[1], c[2], nx, ny, nz, m, tc[0], tc[1], s); A.push10(b[0], b[1], b[2], nx, ny, nz, m, tb[0], tb[1], s); }
  else { A.push10(b[0], b[1], b[2], nx, ny, nz, m, tb[0], tb[1], s); A.push10(c[0], c[1], c[2], nx, ny, nz, m, tc[0], tc[1], s); }
}
export function quad(A, a, b, c, d, m, ta, tb, tc, td, s, hint) { tri(A, a, b, c, m, ta, tb, tc, s, hint); tri(A, a, c, d, m, ta, tc, td, s, hint); }
export function frame(x, y, z, rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
}
export function box(A, P, x0, y0, z0, x1, y1, z1, mat, seed = 0, skipBottom = true) {
  const mS = typeof mat === 'object' ? mat.side : mat, mT = typeof mat === 'object' ? (mat.top ?? mS) : mat, mF = typeof mat === 'object' ? (mat.front ?? mS) : mat;
  const c = P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = P, W = x1 - x0, D = z1 - z0;
  quad(A, p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), mF, [0, y0], [W, y0], [W, y1], [0, y1], seed, c);
  quad(A, p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), mS, [0, y0], [W, y0], [W, y1], [0, y1], seed, c);
  quad(A, p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), mS, [0, y0], [D, y0], [D, y1], [0, y1], seed, c);
  quad(A, p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), mS, [0, y0], [D, y0], [D, y1], [0, y1], seed, c);
  quad(A, p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), mT, [x0, z1], [x1, z1], [x1, z0], [x0, z0], seed, c);
  if (!skipBottom) quad(A, p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), mS, [x0, z0], [x1, z0], [x1, z1], [x0, z1], seed, c);
}
export function cyl(A, P, cx, y0, cz, r0, y1, r1, sides, mat, seed = 0, caps = true, jit = null) {
  const c = P(cx, (y0 + y1) / 2, cz);
  const ring = (y, r, k) => { const a = (k / sides) * Math.PI * 2; const rr = r * (jit ? jit(k, y) : 1); return P(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr); };
  for (let k = 0; k < sides; k++) {
    const a0 = ring(y0, r0, k), a1 = ring(y0, r0, k + 1), b0 = ring(y1, r1, k), b1 = ring(y1, r1, k + 1);
    const u0 = (k / sides) * Math.PI * 2 * r0, u1 = ((k + 1) / sides) * Math.PI * 2 * r0;
    if (r1 < 1e-4) tri(A, a0, a1, b0, mat, [u0, y0], [u1, y0], [(u0 + u1) / 2, y1], seed, c);
    else quad(A, a0, a1, b1, b0, mat, [u0, y0], [u1, y0], [u1, y1], [u0, y1], seed, c);
    if (caps && r1 > 1e-4) tri(A, b0, b1, P(cx, y1, cz), mat, [0, 0], [1, 0], [0.5, 0.5], seed, P(cx, y0 - 1, cz));
  }
}

// ---------------------------------------------------------------------------------------------- the town
function house(A, H) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const c = Math.cos(H.rot), s = Math.sin(H.rot); return height(H.x + (a * H.w / 2) * c + (b * H.d / 2) * s, H.z - (a * H.w / 2) * s + (b * H.d / 2) * c); });
  const gy = Math.min(...corners), gmax = Math.max(...corners);
  const P = frame(H.x, gy, H.z, H.rot);
  const { w, d, h } = H, hw = w / 2, hd = d / 2;
  const R = mulberry(Math.floor(H.seed * 1e6) + 3);
  const plinth = gmax - gy + 0.45;
  box(A, P, -hw - 0.15, -0.8, -hd - 0.15, hw + 0.15, plinth, hd + 0.15, M.STONE, H.seed);
  const floor = plinth + 2.5, top = plinth + h - 0.4;
  const wallM = H.stone || H.barn ? M.STONE_HOUSE : M.PLASTER, frontM = H.stone || H.barn ? M.STONE_HOUSE : M.PLASTER_FRONT;
  const enc = (L, hh) => Math.floor(L * 10) * 100 + Math.floor(hh * 10) + houseKey(H);
  const jet = H.jetty && !H.stone ? 0.4 : 0;
  const wallBox = (y0, y1, zf, zb, fM) => {
    const c = P(0, (y0 + y1) / 2, (zf + zb) / 2), D = zf - zb, hh = top - plinth;
    quad(A, P(-hw, y0, zf), P(hw, y0, zf), P(hw, y1, zf), P(-hw, y1, zf), fM, [0, y0 - plinth], [w, y0 - plinth], [w, y1 - plinth], [0, y1 - plinth], enc(w, hh), c);
    quad(A, P(hw, y0, zb), P(-hw, y0, zb), P(-hw, y1, zb), P(hw, y1, zb), wallM, [0, y0 - plinth], [w, y0 - plinth], [w, y1 - plinth], [0, y1 - plinth], enc(w, hh), c);
    quad(A, P(hw, y0, zf), P(hw, y0, zb), P(hw, y1, zb), P(hw, y1, zf), wallM, [0, y0 - plinth], [D, y0 - plinth], [D, y1 - plinth], [0, y1 - plinth], enc(D, hh), c);
    quad(A, P(-hw, y0, zb), P(-hw, y0, zf), P(-hw, y1, zf), P(-hw, y1, zb), wallM, [0, y0 - plinth], [D, y0 - plinth], [D, y1 - plinth], [0, y1 - plinth], enc(D, hh), c);
  };
  if (H.barn) wallBox(plinth, top, hd, -hd, frontM);
  else { wallBox(plinth, floor, hd, -hd, frontM); wallBox(floor, top, hd + jet, -hd, wallM); }
  if (jet) box(A, P, -hw, floor - 0.22, hd, hw, floor, hd + jet, M.TIMBER, H.seed);
  const roofM = H.tile ? M.TILE : M.SHINGLE;
  const pitch = H.barn ? 0.9 : 1.2 + R() * 0.3, ov = 0.5, ovG = 0.35;
  const zf = hd + jet, interior = P(0, top * 0.5, 0);
  if (H.gableFront) {
    const rise = hw * pitch, yr = top + rise;
    tri(A, P(-hw, top, zf), P(hw, top, zf), P(0, yr, zf), wallM, [0, top - plinth], [w, top - plinth], [hw, yr - plinth], enc(w, top - plinth), interior);
    tri(A, P(hw, top, -hd), P(-hw, top, -hd), P(0, yr, -hd), wallM, [0, top - plinth], [w, top - plinth], [hw, yr - plinth], enc(w, top - plinth), interior);
    const ye = top - ov * pitch, slope = Math.hypot(hw + ov, rise + ov * pitch), zA = zf + ovG, zB = -hd - ovG, L = zA - zB;
    quad(A, P(-hw - ov, ye, zA), P(0, yr, zA), P(0, yr, zB), P(-hw - ov, ye, zB), roofM, [0, slope], [0, 0], [L, 0], [L, slope], H.seed, interior);
    quad(A, P(0, yr, zA), P(hw + ov, ye, zA), P(hw + ov, ye, zB), P(0, yr, zB), roofM, [0, 0], [0, slope], [L, slope], [L, 0], H.seed, interior);
    for (const zz of [zA, zB]) {
      quad(A, P(-hw - ov, ye, zz), P(0, yr, zz), P(0, yr - 0.3, zz), P(-hw - ov, ye - 0.3, zz), M.TIMBER, [0, 0], [1, 0], [1, 1], [0, 1], H.seed, P(0, yr * 0.5, 0));
      quad(A, P(0, yr, zz), P(hw + ov, ye, zz), P(hw + ov, ye - 0.3, zz), P(0, yr - 0.3, zz), M.TIMBER, [0, 0], [1, 0], [1, 1], [0, 1], H.seed, P(0, yr * 0.5, 0));
    }
    if (H.chimney) { const cx = -hw * 0.4, cz = -hd * 0.3; box(A, P, cx - 0.45, top + (hw - Math.abs(cx)) * pitch - 0.5, cz - 0.45, cx + 0.45, yr + 1.0, cz + 0.45, M.STONE, H.seed); H.chimneyTop = P(cx, yr + 1.1, cz); }
    H.ridgeY = yr;
  } else {
    const rise = (d / 2) * pitch * 0.92, zc = (zf - hd) / 2, half = (zf + hd) / 2, yr = top + rise;
    tri(A, P(hw, top, zf), P(hw, top, -hd), P(hw, yr, zc), wallM, [0, top - plinth], [d, top - plinth], [half, yr - plinth], enc(d, top - plinth), interior);
    tri(A, P(-hw, top, -hd), P(-hw, top, zf), P(-hw, yr, zc), wallM, [0, top - plinth], [d, top - plinth], [half, yr - plinth], enc(d, top - plinth), interior);
    const ye = top - ov * pitch * 0.92, slope = Math.hypot(half + ov, rise + ov * pitch), xA = -hw - ovG, xB = hw + ovG, L = xB - xA;
    quad(A, P(xA, ye, zf + ov), P(xB, ye, zf + ov), P(xB, yr, zc), P(xA, yr, zc), roofM, [0, slope], [L, slope], [L, 0], [0, 0], H.seed, interior);
    quad(A, P(xB, ye, -hd - ov), P(xA, ye, -hd - ov), P(xA, yr, zc), P(xB, yr, zc), roofM, [L, slope], [0, slope], [0, 0], [L, 0], H.seed, interior);
    for (const xx of [xA, xB]) {
      quad(A, P(xx, ye, zf + ov), P(xx, yr, zc), P(xx, yr - 0.3, zc), P(xx, ye - 0.3, zf + ov), M.TIMBER, [0, 0], [1, 0], [1, 1], [0, 1], H.seed, P(0, yr * 0.5, zc));
      quad(A, P(xx, yr, zc), P(xx, ye, -hd - ov), P(xx, ye - 0.3, -hd - ov), P(xx, yr - 0.3, zc), M.TIMBER, [0, 0], [1, 0], [1, 1], [0, 1], H.seed, P(0, yr * 0.5, zc));
    }
    if (H.chimney) { const cx = hw * 0.45, cz = zc - 0.9; box(A, P, cx - 0.45, yr - 1.8, cz - 0.45, cx + 0.45, yr + 1.0, cz + 0.45, M.STONE, H.seed); H.chimneyTop = P(cx, yr + 1.1, cz); }
    H.ridgeY = yr;
  }
}

function church(A) {
  const C = CHURCH, gy = height(C.x, C.z) - 0.3;
  const P = frame(C.x, gy, C.z, 0), hw = C.w / 2, hd = C.d / 2, wallH = 12;
  box(A, P, -hw, -1, -hd, hw, wallH, hd, { side: M.CHURCH, top: M.STONE }, 3000.5);
  // buttresses
  for (let z = -hd + 3; z < hd - 1; z += 5.2) for (const sx of [-1, 1]) box(A, P, sx > 0 ? hw : -hw - 1.1, -1, z - 0.6, sx > 0 ? hw + 1.1 : -hw, wallH - 2.5, z + 0.6, M.STONE, 7);
  const rise = hw * 1.7, yr = wallH + rise, ctr = P(0, wallH, 0);
  tri(A, P(-hw, wallH, -hd), P(hw, wallH, -hd), P(0, yr, -hd), M.STONE, [0, wallH], [C.w, wallH], [hw, yr], 1, ctr);
  tri(A, P(-hw, wallH, hd), P(hw, wallH, hd), P(0, yr, hd), M.STONE, [0, wallH], [C.w, wallH], [hw, yr], 1, ctr);
  quad(A, P(-hw - 0.6, wallH - 0.8, hd + 0.4), P(0, yr, hd + 0.4), P(0, yr, -hd - 0.4), P(-hw - 0.6, wallH - 0.8, -hd - 0.4), M.SLATE, [0, 12], [0, 0], [C.d, 0], [C.d, 12], 3, ctr);
  quad(A, P(0, yr, hd + 0.4), P(hw + 0.6, wallH - 0.8, hd + 0.4), P(hw + 0.6, wallH - 0.8, -hd - 0.4), P(0, yr, -hd - 0.4), M.SLATE, [0, 0], [0, 12], [C.d, 12], [C.d, 0], 3, ctr);
  // apse at the north end
  cyl(A, frame(C.x, gy, C.z - hd, 0), 0, -1, 0, hw - 0.3, wallH - 1, hw - 0.3, 10, M.CHURCH, 3000.5, false);
  cyl(A, frame(C.x, gy, C.z - hd, 0), 0, wallH - 1, 0, hw + 0.2, wallH + 4.5, 0.01, 10, M.SLATE, 3, false);
  // the tower at the south end, toward the square
  const tz = hd + 3.4, tw = 3.4, top = C.towerH;
  box(A, P, -tw, -1, tz - tw, tw, top, tz + tw, { side: M.STONE, front: M.STONE_FRONT, top: M.STONE }, 5.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(A, P, sx * tw - 0.7, top - 0.2, tz + sz * tw - 0.7, sx * tw + 0.7, top + 2.2, tz + sz * tw + 0.7, M.STONE, 2);
  const sh = 15, ap = P(0, top + sh, tz), tc = P(0, top + sh * 0.3, tz);
  const co = [P(-tw + 0.3, top, tz - tw + 0.3), P(tw - 0.3, top, tz - tw + 0.3), P(tw - 0.3, top, tz + tw - 0.3), P(-tw + 0.3, top, tz + tw - 0.3)];
  for (let k = 0; k < 4; k++) tri(A, co[k], co[(k + 1) % 4], ap, M.SLATE, [0, 0], [1, 0], [0.5, 1], 3, tc);
  box(A, P, -0.1, top + sh, tz - 0.1, 0.1, top + sh + 2.4, tz + 0.1, M.IRON, 0);
  box(A, P, -0.75, top + sh + 1.5, tz - 0.08, 0.75, top + sh + 1.7, tz + 0.08, M.IRON, 0);
}

function wall(A, W) {
  const dx = W.b[0] - W.a[0], dz = W.b[1] - W.a[1], L = Math.hypot(dx, dz) + 0.5;
  const mx = (W.a[0] + W.b[0]) / 2, mz = (W.a[1] + W.b[1]) / 2, gy = Math.min(height(W.a[0], W.a[1]), height(W.b[0], W.b[1]), height(mx, mz)) - 0.6;
  const P = frame(mx, gy, mz, Math.atan2(dx, dz));
  box(A, P, -0.9, -1, -L / 2, 0.9, W.h, L / 2, { side: M.STONE, top: M.WALLTOP }, 11.3);
  if (W.h > 5) for (let z = -L / 2 + 0.6; z < L / 2 - 0.5; z += 2.2) box(A, P, 0.25, W.h, z, 0.9, W.h + 1.0, z + 1.1, M.STONE, 3);
}
function tower(A, T) {
  const gy = height(T.x, T.z) - 0.8;
  if (T.gate) {
    // a gatehouse straddling the gap: two piers, a block over the arch, a hipped roof
    const P = frame(T.x, gy, T.z, -T.rot);
    box(A, P, -5.5, -1, -4.5, -2.1, T.h, 4.5, M.STONE, 21);
    box(A, P, 2.1, -1, -4.5, 5.5, T.h, 4.5, M.STONE, 21);
    box(A, P, -2.1, 5.2, -4.5, 2.1, T.h, 4.5, { side: M.STONE, top: M.STONE, front: M.STONE }, 21);
    const ctr = P(0, T.h, 0);
    const c = [P(-6.1, T.h - 0.3, -5.1), P(6.1, T.h - 0.3, -5.1), P(6.1, T.h - 0.3, 5.1), P(-6.1, T.h - 0.3, 5.1)];
    const r0 = P(-2, T.h + 5, 0), r1 = P(2, T.h + 5, 0);
    quad(A, c[0], c[1], r1, r0, M.TILE, [0, 0], [12, 0], [8, 6], [4, 6], 4, ctr);
    quad(A, c[2], c[3], r0, r1, M.TILE, [0, 0], [12, 0], [8, 6], [4, 6], 4, ctr);
    tri(A, c[1], c[2], r1, M.TILE, [0, 0], [10, 0], [5, 6], 4, ctr);
    tri(A, c[3], c[0], r0, M.TILE, [0, 0], [10, 0], [5, 6], 4, ctr);
    return;
  }
  const P = frame(T.x, gy, T.z, 0);
  cyl(A, P, 0, -1, 0, T.r, T.h, T.r * 0.96, 14, M.STONE, 11.3, false);
  cyl(A, P, 0, T.h, 0, T.r + 0.6, T.h + T.r * 1.5, 0.01, 14, M.SLATE, 4, false);
}
function hall(A) {
  const Hh = HALL, gy = height(Hh.x, Hh.z) - 0.2, P = frame(Hh.x, gy, Hh.z, 0);
  const hw = Hh.w / 2, hd = Hh.d / 2, y = 3.6;
  box(A, P, -hw + 0.2, -0.6, -hd + 0.2, hw - 0.2, 0.25, hd - 0.2, M.STONE, 7);
  for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) { const x = -hw + 0.4 + i * (Hh.w - 0.8) / 4; box(A, P, x - 0.22, 0, sz * (hd - 0.4) - 0.22, x + 0.22, y, sz * (hd - 0.4) + 0.22, M.TIMBER, 1); }
  box(A, P, -hw, y - 0.3, -hd, hw, y, hd, M.TIMBER, 2);
  const ctr = P(0, y, 0), rise = 3.2;
  const c = [P(-hw - 0.8, y - 0.2, -hd - 0.8), P(hw + 0.8, y - 0.2, -hd - 0.8), P(hw + 0.8, y - 0.2, hd + 0.8), P(-hw - 0.8, y - 0.2, hd + 0.8)];
  const r0 = P(-hw + hd, y + rise, 0), r1 = P(hw - hd, y + rise, 0);
  quad(A, c[0], c[1], r1, r0, M.TILE, [0, 0], [Hh.w, 0], [Hh.w - 4, 5], [4, 5], 2.2, ctr);
  quad(A, c[2], c[3], r0, r1, M.TILE, [0, 0], [Hh.w, 0], [Hh.w - 4, 5], [4, 5], 2.2, ctr);
  tri(A, c[1], c[2], r1, M.TILE, [0, 0], [Hh.d, 0], [Hh.d / 2, 5], 2.2, ctr);
  tri(A, c[3], c[0], r0, M.TILE, [0, 0], [Hh.d, 0], [Hh.d / 2, 5], 2.2, ctr);
  // stalls and crates under it
  box(A, P, -hw + 1.2, 0.25, -1.2, -hw + 4.2, 1.1, 0.4, M.PLANK, 3);
  box(A, P, hw - 4.5, 0.25, 0.2, hw - 1.4, 1.0, 1.6, M.PLANK, 4);
}
function well(A) {
  const gy = height(WELL.x, WELL.z), P = frame(WELL.x, gy, WELL.z, 0.3);
  cyl(A, P, 0, -0.3, 0, 1.0, 0.85, 1.0, 10, M.STONE, 1.5, false);
  cyl(A, P, 0, -0.3, 0, 0.75, 0.86, 0.75, 10, M.DARK, 1.5, false);
  quad(A, P(-0.8, 0.5, -0.8), P(0.8, 0.5, -0.8), P(0.8, 0.5, 0.8), P(-0.8, 0.5, 0.8), M.DARK, [0, 0], [1, 0], [1, 1], [0, 1], 0, P(0, -3, 0));
  box(A, P, -1.05, 0, -0.08, -0.9, 2.4, 0.08, M.TIMBER, 0); box(A, P, 0.9, 0, -0.08, 1.05, 2.4, 0.08, M.TIMBER, 0);
  const ctr = P(0, 2.4, 0);
  quad(A, P(-1.3, 2.25, -0.9), P(1.3, 2.25, -0.9), P(1.3, 3.0, 0), P(-1.3, 3.0, 0), M.SHINGLE, [0, 1], [2.6, 1], [2.6, 0], [0, 0], 0.5, ctr);
  quad(A, P(1.3, 2.25, 0.9), P(-1.3, 2.25, 0.9), P(-1.3, 3.0, 0), P(1.3, 3.0, 0), M.SHINGLE, [2.6, 1], [0, 1], [0, 0], [2.6, 0], 0.5, ctr);
}
function bridge(A) {
  const B = BRIDGE, P = frame(B.x, 0, B.z, B.rot);
  const n = 22;
  for (let i = 0; i < n; i++) {
    const z0 = -22 + (i / n) * 44, z1 = -22 + ((i + 1) / n) * 44, y0 = B.deck(z0), y1 = B.deck(z1);
    const a = [P(-2.6, y0, z0), P(2.6, y0, z0), P(2.6, y1, z1), P(-2.6, y1, z1)];
    quad(A, a[0], a[1], a[2], a[3], M.STONE, [-2.6, z0], [2.6, z0], [2.6, z1], [-2.6, z1], 5, [P(0, y0 - 5, (z0 + z1) / 2)[0], y0 - 5, P(0, y0 - 5, (z0 + z1) / 2)[2]]);
    for (const sx of [-1, 1]) {
      // parapet
      const xo = sx * 2.6, xi = sx * 2.2;
      quad(A, P(xo, y0 - 3.2, z0), P(xo, y1 - 3.2, z1), P(xo, y1 + 0.9, z1), P(xo, y0 + 0.9, z0), M.STONE, [z0, -3], [z1, -3], [z1, 1], [z0, 1], 5, P(0, y0, (z0 + z1) / 2));
      quad(A, P(xi, y0, z0), P(xi, y1, z1), P(xi, y1 + 0.9, z1), P(xi, y0 + 0.9, z0), M.STONE, [z0, 0], [z1, 0], [z1, 1], [z0, 1], 5, P(0, y0 + 5, (z0 + z1) / 2));
      quad(A, P(xi, y0 + 0.9, z0), P(xo, y0 + 0.9, z0), P(xo, y1 + 0.9, z1), P(xi, y1 + 0.9, z1), M.WALLTOP, [0, z0], [1, z0], [1, z1], [0, z1], 5, P(sx * 2.4, y0 - 2, (z0 + z1) / 2));
    }
  }
  // two piers in the water
  for (const z of [-7, 7]) box(A, P, -2.4, -6, z - 1.3, 2.4, B.deck(z) - 2.6, z + 1.3, M.STONE, 6);
}
function mill(A) {
  const gy = height(MILL.x, MILL.z) - 0.5, P = frame(MILL.x, gy, MILL.z, 0);
  cyl(A, P, 0, -1, 0, 4.6, 12, 3.4, 12, M.STONE_HOUSE, 1500.3, false);
  cyl(A, P, 0, 12, 0, 4.0, 16.5, 0.01, 12, M.SHINGLE, 3, false);
  box(A, P, -0.6, 10.5, 3.2, 0.6, 12.3, 4.6, M.TIMBER, 0);
  MILL.hub = [MILL.x, gy + 11.4, MILL.z + 4.7];
}
// the mill's sails turn, so the game writes them into the per-frame mesh
export function millSails(A, t) {
  const [hx, hy, hz] = MILL.hub, a0 = t * 0.35;
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    const P = (r, w) => [hx + (-s * r + c * w), hy + (c * r + s * w), hz];
    quad(A, P(0.3, -0.18), P(0.3, 0.18), P(9.2, 0.18), P(9.2, -0.18), M.TIMBER, [0, 0], [1, 0], [1, 1], [0, 1], 0, [hx, hy, hz - 3]);
    quad(A, P(2.2, 0.22), P(2.2, 1.6), P(9.0, 1.6), P(9.0, 0.22), M.SAIL, [0, 0], [1.4, 0], [1.4, 7], [0, 7], 0.5, [hx, hy, hz - 3]);
  }
}

function pine(A, T) {
  const gy = height(T.x, T.z) - 0.3, P = frame(T.x, gy, T.z, T.seed * 6.28), R = mulberry(Math.floor(T.seed * 1e6));
  const h = T.h, r = T.r;
  cyl(A, P, 0, 0, 0, 0.22 + h * 0.012, h * 0.45, 0.08, 4, M.BARK, T.seed, false);
  const n = h > 13 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const t = i / n, yb = h * (0.18 + t * 0.62), ht = h * (0.4 - t * 0.08), rr = r * (1.05 - t * 0.7) * (0.9 + R() * 0.2);
    const sides = 9, jits = Array.from({ length: sides + 1 }, (_, k) => (k % 2 ? 0.6 + R() * 0.2 : 0.95 + R() * 0.3)); jits[sides] = jits[0];
    const droop = 0.4 + R() * 0.3, apex = P(0, yb + ht, 0), ctr = P(0, yb + ht * 0.3, 0);
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      tri(A, P(Math.cos(a0) * rr * jits[k], yb - droop * jits[k], Math.sin(a0) * rr * jits[k]), P(Math.cos(a1) * rr * jits[k + 1], yb - droop * jits[k + 1], Math.sin(a1) * rr * jits[k + 1]), apex, M.PINE, [0, 0], [1, 0], [0.5, 1], T.seed, ctr);
    }
  }
}
function broad(A, T) {
  const gy = height(T.x, T.z) - 0.2, P = frame(T.x, gy, T.z, T.seed * 6.28), R = mulberry(Math.floor(T.seed * 1e6) + 7);
  const h = T.h, r = T.r * 1.1;
  cyl(A, P, 0, 0, 0, 0.25, h * 0.55, 0.15, 4, M.BARK, T.seed, false);
  // a lumpy crown: a jittered, subdivided octahedron
  const base = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
  const verts = base.map((v) => v.slice()), mid = new Map();
  const midp = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (mid.has(k)) return mid.get(k); const v = verts[a].map((x, i) => (x + verts[b][i]) / 2); const l = Math.hypot(...v); verts.push(v.map((x) => x / l)); mid.set(k, verts.length - 1); return verts.length - 1; };
  const f2 = []; faces.forEach(([a, b, c]) => { const ab = midp(a, b), bc = midp(b, c), ca = midp(c, a); f2.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); });
  const jit = verts.map(() => 0.78 + R() * 0.4), cy = h * 0.62;
  const W = verts.map((v, i) => P(v[0] * r * jit[i], cy + v[1] * r * 0.82 * jit[i], v[2] * r * jit[i]));
  const ctr = P(0, cy, 0);
  f2.forEach(([a, b, c]) => tri(A, W[a], W[b], W[c], M.BROAD, [0, 0], [1, 0], [0, 1], T.seed, ctr));
}
function hay(A, Pr) {
  const gy = height(Pr.x, Pr.z) - 0.2, P = frame(Pr.x, gy, Pr.z, Pr.seed * 6);
  cyl(A, P, 0, 0, 0, Pr.r, Pr.r * 0.9, Pr.r * 0.95, 9, M.HAY, Pr.seed, false);
  cyl(A, P, 0, Pr.r * 0.9, 0, Pr.r * 0.95, Pr.r * 2.0, 0.05, 9, M.HAY, Pr.seed, false);
}
function smallProp(A, Pr) {
  const gy = height(Pr.x, Pr.z), P = frame(Pr.x, gy, Pr.z, Pr.rot || 0);
  if (Pr.kind === 'barrel') { cyl(A, P, 0, -0.1, 0, 0.36, 0.95, 0.36, 7, M.PLANK, 0.2); return; }
  box(A, P, -0.9, 0.6, -1.4, 0.9, 0.85, 1.4, M.PLANK, Pr.seed);
  box(A, P, -0.9, 0.85, -1.4, -0.82, 1.25, 1.4, M.PLANK, Pr.seed); box(A, P, 0.82, 0.85, -1.4, 0.9, 1.25, 1.4, M.PLANK, Pr.seed);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, r = 0.62;
      quad(A, P(sx * 1.02, 0.6 + Math.sin(a0) * r, Math.cos(a0) * r), P(sx * 1.02, 0.6 + Math.sin(a1) * r, Math.cos(a1) * r), P(sx * 1.02, 0.6 + Math.sin(a1) * r * 0.7, Math.cos(a1) * r * 0.7), P(sx * 1.02, 0.6 + Math.sin(a0) * r * 0.7, Math.cos(a0) * r * 0.7), M.TIMBER, [0, 0], [1, 0], [1, 1], [0, 1], 0, P(sx * 0.5, 0.6, 0));
    }
    box(A, P, sx * 0.55 - 0.05, 0.05, 1.4, sx * 0.55 + 0.05, 0.15, 3.2, M.TIMBER, 0);
  }
}

// ---------------------------------------------------------------------------------------------- chunks
// The static world split into 32 m chunks; each carries its bounding box for culling.
export const WCH = 32;
export function buildWorld() {
  const span = NEAR + 160, NCW = Math.ceil((span * 2) / WCH);
  const chunks = Array.from({ length: NCW * NCW }, () => makeArr(1024));
  const at = (x, z) => chunks[Math.max(0, Math.min(NCW - 1, Math.floor((z + span) / WCH))) * NCW + Math.max(0, Math.min(NCW - 1, Math.floor((x + span) / WCH)))];
  houses.forEach((H) => house(at(H.x, H.z), H));
  wallSegs.forEach((W) => wall(at((W.a[0] + W.b[0]) / 2, (W.a[1] + W.b[1]) / 2), W));
  towers.forEach((T) => tower(at(T.x, T.z), T));
  church(at(CHURCH.x, CHURCH.z));
  hall(at(HALL.x, HALL.z));
  well(at(WELL.x, WELL.z));
  bridge(at(BRIDGE.x, BRIDGE.z));
  mill(at(MILL.x, MILL.z));
  trees.forEach((T) => (T.kind === 1 ? broad : pine)(at(T.x, T.z), T));
  props.forEach((P) => (P.kind === 'hay' ? hay : smallProp)(at(P.x, P.z), P));
  let total = 0; chunks.forEach((c) => (total += c.n));
  const data = new Float32Array(total), ranges = [];
  let off = 0;
  chunks.forEach((c) => {
    const d = c.data; let bb = null;
    for (let i = 0; i < d.length; i += STRIDE) {
      if (!bb) bb = [d[i], d[i + 1], d[i + 2], d[i], d[i + 1], d[i + 2]];
      else { bb[0] = Math.min(bb[0], d[i]); bb[1] = Math.min(bb[1], d[i + 1]); bb[2] = Math.min(bb[2], d[i + 2]); bb[3] = Math.max(bb[3], d[i]); bb[4] = Math.max(bb[4], d[i + 1]); bb[5] = Math.max(bb[5], d[i + 2]); }
    }
    data.set(d, off); ranges.push({ first: off / STRIDE, n: d.length / STRIDE, bb }); off += d.length;
  });
  return { data, ranges: ranges.filter((r) => r.n > 0), verts: total / STRIDE };
}

// Terrain in three nested rings: 2 m near the town, 16 m out to 2.3 km, 96 m to the mountains.
// Each ring skips the cells the inner ring covers (with a cell of overlap, dropped a little under it).
export function buildTerrain() {
  const rings = [{ S: 2, half: NEAR, hole: 0, ch: 64 }, { S: 16, half: 2304, hole: NEAR - 16, ch: 512 }, { S: 96, half: 9216, hole: 2304 - 96, ch: 2304 }];
  const verts = [], idx = [], ranges = [];
  let vbase = 0, skirt = null;
  for (const [ri, Rg] of rings.entries()) {
    const n = Math.round((Rg.half * 2) / Rg.S) + 1;
    const v = new Float32Array(n * n * STRIDE);
    // heights on the grid plus a border, normals from the neighbours
    const nb = n + 2, Hg = new Float32Array(nb * nb);
    for (let j = 0; j < nb; j++) for (let i = 0; i < nb; i++) Hg[j * nb + i] = height(-Rg.half + (i - 1) * Rg.S, -Rg.half + (j - 1) * Rg.S);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -Rg.half + i * Rg.S, z = -Rg.half + j * Rg.S;
      const hc = (a, b) => Hg[(j + 1 + b) * nb + (i + 1 + a)];
      let y = hc(0, 0);
      const inner = ri > 0 && Math.abs(x) < Rg.hole + Rg.S * 0.5 + 1 && Math.abs(z) < Rg.hole + Rg.S * 0.5 + 1;
      if (inner) y -= ri === 1 ? 4 : 30;
      const dx = (hc(1, 0) - hc(-1, 0)) / (2 * Rg.S), dz = (hc(0, 1) - hc(0, -1)) / (2 * Rg.S), l = Math.hypot(dx, 1, dz);
      const o = (j * n + i) * STRIDE;
      v[o] = x; v[o + 1] = y; v[o + 2] = z; v[o + 3] = -dx / l; v[o + 4] = 1 / l; v[o + 5] = -dz / l; v[o + 6] = 0; v[o + 7] = x; v[o + 8] = z; v[o + 9] = ri;
    }
    verts.push(v);
    const cpc = Rg.ch / Rg.S, nc = Math.ceil((n - 1) / cpc);
    const lists = Array.from({ length: nc * nc }, () => []);
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const x0 = -Rg.half + i * Rg.S, z0 = -Rg.half + j * Rg.S, x1 = x0 + Rg.S, z1 = z0 + Rg.S;
      if (ri > 0 && x0 >= -Rg.hole && x1 <= Rg.hole && z0 >= -Rg.hole && z1 <= Rg.hole) continue;
      const a = vbase + j * n + i, b = a + 1, c = a + n, d = c + 1;
      const L = lists[Math.floor(j / cpc) * nc + Math.floor(i / cpc)];
      if ((i + j) & 1) L.push(a, c, b, b, c, d); else L.push(a, c, d, a, d, b);
    }
    // a skirt round the near ring hides the seam with the coarser one
    if (ri === 0) {
      const sk = [];
      const edge = (i0, j0, di, dj) => { for (let k = 0; k < n - 1; k++) sk.push([i0 + di * k, j0 + dj * k, i0 + di * (k + 1), j0 + dj * (k + 1)]); };
      edge(0, 0, 1, 0); edge(0, n - 1, 1, 0); edge(0, 0, 0, 1); edge(n - 1, 0, 0, 1);
      const extra = new Float32Array(sk.length * 2 * STRIDE); let e = 0;
      const skirtBase = vbase + n * n;
      sk.forEach(([i0, j0]) => { const o = (j0 * n + i0) * STRIDE; for (let q = 0; q < STRIDE; q++) extra[e * STRIDE + q] = v[o + q]; extra[e * STRIDE + 1] -= 12; e++; });
      // skirt vertices: one dropped copy per edge vertex start; pair them with the next along the edge
      const L = [];
      sk.forEach(([i0, j0, i1, j1], k) => {
        const a = vbase + j0 * n + i0, b = vbase + j1 * n + i1, a2 = skirtBase + k;
        const b2 = k + 1 < sk.length && sk[k + 1][0] === i1 && sk[k + 1][1] === j1 ? skirtBase + k + 1 : null;
        if (b2 !== null) L.push(a, b, b2, a, b2, a2); else L.push(a, b, a2);
      });
      skirt = L;
      verts.push(extra.subarray(0, e * STRIDE));
      vbase += e;
    }
    for (let k = 0; k < lists.length; k++) {
      if (!lists[k].length) continue;
      const ci = k % nc, cj = Math.floor(k / nc);
      const x0 = -Rg.half + ci * Rg.ch, z0 = -Rg.half + cj * Rg.ch;
      ranges.push({ off: idx.length, n: lists[k].length, ring: ri, bb: [x0, 0, z0, x0 + Rg.ch, 0, z0 + Rg.ch], list: lists[k] });
      for (const id of lists[k]) idx.push(id);
    }
    if (skirt) { ranges.push({ off: idx.length, n: skirt.length, ring: ri, bb: [-NEAR, 0, -NEAR, NEAR, 0, NEAR], list: skirt }); for (const id of skirt) idx.push(id); skirt = null; }
    vbase += n * n;
  }
  // concatenate vertices; fill y bounds per range
  let total = 0; verts.forEach((v) => (total += v.length));
  const V = new Float32Array(total); let off = 0; verts.forEach((v) => { V.set(v, off); off += v.length; });
  for (const r of ranges) {
    let y0 = Infinity, y1 = -Infinity;
    for (const id of r.list) { const y = V[id * STRIDE + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    r.bb[1] = y0; r.bb[4] = y1; delete r.list;
  }
  return { v: V, idx: new Uint32Array(idx), ranges };
}
