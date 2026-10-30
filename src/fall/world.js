// UNDERFOOT — the world. A walled hill town in a wide valley, a river round its south side, fields, woods,
// and mountains far off. Metres, y up. The camera looks toward -x -z, so -x is the top left of the screen
// and +x +z comes toward you. The giant comes in from -x, with the low sun behind it.
// The town itself is drawn by hand in townmap.js and read by town.js; this file puts the ground under it,
// adds what stands outside the walls, and builds the collision grid, the occluders and the covers the game
// reads.
import { makeNoise, mulberry, clamp, smooth } from '../lib/noise.js';
import { LAYOUT, streetAt, ruinWalls, CELL } from './town.js';

export const NEAR = 256;        // the detailed square (±256 m) around the town
export const FAR = 9000;        // the whole valley (±9 km)
const N = makeNoise(7), N2 = makeNoise(31);

// ---- the river: a centreline z(x), about 80 m south of the square
export function riverZ(x) { return 82 + 60 * (Math.sin(x / 400 + 0.3) - Math.sin(0.3)) + 25 * Math.sin(x / 170) + 140 * smooth(600, 3000, Math.abs(x)) * Math.sign(x) * 0.6; }
export function riverDist(x, z) {
  const z0 = riverZ(x), d = (riverZ(x + 2) - riverZ(x - 2)) / 4;
  return Math.abs(z - z0) / Math.sqrt(1 + d * d);
}
export const RIVER_W = 9; // half width

// ---- the town: centre, wall ellipse (the drawn wall follows it; this is the quick "inside the walls" test)
export const TOWN = { x: -4, z: -6, rx: 74, rz: 66 };
export function townR(x, z) { const dx = (x - TOWN.x) / TOWN.rx, dz = (z - TOWN.z) / TOWN.rz; return Math.hypot(dx, dz); }

// ridged noise for the mountains
const ridge = (x, z) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < 5; i++) { const v = 1 - Math.abs(N2.n2(x * f + i * 7.1, z * f - i * 3.3) * 2 - 1); s += a * v * v; n += a; a *= 0.5; f *= 2.1; } return s / n; };

export function height(x, z) {
  // valley floor: slow swells
  let h = (N.fbm(x / 1300, z / 1300, 4) - 0.5) * 46 + (N.fbm(x / 260 + 40, z / 260 - 13, 3) - 0.5) * 9;
  // the town hill
  const r = Math.hypot(x - TOWN.x - 8, z - TOWN.z + 4);
  h += 12 * Math.exp(-((r / 105) ** 2));
  // a rise to the west for the windmill
  h += 9 * Math.exp(-((Math.hypot(x + 210, z - 40) / 70) ** 2));
  // mountains far off: a ring that starts at ~3 km, warped
  const R = Math.hypot(x * 0.9, z * 1.1) + (N.fbm(x / 3000 + 9, z / 3000 - 4, 3) - 0.5) * 2600;
  const m = smooth(2600, 7200, R);
  if (m > 0) h += m * (180 + 1500 * ridge(x / 2600, z / 2600)) + m * m * 400;
  // the river channel and its flat banks
  const d = riverDist(x, z);
  if (d < 60) {
    const bed = -4.2;
    const bank = smooth(RIVER_W - 1, RIVER_W + 9, d);
    const flat = smooth(14, 60, d);
    const hb = h * flat + (1 - flat) * Math.min(h, 2.5);
    h = bed * (1 - bank) + hb * bank;
  }
  return h;
}
export function normalAt(x, z, e = 1) {
  const dx = (height(x + e, z) - height(x - e, z)) / (2 * e), dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
  const l = Math.hypot(dx, 1, dz); return [-dx / l, 1 / l, -dz / l];
}

