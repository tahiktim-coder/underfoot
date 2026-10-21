// UNDERFOOT — reads the hand-drawn town (townmap.js) into the layout world.js builds from: rectangles for
// the houses and every other building, the lanes and plazas, the wall traced into segments, the covers, and
// a street field for the ground map. Cells are 2 m; the map's top left cell is at (MAP_X0, MAP_Z0). No
// heights here: world.js puts the ground under everything.
import { TOWN_MAP } from './townmap.js';
import { mulberry } from '../lib/noise.js';

export const CELL = 2, MAP_X0 = -80, MAP_Z0 = -74, NI = 76;
export const LEGEND = {
  wall: '#', tower: 'T', gate: 'G', lane: '.', plaza: 'Q', yard: ':', stairs: '=', ground: ' ',
  houses: '123abcS', arcade: 'A', hall: 'H', stall: 'm', church: 'C', churchTower: 'K', porch: 'P',
  chapel: 'k', ruin: 'r', well: 'W', bigTree: 'Y', tree: 't', garden: 'g', hedge: 'h', cart: 'u', barrel: 'o', lowWall: '-|',
};
// what counts as paved (the ground map), open (a house front looks for it) and walkable (the checks)
const PAVED = '.=AHmPGQuo', OPEN = '.Q:= gtYAHmPGWuo', WALKABLE = '.Q:= gtAHmPG';
const HOUSE_KIND = { 1: 1, a: 1, 2: 2, b: 2, 3: 3, c: 3, S: 'S' };
// the quarters: the north-west is built in stone, the north-east in timber with jettied fronts; elsewhere the
// seed decides. Districts are drawn by cell so a house keeps its look when the map changes round it.
export function district(i, j) {
  if (i <= 20 && j <= 33) return 'stone';
  if (i >= 53 && j <= 31) return 'timber';
  return null;
}

const rows = TOWN_MAP.replace(/^\n/, '').replace(/\n$/, '').split('\n');
export const NJ = rows.length;
export const grid = rows.map((r) => r.padEnd(NI, ' ').slice(0, NI));
export const at = (i, j) => (j >= 0 && j < NJ && i >= 0 && i < NI ? grid[j][i] : ' ');
export const cx = (i) => MAP_X0 + (i + 0.5) * CELL, cz = (j) => MAP_Z0 + (j + 0.5) * CELL;
export const cellOf = (x, z) => [Math.floor((x - MAP_X0) / CELL), Math.floor((z - MAP_Z0) / CELL)];
export const isPaved = (ch) => PAVED.includes(ch), isOpen = (ch) => OPEN.includes(ch), isWalkable = (ch) => WALKABLE.includes(ch);