// ---- the gates (from the map), and the roads. The west road leaves the west gate for the hills; the east
// road crosses the bridge; a track runs north from outside the wall to the woods.
export const gates = LAYOUT.wall.gates;
export const GATE_W = gates.reduce((a, b) => (b.x < a.x ? b : a));
export const GATE_E = gates.reduce((a, b) => (b.x > a.x ? b : a));
export const BRIDGE = { x: 70, z: 0, rot: 0 };
{
  // the bridge sits where the east road meets the river
  const bx = 92; BRIDGE.x = bx; BRIDGE.z = riverZ(bx);
  const d = (riverZ(bx + 2) - riverZ(bx - 2)) / 4; BRIDGE.rot = Math.atan2(-d, 1); // local +z runs across the river
}
export const ROADS = [
  [[GATE_W.x + 6, GATE_W.z], [GATE_W.x - 30, GATE_W.z + 6], [-160, 30], [-205, 30], [-300, 10], [-520, -40], [-900, -60], [-1500, -10], [-2600, 120]],
  [[GATE_E.x - 6, GATE_E.z], [GATE_E.x + 10, GATE_E.z + 6], [BRIDGE.x - 6, BRIDGE.z - 26], [BRIDGE.x, BRIDGE.z], [BRIDGE.x + 8, BRIDGE.z + 30], [170, 220], [320, 420], [700, 760], [1400, 1200], [2600, 1800]],
  [[TOWN.x - 4, TOWN.z - TOWN.rz - 4], [-20, -110], [-60, -190], [-90, -320], [-60, -520]],
];
export function segDist(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / L2);
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
export function roadDist(x, z) { let d = 1e9; for (const R of ROADS) for (let i = 0; i < R.length - 1; i++) d = Math.min(d, segDist(x, z, R[i], R[i + 1])); return d; }

// ---- woods: a noise field, thicker on the hills, never on roads, river or fields near the walls
export function forest(x, z) {
  const r = Math.hypot(x, z);
  let f = N.fbm(x / 520 + 3, z / 520 - 7, 4);
  f += smooth(1200, 3000, r) * 0.18 - smooth(5500, 7500, r) * 0.3;
  // two woods near the town: north-west and south beyond the river
  f += 0.32 * Math.exp(-((x + 150) ** 2 + (z + 210) ** 2) / (130 * 130));
  f += 0.26 * Math.exp(-((x - 60) ** 2 + (z - 260) ** 2) / (110 * 110));
  f -= 0.5 * Math.exp(-((r / 170) ** 2));
  return f;
}
export function isForest(x, z) { return forest(x, z) > 0.6 && riverDist(x, z) > 18 && roadDist(x, z) > 7; }

// ---- the town plan, from the map: the square (the biggest plaza) and the smaller plazas, the lanes as
// segments for the strollers, the paving for the ground map
export const PLAZAS = LAYOUT.plazas;
export const SQUARE = PLAZAS[0];
export const STREETS = LAYOUT.streets;
export { streetAt };
export const SPAWN = { x: -12, z: 8 };   // where you start every night (game.js has the same numbers)

export const CHURCH = LAYOUT.church;
export const HALL = LAYOUT.hall;        // open market hall on posts: cover
export const wells = LAYOUT.wells;
export const WELL = wells.length ? wells.reduce((a, b) => (Math.hypot(b.x - SQUARE.x, b.z - SQUARE.z) < Math.hypot(a.x - SQUARE.x, a.z - SQUARE.z) ? b : a)) : null;   // the one on the square
export const MILL = { x: -210, z: 40 };
export const stalls = LAYOUT.stalls, arcades = LAYOUT.arcades, chapels = LAYOUT.chapels, ruins = LAYOUT.ruins;
export const lowWalls = LAYOUT.lowWalls, stairs = LAYOUT.stairs, bushes = LAYOUT.bushes;

// buildings: oriented boxes {x, z, w, d, h, rot, ...}; rot turns local +z (front) toward the street
export const houses = LAYOUT.houses.slice();
// every house has a slot in the per-house state the game uploads each frame (lit, dark, taken); the walls
// carry the slot in the fraction of their seed, as the slot's texel centre, so it survives float32
export const HOUSE_SLOTS = 128;
export const houseKey = (H) => (H.i + 0.5) / HOUSE_SLOTS;
export const towers = [];
export const wallSegs = [];
const R = mulberry(1213);
// farmsteads outside the walls
const farms = [[-150, -40, 0.3], [-120, 70, -0.2], [150, -60, 0.6], [40, 150, 0.1], [-60, 120, 1.2], [190, 40, -0.4]];
for (const [x, z, rot] of farms) {
  houses.push({ x, z, w: 9, d: 7.5, h: 4.6, rot, seed: R(), gableFront: false, jetty: false, chimney: true, stone: false, tile: R() < 0.5, farm: true });
  houses.push({ x: x + Math.cos(rot) * 12, z: z - Math.sin(rot) * 12, w: 12, d: 8, h: 4.2, rot, seed: R(), gableFront: false, jetty: false, chimney: false, stone: false, tile: false, barn: true });
}
// each house's slot, whether it stands inside the walls, and its door: the step in front of its street side
houses.forEach((H, i) => { H.i = i; H.inTown = townR(H.x, H.z) < 1; H.door = [H.x + (H.d / 2 + 1.1) * Math.sin(H.rot), H.z + (H.d / 2 + 1.1) * Math.cos(H.rot)]; });

// the wall: the traced ring, with round towers where the map has them and a gatehouse on each gate
for (const S of LAYOUT.wall.segs) { const ruin = R() < 0.06; wallSegs.push({ a: S.a, b: S.b, h: ruin ? 3.2 : 7.5 + R() * 0.8 }); }
for (const T of LAYOUT.wall.towers) towers.push({ x: T.x, z: T.z, r: 4.2, h: 13 + R() * 3 });
for (const G of gates) towers.push({ x: G.x, z: G.z, r: 0, h: 15, gate: true, rot: G.rot });

// trees: the town's own from the map, then woods (instanced near the town), orchards, singles along the river
export const trees = LAYOUT.trees.slice();
{
  const TR = mulberry(77);
  for (let i = 0; i < 9000 && trees.length < 2600; i++) {
    const x = (TR() - 0.5) * 2 * (NEAR + 140), z = (TR() - 0.5) * 2 * (NEAR + 140);
    if (townR(x, z) < 1.12 || roadDist(x, z) < 6 || riverDist(x, z) < RIVER_W + 3) continue;
    if (Math.hypot(x - MILL.x, z - MILL.z) < 30) continue;
    if (houses.some((H) => Math.hypot(H.x - x, H.z - z) < 12)) continue;
    // nothing to hide behind within forty metres of a gate: out there you are in the open
    if (gates.some((G) => Math.hypot(G.x - x, G.z - z) < 40)) continue;
    const f = forest(x, z);
    const byRiver = riverDist(x, z) < RIVER_W + 16 && TR() < 0.25;
    if (f > 0.6 || byRiver || (f > 0.5 && TR() < 0.25)) trees.push({ x, z, h: 9 + TR() * 9, r: 2.6 + TR() * 1.4, seed: TR(), kind: f > 0.6 ? 0 : (TR() < 0.6 ? 1 : 0) });
  }
  // an orchard by the south-west farm
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) trees.push({ x: -112 + i * 8 + TR(), z: 86 + j * 8 + TR(), h: 5 + TR() * 1.5, r: 2.4, seed: TR(), kind: 1 });
}

// haystacks in the fields; the carts and barrels the map puts in the streets
export const props = LAYOUT.props.slice();
{
  const PR = mulberry(5);
  for (let i = 0; i < 40; i++) {
    const a = PR() * 6.28, r = 95 + PR() * 160, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (townR(x, z) < 1.15 || riverDist(x, z) < 20 || roadDist(x, z) < 6 || isForest(x, z)) continue;
    if (gates.some((G) => Math.hypot(G.x - x, G.z - z) < 45)) continue;
    props.push({ x, z, kind: 'hay', r: 2 + PR() * 1.2, seed: PR() });
  }
}