// the cells of one glyph, split into 4-connected regions
function regions(glyphs) {
  const seen = new Uint8Array(NI * NJ), out = [];
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const ch = at(i, j);
    if (!glyphs.includes(ch) || seen[j * NI + i]) continue;
    const cells = [], stack = [[i, j]]; seen[j * NI + i] = 1;
    while (stack.length) {
      const [a, b] = stack.pop(); cells.push([a, b]);
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = a + da, q = b + db;
        if (at(p, q) === ch && !seen[q * NI + p]) { seen[q * NI + p] = 1; stack.push([p, q]); }
      }
    }
    out.push({ ch, cells });
  }
  return out;
}
// a region cut into rectangles: from its top left cell, as wide as the row allows, then as deep as every row allows
function rects(region) {
  const set = new Set(region.cells.map(([i, j]) => j * NI + i)), out = [];
  const has = (i, j) => set.has(j * NI + i);
  while (set.size) {
    let first = null; for (const k of set) if (first === null || k < first) first = k;
    const i0 = first % NI, j0 = Math.floor(first / NI);
    let i1 = i0; while (has(i1 + 1, j0)) i1++;
    let j1 = j0; while ([...Array(i1 - i0 + 1)].every((_, k) => has(i0 + k, j1 + 1))) j1++;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) set.delete(j * NI + i);
    out.push({ i0, j0, i1, j1, ch: region.ch });
  }
  return out;
}
const bbox = (cells) => ({ i0: Math.min(...cells.map((c) => c[0])), j0: Math.min(...cells.map((c) => c[1])), i1: Math.max(...cells.map((c) => c[0])), j1: Math.max(...cells.map((c) => c[1])) });
const centre = (r) => [(cx(r.i0) + cx(r.i1)) / 2, (cz(r.j0) + cz(r.j1)) / 2];
const extent = (r) => [(r.i1 - r.i0 + 1) * CELL, (r.j1 - r.j0 + 1) * CELL];
// which side of a rectangle faces the most open ground (paved counts double); ties go to the sides the play
// camera sees (+z, then +x). Returns the side and the rotation that turns a building's local +z toward it.
function front(r) {
  const score = (cells) => cells.reduce((s, [i, j]) => s + (isPaved(at(i, j)) ? 2 : isOpen(at(i, j)) ? 1 : 0), 0);
  const span = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const sides = [
    { side: 'S', rot: 0, s: score(span(r.i0, r.i1).map((i) => [i, r.j1 + 1])) },
    { side: 'E', rot: Math.PI / 2, s: score(span(r.j0, r.j1).map((j) => [r.i1 + 1, j])) },
    { side: 'W', rot: -Math.PI / 2, s: score(span(r.j0, r.j1).map((j) => [r.i0 - 1, j])) },
    { side: 'N', rot: Math.PI, s: score(span(r.i0, r.i1).map((i) => [i, r.j0 - 1])) },
  ];
  return sides.reduce((b, c) => (c.s > b.s ? c : b));
}
// an oriented box from a rectangle and a front: w along the front, d away from it; walls 0.25 m inside the
// cell edges so neighbours in a terrace never share a face
function orient(r, f, inset = 0.25) {
  const [x, z] = centre(r), [ex, ez] = extent(r), along = f.side === 'S' || f.side === 'N';
  return { x, z, w: (along ? ex : ez) - 2 * inset, d: (along ? ez : ex) - 2 * inset, rot: f.rot, side: f.side };
}

// ---- houses: every rectangle of a house glyph; long terraces are cut into houses of three to five cells
const HOUSE_KINDS = {
  1: { h: [4.3, 5.0], jetty: 0, gable: 0.5, chimney: 0.75, stone: 0.15, tile: 0.3 },
  2: { h: [6.4, 7.4], jetty: 0.6, gable: 0.5, chimney: 0.75, stone: 0.2, tile: 0.3 },
  3: { h: [9.0, 10.0], jetty: 0.6, gable: 0.6, chimney: 0.9, stone: 0.25, tile: 0.35 },
  S: { h: [12.5, 13.5], jetty: 0, gable: 0, chimney: 1, stone: 1, tile: 0, tower: true },
};
function splitLong(r, R) {
  const out = [], wide = r.i1 - r.i0 >= r.j1 - r.j0, n = wide ? r.i1 - r.i0 + 1 : r.j1 - r.j0 + 1;
  if (n <= 7) return [r];
  const pieces = Math.ceil(n / 5), cuts = [0];
  for (let k = 1; k < pieces; k++) cuts.push(Math.round((n * k) / pieces + (R() - 0.5) * 1.5));
  cuts.push(n);
  for (let k = 0; k < pieces; k++) {
    const a = cuts[k], b = cuts[k + 1] - 1; if (b < a) continue;
    out.push(wide ? { ...r, i0: r.i0 + a, i1: r.i0 + b } : { ...r, j0: r.j0 + a, j1: r.j0 + b });
  }
  return out;
}
export function readHouses() {
  const out = [];
  for (const reg of regions(Object.keys(HOUSE_KIND).join(''))) {
    for (const r0 of rects(reg)) {
      const kind = HOUSE_KIND[reg.ch], K = HOUSE_KINDS[kind];
      for (const r of splitLong(r0, mulberry(r0.i0 * 131 + r0.j0 * 7))) {
        const R = mulberry(r.i0 * 977 + r.j0 * 31 + (kind === 'S' ? 5 : kind) * 3);
        const f = front(r), b = orient(r, f, 0.25 + R() * 0.12);
        const q = district(r.i0, r.j0), stone = q === 'stone' ? true : q === 'timber' ? false : R() < K.stone;
        const jettyP = q === 'timber' && kind !== 1 ? 0.9 : K.jetty;
        out.push({
          ...b, h: K.h[0] + R() * (K.h[1] - K.h[0]), seed: R(), gableFront: R() < K.gable, jetty: !stone && R() < jettyP,
          chimney: R() < K.chimney, stone, tile: R() < K.tile, tower: !!K.tower, storeys: kind === 'S' ? 4 : kind, cell: [r.i0, r.j0, r.i1, r.j1],
        });
      }
    }
  }
  return out;
}