// ---- collision: a 0.5 m grid over the detailed square. 1 = blocked.
export const COL_S = 0.5, COL_N = Math.round((NEAR * 2) / COL_S);
export const COL = new Uint8Array(COL_N * COL_N);
function stampBox(x, z, w, d, rot, pad = 0.25) {
  const c = Math.cos(rot), s = Math.sin(rot), r = Math.hypot(w, d) / 2 + 1;
  for (let j = Math.floor((z - r + NEAR) / COL_S); j <= Math.ceil((z + r + NEAR) / COL_S); j++) for (let i = Math.floor((x - r + NEAR) / COL_S); i <= Math.ceil((x + r + NEAR) / COL_S); i++) {
    if (i < 0 || j < 0 || i >= COL_N || j >= COL_N) continue;
    const px = -NEAR + (i + 0.5) * COL_S - x, pz = -NEAR + (j + 0.5) * COL_S - z;
    const lx = px * c - pz * s, lz = px * s + pz * c;
    if (Math.abs(lx) < w / 2 + pad && Math.abs(lz) < d / 2 + pad) COL[j * COL_N + i] = 1;
  }
}
function stampCircle(x, z, r) {
  for (let j = Math.floor((z - r + NEAR) / COL_S); j <= Math.ceil((z + r + NEAR) / COL_S); j++) for (let i = Math.floor((x - r + NEAR) / COL_S); i <= Math.ceil((x + r + NEAR) / COL_S); i++) {
    if (i < 0 || j < 0 || i >= COL_N || j >= COL_N) continue;
    if (Math.hypot(-NEAR + (i + 0.5) * COL_S - x, -NEAR + (j + 0.5) * COL_S - z) < r) COL[j * COL_N + i] = 1;
  }
}
// the posts of a roof on posts: at its corners, and along the open side of an arcade
function posts(B, along = false) {
  const c = Math.cos(B.rot), s = Math.sin(B.rot), at = (lx, lz) => [B.x + lx * c + lz * s, B.z - lx * s + lz * c];
  const out = [];
  if (along) { const n = Math.max(2, Math.round(B.w / 2) + 1); for (let k = 0; k < n; k++) out.push(at(-B.w / 2 + 0.3 + (k * (B.w - 0.6)) / (n - 1), B.d / 2 - 0.3)); }
  else for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(at(sx * (B.w / 2 - 0.4), sz * (B.d / 2 - 0.4)));
  return out;
}
export const arcadePosts = arcades.map((A) => posts(A, true));
export const stallPosts = stalls.map((S) => posts(S));
houses.forEach((H) => stampBox(H.x, H.z, H.w, H.d, H.rot));
// the church: the nave and its tower (the porch stands on posts); a chapel is a box; a ruin is its walls
const churchTower = () => ({ x: CHURCH.x + Math.sin(CHURCH.rot) * CHURCH.tz, z: CHURCH.z + Math.cos(CHURCH.rot) * CHURCH.tz, w: CHURCH.tw * 2, d: CHURCH.tw * 2, rot: CHURCH.rot });
if (CHURCH) { stampBox(CHURCH.x, CHURCH.z, CHURCH.w, CHURCH.d, CHURCH.rot); const T = churchTower(); stampBox(T.x, T.z, T.w, T.d, T.rot); }
chapels.forEach((C) => stampBox(C.x, C.z, C.w, C.d, C.rot));
export const ruinWallList = ruins.flatMap((Ru) => ruinWalls(Ru));
ruinWallList.forEach((W) => stampBox(W.x, W.z, W.w, W.d, W.rot));
for (const W of wallSegs) { const dx = W.b[0] - W.a[0], dz = W.b[1] - W.a[1]; stampBox((W.a[0] + W.b[0]) / 2, (W.a[1] + W.b[1]) / 2, 1.8, Math.hypot(dx, dz) + 0.4, Math.atan2(dx, dz)); }
for (const W of lowWalls) { const dx = W.b[0] - W.a[0], dz = W.b[1] - W.a[1]; stampBox((W.a[0] + W.b[0]) / 2, (W.a[1] + W.b[1]) / 2, 0.6, Math.hypot(dx, dz), Math.atan2(dx, dz), 0.2); }
towers.forEach((T) => { if (!T.gate) stampCircle(T.x, T.z, T.r + 0.2); });
if (HALL) posts(HALL).forEach(([x, z]) => stampCircle(x, z, 0.45));
arcadePosts.forEach((ps) => ps.forEach(([x, z]) => stampCircle(x, z, 0.4)));
stallPosts.forEach((ps) => ps.forEach(([x, z]) => stampCircle(x, z, 0.3)));
wells.forEach((W) => stampCircle(W.x, W.z, 1.3));
stampCircle(MILL.x, MILL.z, 5);
trees.forEach((T) => { if (Math.abs(T.x) < NEAR && Math.abs(T.z) < NEAR) stampCircle(T.x, T.z, T.big ? 0.9 : 0.5); });
// a garden bush blocks round its trunk; a hedge blocks its whole cell
bushes.forEach((B) => { if (B.cell) stampBox(B.cell[0], B.cell[1], CELL, CELL, 0, 0); else stampCircle(B.x, B.z, 0.7); });
props.forEach((P) => { if (P.kind === 'hay') stampCircle(P.x, P.z, P.r); else if (P.kind === 'cart') stampBox(P.x, P.z, 1.8, 2.8, P.rot); else stampCircle(P.x, P.z, 0.5); });
// the river is deep: only the bridge crosses it
for (let j = 0; j < COL_N; j++) for (let i = 0; i < COL_N; i++) {
  const x = -NEAR + (i + 0.5) * COL_S, z = -NEAR + (j + 0.5) * COL_S;
  if (riverDist(x, z) < RIVER_W - 1.5) {
    const lx = (x - BRIDGE.x) * Math.cos(BRIDGE.rot) - (z - BRIDGE.z) * Math.sin(BRIDGE.rot);
    if (Math.abs(lx) > 2.2 || Math.hypot(x - BRIDGE.x, z - BRIDGE.z) > 26) COL[j * COL_N + i] = 1;
  }
}
// a round blocker set and cleared at run time (the giant's fingertip on the ground): the cells it covers are
// saved, so whatever stood under it is blocked again when it lifts
export function blockDisc(x, z, r) {
  const saved = [];
  for (let j = Math.floor((z - r + NEAR) / COL_S); j <= Math.ceil((z + r + NEAR) / COL_S); j++) for (let i = Math.floor((x - r + NEAR) / COL_S); i <= Math.ceil((x + r + NEAR) / COL_S); i++) {
    if (i < 0 || j < 0 || i >= COL_N || j >= COL_N) continue;
    if (Math.hypot(-NEAR + (i + 0.5) * COL_S - x, -NEAR + (j + 0.5) * COL_S - z) < r) { const k = j * COL_N + i; saved.push(k, COL[k]); COL[k] = 1; }
  }
  return saved;
}
export function unblockDisc(saved) { for (let k = 0; k < saved.length; k += 2) COL[saved[k]] = saved[k + 1]; }
// how open the ground is at a point: the distance to the nearest footprint, cover or wall (capped), or -1
// where nothing can stand; a thing that comes down on open ground crushes only what is out in the open
export function clearance(x, z, cap = 40) {
  if (blocked(x, z) || inCover(x, z)) return -1;
  let best = cap;
  const box = (B) => {
    const c = Math.cos(B.rot), s = Math.sin(B.rot), px = x - B.x, pz = z - B.z;
    const lx = Math.abs(px * c - pz * s) - B.w / 2, lz = Math.abs(px * s + pz * c) - B.d / 2;
    best = Math.min(best, Math.hypot(Math.max(0, lx), Math.max(0, lz)));
  };
  for (const O of OCCLUDERS) if (!O.finger && !O.small) box(O);   // (stalls do not count: it comes down on them; a tree's crown does: the dark under it is a hide)
  for (const C of COVERS) if (!C.small) box(C);
  return best;
}
export function blocked(x, z) {
  const i = Math.floor((x + NEAR) / COL_S), j = Math.floor((z + NEAR) / COL_S);
  if (i < 2 || j < 2 || i >= COL_N - 2 || j >= COL_N - 2) return true;
  return COL[j * COL_N + i] === 1;
}

// walkable height: the bridge deck over the water
export function standY(x, z) {
  const h = height(x, z);
  const lx = (x - BRIDGE.x) * Math.cos(BRIDGE.rot) - (z - BRIDGE.z) * Math.sin(BRIDGE.rot);
  const lz = (x - BRIDGE.x) * Math.sin(BRIDGE.rot) + (z - BRIDGE.z) * Math.cos(BRIDGE.rot);
  if (Math.abs(lx) < 2.6 && Math.abs(lz) < 24) return Math.max(h, BRIDGE.deck(lz));
  return h;
}
BRIDGE.len = 44;
BRIDGE.deck = (lz) => { const e = Math.max(height(BRIDGE.x + Math.sin(BRIDGE.rot) * -22, BRIDGE.z + Math.cos(BRIDGE.rot) * -22), height(BRIDGE.x + Math.sin(BRIDGE.rot) * 22, BRIDGE.z + Math.cos(BRIDGE.rot) * 22)); return e + 1.6 - (lz / 22) ** 2 * 1.4; };

// what the town is made of, for the hiding test: boxes with their roof ridge height. Roofs on posts (the
// hall, the stalls, the arcades, the porch) block only above their eaves; tree crowns are boxes in the air.
export const OCCLUDERS = [];
{
  const roofOnly = (B, eave, ridge, alongZ = false, small = false) => { const y = height(B.x, B.z); OCCLUDERS.push({ x: B.x, z: B.z, w: B.w + 1.2, d: B.d + 1.2, rot: B.rot || 0, y0: y + eave, y1: y + eave + 0.3, ridge: y + ridge, ridgeAlongZ: alongZ, roofOnly: true, small }); };
  for (const H of houses) {
    const gy = height(H.x, H.z);
    const rise = H.tower ? 0.6 : H.gableFront ? (H.w / 2) * 1.35 : (H.d / 2) * 1.25;
    OCCLUDERS.push({ x: H.x, z: H.z, w: H.w + 0.9, d: H.d + 0.9, rot: H.rot, y0: gy - 1, y1: gy + H.h, ridge: gy + H.h + rise, ridgeAlongZ: H.gableFront });
  }
  if (CHURCH) {
    const cy = height(CHURCH.x, CHURCH.z), T = churchTower();
    OCCLUDERS.push({ x: CHURCH.x, z: CHURCH.z, w: CHURCH.w + 1, d: CHURCH.d + 1, rot: CHURCH.rot, y0: cy - 1, y1: cy + 12, ridge: cy + 12 + (CHURCH.w / 2) * 1.7, ridgeAlongZ: true });
    // `top` is the spire's iron tip as the mesh builds it (a spire two half-widths tall, a 2.4 m finial): the
    // lantern keeps clear of it; the hiding test uses `ridge` as before
    OCCLUDERS.push({ x: T.x, z: T.z, w: T.w + 0.4, d: T.d + 0.4, rot: T.rot, y0: cy - 1, y1: cy + CHURCH.towerH, ridge: cy + CHURCH.towerH + 9, ridgeAlongZ: true, top: cy + CHURCH.towerH + 2 * CHURCH.tw + 2.4 });
    if (CHURCH.porch) roofOnly({ ...CHURCH.porch, rot: CHURCH.rot }, 3.3, 5.0, true);
  }
  for (const C of chapels) { const gy = height(C.x, C.z); OCCLUDERS.push({ x: C.x, z: C.z, w: C.w + 0.9, d: C.d + 0.9, rot: C.rot, y0: gy - 1, y1: gy + 6, ridge: gy + 6 + (C.w / 2) * 1.3, ridgeAlongZ: true }); }
  for (const W of ruinWallList) { const gy = height(W.x, W.z); OCCLUDERS.push({ x: W.x, z: W.z, w: W.w + 0.4, d: W.d + 0.4, rot: W.rot, y0: gy - 1, y1: gy + W.h, ridge: gy + W.h, ridgeAlongZ: true }); }
  if (HALL) roofOnly(HALL, 3.3, 6.6);
  for (const S of stalls) roofOnly(S, 2.3, 3.3, false, true);   // (small: a fingertip the width of a lane may come down on one)
  for (const A of arcades) roofOnly(A, 3.3, 4.4);
  for (const W of wallSegs) { const dx = W.b[0] - W.a[0], dz = W.b[1] - W.a[1]; const y = height((W.a[0] + W.b[0]) / 2, (W.a[1] + W.b[1]) / 2); OCCLUDERS.push({ x: (W.a[0] + W.b[0]) / 2, z: (W.a[1] + W.b[1]) / 2, w: 1.8, d: Math.hypot(dx, dz) + 0.4, rot: Math.atan2(dx, dz), y0: y - 1, y1: y + W.h, ridge: y + W.h, ridgeAlongZ: true }); }
  for (const W of lowWalls) { const dx = W.b[0] - W.a[0], dz = W.b[1] - W.a[1]; const y = height((W.a[0] + W.b[0]) / 2, (W.a[1] + W.b[1]) / 2); OCCLUDERS.push({ x: (W.a[0] + W.b[0]) / 2, z: (W.a[1] + W.b[1]) / 2, w: 0.6, d: Math.hypot(dx, dz), rot: Math.atan2(dx, dz), y0: y - 1, y1: y + 2.1, ridge: y + 2.1, ridgeAlongZ: true }); }
  for (const T of towers) { if (T.gate) continue; const y = height(T.x, T.z); OCCLUDERS.push({ x: T.x, z: T.z, w: T.r * 1.8, d: T.r * 1.8, rot: 0, y0: y - 1, y1: y + T.h, ridge: y + T.h + 5, ridgeAlongZ: true }); }
  // a tree's crown: a box in the air. The big tree's box is narrower than its crown, so the deep spot under
  // it is a few metres across like any other tree's and not a hide the light never reaches
  for (const T of trees) { if (!T.inTown) continue; const y = height(T.x, T.z) + T.h * 0.62, r = T.r * 0.82, k = T.big ? 1.3 : 1.9; OCCLUDERS.push({ x: T.x, z: T.z, w: T.r * k, d: T.r * k, rot: 0, y0: y - r, y1: y + r, ridge: y + r, ridgeAlongZ: true }); }
}