// ---- the rest of the buildings, by glyph
const oneRect = (glyph) => { const reg = regions(glyph); return reg.length ? bbox(reg[0].cells) : null; };
export function readHall() { const r = oneRect(LEGEND.hall); if (!r) return null; const [x, z] = centre(r), [w, d] = extent(r); return { x, z, w, d, rot: 0 }; }
export function readWells() { return regions(LEGEND.well).map((reg) => ({ x: cx(reg.cells[0][0]), z: cz(reg.cells[0][1]) })); }
// carts and barrels: a cart stands along the street it is in (the way its walkable neighbours run); a barrel
// cell is a stack of three
export function readProps() {
  const out = [];
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const ch = at(i, j);
    if (ch === LEGEND.cart) {
      const ew = isWalkable(at(i - 1, j)) + isWalkable(at(i + 1, j)), ns = isWalkable(at(i, j - 1)) + isWalkable(at(i, j + 1));
      out.push({ x: cx(i), z: cz(j), kind: 'cart', rot: ew >= ns ? Math.PI / 2 : 0, seed: (i * 7 + j * 3) % 13 / 13 });
    } else if (ch === LEGEND.barrel) {
      const R = mulberry(i * 17 + j * 5 + 9);
      for (const [a, b] of [[-0.5, -0.4], [0.5, -0.3], [0, 0.5]]) out.push({ x: cx(i) + a + (R() - 0.5) * 0.2, z: cz(j) + b + (R() - 0.5) * 0.2, kind: 'barrel', rot: 0, seed: R() });
    }
  }
  return out;
}
export function readStalls() { return regions(LEGEND.stall).map((reg) => { const r = bbox(reg.cells), [x, z] = centre(r), [w, d] = extent(r); return { x, z, w, d, rot: 0, seed: (r.i0 * 7 + r.j0) % 17 / 17 }; }); }
export function readArcades() { return regions(LEGEND.arcade).flatMap((reg) => rects(reg).map((r) => ({ ...orient(r, front(r), 0), seed: (r.i0 * 3 + r.j0) % 11 / 11 }))); }
export function readChapels() { return regions(LEGEND.chapel).map((reg) => { const r = bbox(reg.cells); return { ...orient(r, front(r), 0.3), seed: 0.37 }; }); }
export function readRuins() { return regions(LEGEND.ruin).map((reg) => { const r = bbox(reg.cells); return { ...orient(r, front(r), 0.3), seed: (r.i0 + r.j0 * 3) % 13 / 13 }; }); }
export function readTrees() {
  const out = [];
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const ch = at(i, j); if (ch !== LEGEND.tree && ch !== LEGEND.bigTree) continue;
    const R = mulberry(i * 53 + j * 11 + 1), big = ch === LEGEND.bigTree;
    out.push({ x: cx(i) + (R() - 0.5) * 0.6, z: cz(j) + (R() - 0.5) * 0.6, h: big ? 16 + R() * 2 : 9.5 + R() * 3, r: big ? 6 + R() : 3 + R() * 0.8, seed: R(), kind: 1, inTown: true, big });
  }
  return out;
}
// bushes: on a garden's rim (a garden cell beside something built, about two in three), so the middle of a
// garden is open grass you can cross; and every hedge cell (a hedge cell is blocked whole: `cell` says so)
export function readBushes() {
  const out = [];
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const ch = at(i, j), hedge = ch === LEGEND.hedge;
    if (ch !== LEGEND.garden && !hedge) continue;
    const R = mulberry(i * 29 + j * 71 + 3);
    const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const n = at(i + a, j + b); return !isWalkable(n) && n !== LEGEND.hedge; });
    if (!hedge && (!rim || R() < 0.6)) continue;
    // a hedge is a bush on every cell along its edge; inside a thick band (under the wall) half the cells are
    // bare ground, still blocked
    if (hedge) { const edge = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([a, b]) => isWalkable(at(i + a, j + b))); if (!edge && R() < 0.5) { out.push({ x: cx(i), z: cz(j), h: 0, r: 0, seed: 0, kind: 1, cell: [cx(i), cz(j)], bare: true }); continue; } }
    const jit = hedge ? 0.5 : 1.2;
    out.push({ x: cx(i) + (R() - 0.5) * jit, z: cz(j) + (R() - 0.5) * jit, h: hedge ? 2.0 + R() * 0.7 : 2.4 + R() * 0.8, r: hedge ? 1.25 + R() * 0.2 : 1.1 + R() * 0.4, seed: R(), kind: 1, cell: hedge ? [cx(i), cz(j)] : null });
  }
  return out;
}
// the church: the nave, with its tower at one end (the local +z end) and the porch beyond the tower
export function readChurch() {
  const nave = oneRect(LEGEND.church), tow = oneRect(LEGEND.churchTower), por = oneRect(LEGEND.porch);
  if (!nave || !tow) return null;
  const [x, z] = centre(nave), [tx, tz] = centre(tow), dx = tx - x, dz = tz - z;
  const rot = Math.abs(dz) >= Math.abs(dx) ? (dz > 0 ? 0 : Math.PI) : dx > 0 ? Math.PI / 2 : -Math.PI / 2;
  const lz = (px, pz) => (px - x) * Math.sin(rot) + (pz - z) * Math.cos(rot);
  const along = rot === 0 || rot === Math.PI, [ex, ez] = extent(nave), [tex, tez] = extent(tow);
  const C = { x, z, w: along ? ex : ez, d: along ? ez : ex, rot, tw: Math.min(tex, tez) / 2 - 0.4, tz: lz(tx, tz), towerH: 24 };
  if (por) { const [px, pz] = centre(por), [pex, pez] = extent(por); C.porch = { x: px, z: pz, w: along ? pex : pez, d: along ? pez : pex, pz: lz(px, pz) }; }
  return C;
}
// the plazas: each Q region's box, the biggest first (that one is the square)
export function readPlazas() {
  return regions(LEGEND.plaza).map((reg) => { const r = bbox(reg.cells), [x, z] = centre(r), [w, d] = extent(r); return { x, z, w, d, cells: reg.cells.length }; }).sort((a, b) => b.cells - a.cells);
}
// stairs: lane cells with steps; each knows which way the lane runs through it
export function readStairs() {
  const out = [];
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    if (at(i, j) !== LEGEND.stairs) continue;
    const alongX = isWalkable(at(i - 1, j)) && isWalkable(at(i + 1, j)) && !(isWalkable(at(i, j - 1)) && isWalkable(at(i, j + 1)));
    out.push({ x: cx(i), z: cz(j), alongX });
  }
  return out;
}
// the streets as segments for the strollers: runs of lane cells four or more long, both ways
export function readStreets() {
  const out = [], lane = (i, j) => at(i, j) === LEGEND.lane || at(i, j) === LEGEND.stairs;
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    if (lane(i, j) && !lane(i - 1, j)) { let k = i; while (lane(k + 1, j)) k++; if (k - i >= 3) out.push({ a: [cx(i), cz(j)], b: [cx(k), cz(j)], w: 2 }); }
    if (lane(i, j) && !lane(i, j - 1)) { let k = j; while (lane(i, k + 1)) k++; if (k - j >= 3) out.push({ a: [cx(i), cz(j)], b: [cx(i), cz(k)], w: 2 }); }
  }
  return out;
}
// low walls: runs of the wall glyphs, each way; a run is one segment from the first cell's edge to the last's
export function readLowWalls() {
  const out = [], low = (i, j) => LEGEND.lowWall.includes(at(i, j));
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    if (!low(i, j)) continue;
    if (!low(i - 1, j) && low(i + 1, j)) { let k = i; while (low(k + 1, j)) k++; out.push({ a: [cx(i) - 1, cz(j)], b: [cx(k) + 1, cz(j)] }); }
    if (!low(i, j - 1) && low(i, j + 1)) { let k = j; while (low(i, k + 1)) k++; out.push({ a: [cx(i), cz(j) - 1], b: [cx(i), cz(k) + 1] }); }
    if (!low(i - 1, j) && !low(i + 1, j) && !low(i, j - 1) && !low(i, j + 1)) out.push({ a: [cx(i) - 1, cz(j)], b: [cx(i) + 1, cz(j)] });
  }
  return out;
}

// ---- the wall: the ring of wall cells walked round in order, then straightened into segments. The gates cut it.
const RING = LEGEND.wall + LEGEND.tower + LEGEND.gate;
function traceRing() {
  let start = null;
  for (let j = 0; j < NJ && !start; j++) for (let i = 0; i < NI; i++) if (RING.includes(at(i, j))) { start = [i, j]; break; }
  if (!start) return [];
  const seen = new Set(), loop = [];
  let cur = start, dir = [1, 0];
  const N4 = [[1, 0], [0, 1], [-1, 0], [0, -1]], N8 = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  while (cur) {
    seen.add(cur[1] * NI + cur[0]); loop.push({ i: cur[0], j: cur[1], ch: at(cur[0], cur[1]) });
    let next = null;
    for (const set of [N4, N8]) {
      const cands = set.map(([a, b]) => [cur[0] + a, cur[1] + b]).filter(([a, b]) => RING.includes(at(a, b)) && !seen.has(b * NI + a));
      if (cands.length) { cands.sort((p, q) => (q[0] - cur[0]) * dir[0] + (q[1] - cur[1]) * dir[1] - ((p[0] - cur[0]) * dir[0] + (p[1] - cur[1]) * dir[1])); next = cands[0]; break; }
    }
    if (next) dir = [Math.sign(next[0] - cur[0]), Math.sign(next[1] - cur[1])];
    cur = next;
  }
  return loop;
}
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  let far = 0, fi = 0;
  for (let k = 1; k < pts.length - 1; k++) { const d = Math.abs((pts[k][0] - a[0]) * dz - (pts[k][1] - a[1]) * dx) / L; if (d > far) { far = d; fi = k; } }
  if (far <= tol) return [a, b];
  return [...simplify(pts.slice(0, fi + 1), tol).slice(0, -1), ...simplify(pts.slice(fi), tol)];
}
export function readWall() {
  const loop = traceRing();
  const gi = loop.findIndex((c) => c.ch === LEGEND.gate);
  const ring = gi < 0 ? loop : [...loop.slice(gi), ...loop.slice(0, gi)];
  // runs of wall cells (the pieces) and runs of gate cells, in order round the ring
  const pieces = [], gateRuns = [];
  for (const c of ring) {
    const list = c.ch === LEGEND.gate ? gateRuns : pieces, prev = list[list.length - 1];
    const last = ring[ring.indexOf(c) - 1];
    if (prev && last && last.ch === LEGEND.gate === (c.ch === LEGEND.gate)) prev.push(c); else list.push([c]);
  }
  // with no gate at all the loop closes: the last piece joins the first
  if (gi < 0 && pieces.length > 1) pieces[0] = [...pieces.pop(), ...pieces[0]];
  const segs = [];
  for (const p of pieces) {
    // the raster zigzag is smoothed over five cells before the chords are fitted
    const pts = p.map((c) => [cx(c.i), cz(c.j)]);
    const sm = pts.map((_, k) => { let x = 0, z = 0, n = 0; for (let q = -2; q <= 2; q++) { const o = pts[Math.min(pts.length - 1, Math.max(0, k + q))]; x += o[0]; z += o[1]; n++; } return [x / n, z / n]; });
    sm[0] = pts[0]; sm[sm.length - 1] = pts[pts.length - 1];
    const line = simplify(sm, 0.45);
    for (let k = 0; k < line.length - 1; k++) {
      // long chords are cut so heights can vary along the wall
      const a = line[k], b = line[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 10));
      for (let q = 0; q < n; q++) segs.push({ a: [a[0] + (b[0] - a[0]) * (q / n), a[1] + (b[1] - a[1]) * (q / n)], b: [a[0] + (b[0] - a[0]) * ((q + 1) / n), a[1] + (b[1] - a[1]) * ((q + 1) / n)] });
    }
  }
  // the gates: the middle of each run of gate cells, and the wall's direction through it
  const gates = gateRuns.map((run) => {
    const r = bbox(run.map((c) => [c.i, c.j])), [x, z] = centre(r);
    let wx = r.i1 > r.i0 ? 1 : 0, wz = r.j1 > r.j0 ? 1 : 0;
    if (!wx && !wz) { const nb = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([a, b]) => RING.includes(at(r.i0 + a, r.j0 + b))) || [0, 1]; wx = Math.abs(nb[0]); wz = Math.abs(nb[1]); }
    return { x, z, rot: Math.atan2(wz, wx) };
  });
  const towers = loop.filter((c) => c.ch === LEGEND.tower).map((c) => ({ x: cx(c.i), z: cz(c.j) }));
  return { segs, gates, towers, loop };
}