// the covers: under a roof with no walls, where the light never reaches whatever the lantern does. The
// market hall, the arcades, the church porch, the two gate arches, and the banks under the bridge. Oriented
// rectangles {x, z, w, d, rot}, tested like the houses' footprints.
export const COVERS = [];
if (HALL) COVERS.push({ x: HALL.x, z: HALL.z, w: HALL.w - 0.4, d: HALL.d - 0.4, rot: 0, name: 'the market hall' });
for (const A of arcades) COVERS.push({ x: A.x, z: A.z, w: A.w - 0.3, d: A.d, rot: A.rot, name: 'the arcade' });
if (CHURCH && CHURCH.porch) COVERS.push({ x: CHURCH.porch.x, z: CHURCH.porch.z, w: CHURCH.porch.w + 0.6, d: CHURCH.porch.d + 0.4, rot: CHURCH.rot, name: 'the church porch' });
COVERS.push({ x: BRIDGE.x + Math.cos(BRIDGE.rot) * 3.9, z: BRIDGE.z - Math.sin(BRIDGE.rot) * 3.9, w: 2.6, d: 10, rot: BRIDGE.rot, name: 'under the bridge' });
COVERS.push({ x: BRIDGE.x - Math.cos(BRIDGE.rot) * 3.9, z: BRIDGE.z + Math.sin(BRIDGE.rot) * 3.9, w: 2.6, d: 10, rot: BRIDGE.rot, name: 'under the bridge' });
for (const T of towers) if (T.gate) COVERS.push({ x: T.x, z: T.z, w: 4.2, d: 9, rot: -T.rot, name: 'the gate' });
export function inCover(x, z) {
  for (const C of COVERS) {
    const c = Math.cos(C.rot), s = Math.sin(C.rot), px = x - C.x, pz = z - C.z;
    const lx = px * c - pz * s, lz = px * s + pz * c;
    if (Math.abs(lx) < C.w / 2 && Math.abs(lz) < C.d / 2) return C;
  }
  return null;
}