// the street field for the ground map: 1 on paving, 0.6 on yard paving, 0 elsewhere, blended between cells
export function streetAt(x, z) {
  const fi = (x - MAP_X0) / CELL - 0.5, fj = (z - MAP_Z0) / CELL - 0.5, i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
  const val = (a, b) => { const ch = at(a, b); return isPaved(ch) ? 1 : ch === LEGEND.yard ? 0.6 : 0; };
  return val(i, j) * (1 - u) * (1 - v) + val(i + 1, j) * u * (1 - v) + val(i, j + 1) * (1 - u) * v + val(i + 1, j + 1) * u * v;
}

// everything, read once
export const LAYOUT = {
  houses: readHouses(), hall: readHall(), wells: readWells(), stalls: readStalls(), arcades: readArcades(), chapels: readChapels(), ruins: readRuins(),
  trees: readTrees(), bushes: readBushes(), church: readChurch(), plazas: readPlazas(), stairs: readStairs(), streets: readStreets(), lowWalls: readLowWalls(),
  props: readProps(), wall: readWall(),
};

// a ruin's four walls as oriented boxes, with a doorway in the middle of the front (local +z) wall
export function ruinWalls(Ru) {
  const c = Math.cos(Ru.rot), s = Math.sin(Ru.rot), t = 0.7, hw = Ru.w / 2, hd = Ru.d / 2;
  const at = (lx, lz, w, d, h) => ({ x: Ru.x + lx * c + lz * s, z: Ru.z - lx * s + lz * c, w, d, rot: Ru.rot, h, lx, lz });
  const door = 1.8, side = (hw - door / 2) / 2 + door / 2;
  return [
    at(0, -hd + t / 2, Ru.w, t, 4.6),
    at(-hw + t / 2, 0, t, Ru.d - 2 * t, 3.4), at(hw - t / 2, 0, t, Ru.d - 2 * t, 5.0),
    at(-side - door / 4 + t / 4, hd - t / 2, hw - door / 2, t, 2.8), at(side + door / 4 - t / 4, hd - t / 2, hw - door / 2, t, 3.8),
  ];
}