// a segment from p to q blocked by any occluder (slab test against each oriented box, with the roof as a prism).
// The giant's fingertip on the ground (O.finger) is tested on its own: it stands beside the lamp, so its
// shadow is sharp, and the hiding test gives it the centre line alone (game.js isLit)
export function segmentBlocked(p, q, which = 'all') {
  for (const O of OCCLUDERS) {
    if (which === 'finger' ? !O.finger : which === 'town' ? O.finger : false) continue;
    const c = Math.cos(O.rot), s = Math.sin(O.rot);
    const lp = [(p[0] - O.x) * c - (p[2] - O.z) * s, p[1], (p[0] - O.x) * s + (p[2] - O.z) * c];
    const lq = [(q[0] - O.x) * c - (q[2] - O.z) * s, q[1], (q[0] - O.x) * s + (q[2] - O.z) * c];
    // clip the segment to the box footprint
    let t0 = 0, t1 = 1;
    const d = [lq[0] - lp[0], lq[1] - lp[1], lq[2] - lp[2]];
    const ext = [O.w / 2, O.d / 2];
    let ok = true;
    for (const [k, e] of [[0, ext[0]], [2, ext[1]]]) {
      if (Math.abs(d[k]) < 1e-9) { if (Math.abs(lp[k]) > e) { ok = false; break; } continue; }
      let a = (-e - lp[k]) / d[k], b = (e - lp[k]) / d[k]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; }
    }
    if (!ok) continue;
    // sample the clipped piece against the roof profile
    for (let k = 0; k <= 6; k++) {
      const t = t0 + (t1 - t0) * (k / 6);
      const x = lp[0] + d[0] * t, y = lp[1] + d[1] * t, z = lp[2] + d[2] * t;
      const across = O.ridgeAlongZ ? Math.abs(x) / ext[0] : Math.abs(z) / ext[1];
      const top = O.y1 + (O.ridge - O.y1) * Math.max(0, 1 - across);
      if (y < top && y > O.y0) return true;
    }
  }
  return false;
}
