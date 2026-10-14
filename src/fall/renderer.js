// UNDERFOOT — the renderer. Owns every GPU resource and draws one frame from a plain `scene` object.
// Frame: sun shadow maps (the town, sharp; the giant and the land, wide and soft), the lantern's shadow map,
// then the scene at 386x218 in colour (sky, land, town, giant, the per-frame mesh, clouds, dust, birds,
// ash), then the palette pass, then post at screen size.
import { getGL, program, texture, framebuffer, VS_TRI, fitCanvas } from '../lib/gl.js';
import { mul, lookAt, ortho } from '../lib/mat4.js';
import * as SH from './shaders.js';
import { buildWorld, buildTerrain, STRIDE, makeArr } from './mesh.js';
import { noiseTex, nearMap, farMap } from './textures.js';
import { mulberry } from '../lib/noise.js';

export const LW = 386, LH = 218, VW = 384, VH = 216;
// The default palette (the Ashwake grey look): eight warm greys, then amber, moss, slate and rust ramps. The game
// replaces it with the current look's palette at start and on every look change (setPalette, looks.js).
const GREYS = ['#0f0e10', '#1f1d20', '#34313a', '#4d494c', '#6b6667', '#8e8884', '#b5aea6', '#dfd9cf'];
const HUES = [
  ['#2a2118', '#4b3b29', '#725b3d', '#9f8151', '#cfaa69'],   // amber
  ['#1d231c', '#303a2c', '#4a5741', '#6a7757', '#8f9a74'],   // moss
  ['#1a2028', '#2d3542', '#465161', '#697482', '#919ba7'],   // slate
  ['#281917', '#442824', '#653e34', '#88584a', '#ab7966'],   // rust
];
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const luma = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
// A palette for the snap: up to 8 neutral steps and up to 4 hue ramps of 5, padded to the shader's fixed sizes.
export function buildPalette(greys, hues) {
  const g = greys.map(hex3), nGrey = g.length;
  while (g.length < 8) g.push(g[g.length - 1]);
  const hs = hues.map((r) => r.map(hex3)), nHue = hs.length;
  while (hs.length < 4) hs.push(hs[0] || [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  const ramp = [...g, ...hs.flat()];
  const dir = (c) => { const Y = luma(c), u = c[2] - Y, v = c[0] - Y, l = Math.hypot(u, v) || 1; return [u / l, v / l]; };
  return { ramp: ramp.flat(), rampL: ramp.map(luma), hueDir: hs.map((r) => dir(r[3])).flat(), nGrey, nHue };
}

function perspective(fovy, aspect, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
}
function invert(m) {
  const inv = new Float32Array(16), a = m;
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  let det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12]; det = 1 / det;
  for (let i = 0; i < 16; i++) inv[i] *= det;
  return inv;
}
// six frustum planes from a view-projection matrix; aabb test
function planes(M) {
  const r = (i) => [M[i], M[4 + i], M[8 + i], M[12 + i]];
  const r0 = r(0), r1 = r(1), r2 = r(2), r3 = r(3);
  return [r3.map((v, i) => v + r0[i]), r3.map((v, i) => v - r0[i]), r3.map((v, i) => v + r1[i]), r3.map((v, i) => v - r1[i]), r3.map((v, i) => v + r2[i]), r3.map((v, i) => v - r2[i])];
}
function boxIn(P, bb) {
  for (const p of P) {
    const x = p[0] > 0 ? bb[3] : bb[0], y = p[1] > 0 ? bb[4] : bb[1], z = p[2] > 0 ? bb[5] : bb[2];
    if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false;
  }
  return true;
}
export function xform(M, p) { return [0, 1, 2, 3].map((r) => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r]); }

function attribs(gl) {
  const st = STRIDE * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, st, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 28);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, st, 36);
}
function inst(gl, buf, loc0, nvec) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (let k = 0; k < nvec; k++) { gl.enableVertexAttribArray(loc0 + k); gl.vertexAttribPointer(loc0 + k, 4, gl.FLOAT, false, nvec * 16, k * 16); gl.vertexAttribDivisor(loc0 + k, 1); }
}

export function createRenderer(canvas, giantMesh) {
  const gl = getGL(canvas);
  if (!gl) return null;
  const T0 = performance.now();
  const world = buildWorld(), terr = buildTerrain();
  const P = {
    mesh: program(gl, SH.VS_MESH, SH.FS_MESH, 'mesh'),
    giant: program(gl, SH.VS_GIANT, SH.FS_MESH, 'giant'),
    depth: program(gl, SH.VS_DEPTH, SH.FS_DEPTH, 'depth'),
    gdepth: program(gl, SH.VS_GIANT_DEPTH, SH.FS_DEPTH, 'gdepth'),
    sky: program(gl, VS_TRI, SH.FS_SKY, 'sky'),
    clouds: program(gl, VS_TRI, SH.FS_CLOUDS, 'clouds'),
    puff: program(gl, SH.VS_PUFF, SH.FS_PUFF, 'puff'),
    ash: program(gl, SH.VS_ASH, SH.FS_ASH, 'ash'),
    bird: program(gl, SH.VS_BIRD, SH.FS_BIRD, 'bird'),
    quant: program(gl, VS_TRI, SH.FS_QUANT, 'quant'),
    post: program(gl, VS_TRI, SH.FS_POST, 'post'),
  };
  const buf = (data, usage = gl.STATIC_DRAW, target = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
  const vao = (vbo, ibo) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); attribs(gl); if (ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bindVertexArray(null); return v; };
  const worldVAO = vao(buf(world.data));
  const terrVAO = vao(buf(terr.v), buf(terr.idx, gl.STATIC_DRAW, gl.ELEMENT_ARRAY_BUFFER));
  const giantVAO = vao(buf(giantMesh.data));
  const giantN = giantMesh.data.length / STRIDE;
  const dyn = makeArr(1 << 16); let dynCap = 1 << 16;
  const dynVBO = buf(new Float32Array(dynCap), gl.DYNAMIC_DRAW), dynVAO = vao(dynVBO);

  // billboards
  const quadC = buf(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
  const bbVAO = (store, nvec) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, quadC); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); inst(gl, store, 1, nvec); gl.bindVertexArray(null); return v; };
  // dust puffs and clods: a ring of 12-float records
  const PUFFS = 2048, puffData = new Float32Array(PUFFS * 12), puffBuf = buf(puffData, gl.DYNAMIC_DRAW), puffVAO = bbVAO(puffBuf, 3);
  let puffHead = 0, puffDirty = false;
  const birdsData = new Float32Array(256 * 4), birdBuf = buf(birdsData, gl.DYNAMIC_DRAW), birdVAO = bbVAO(birdBuf, 1);
  const NASH = 1400, ashData = new Float32Array(NASH * 4), RA = mulberry(5);
  for (let i = 0; i < ashData.length; i++) ashData[i] = RA();
  const ashVAO = gl.createVertexArray(); gl.bindVertexArray(ashVAO); buf(ashData); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0); gl.bindVertexArray(null);

  // textures and targets
  const tNoise = noiseTex(gl), tNear = nearMap(gl), tFar = farMap(gl);
  const SHS = 2048, GSS = 2048, LTS = 1024;
  const tSh = texture(gl, SHS, SHS, { fmt: 'depth' }), fSh = framebuffer(gl, null, tSh);
  const tGSh = texture(gl, GSS, GSS, { fmt: 'depth' }), fGSh = framebuffer(gl, null, tGSh);
  const tLt = texture(gl, LTS, LTS, { fmt: 'depth' }), fLt = framebuffer(gl, null, tLt);
  const tScene = texture(gl, LW, LH, { fmt: 'rgba8' }), tSceneD = texture(gl, LW, LH, { fmt: 'depth' }), fScene = framebuffer(gl, tScene, tSceneD);
  gl.bindTexture(gl.TEXTURE_2D, tSceneD); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.NONE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const tScene2 = texture(gl, LW, LH, { fmt: 'rgba8' }), fScene2 = framebuffer(gl, tScene2);
  const tQ = texture(gl, LW, LH, { fmt: 'rgba8', filter: 'linear' }), fQ = framebuffer(gl, tQ);
  const uiCanvas = document.createElement('canvas'); uiCanvas.width = VW; uiCanvas.height = VH;
  const uictx = uiCanvas.getContext('2d');
  const tUI = texture(gl, VW, VH, { fmt: 'rgba8' });
  const emptyVAO = gl.createVertexArray();
  const genMs = performance.now() - T0;

  const view = { VP: null, frac: [0, 0], eye: [0, 0, 0] };
  let PAL = buildPalette(GREYS, HUES);
  function project(p) {
    if (!view.VP) return [-99, -99, false, 0];
    const c = xform(view.VP, p);
    const x = (c[0] / c[3] * 0.5 + 0.5) * LW - 1 - view.frac[0];
    const y = VH + 1 + view.frac[1] - (c[1] / c[3] * 0.5 + 0.5) * LH;
    return [x, y, c[3] > 0 && x > -8 && x < VW + 8 && y > -8 && y < VH + 8, c[2] / c[3] * 0.5 + 0.5];
  }

  function drawTerrain(PL, rings) {
    gl.bindVertexArray(terrVAO);
    for (const r of terr.ranges) if (rings[r.ring] && (!PL || boxIn(PL, r.bb))) gl.drawElements(gl.TRIANGLES, r.n, gl.UNSIGNED_INT, r.off * 4);
  }
  function drawWorld(PL) {
    gl.bindVertexArray(worldVAO);
    for (const r of world.ranges) if (!PL || boxIn(PL, r.bb)) gl.drawArrays(gl.TRIANGLES, r.first, r.n);
  }
  function drawDyn() { if (dyn.n) { gl.bindVertexArray(dynVAO); gl.drawArrays(gl.TRIANGLES, 0, dyn.n / STRIDE); } }

  // a sun-aligned orthographic shadow camera round a centre, texel-snapped
  function sunCam(sun, c, R, depth, S) {
    const lv = lookAt([c[0] + sun[0] * depth, c[1] + sun[1] * depth, c[2] + sun[2] * depth], c, Math.abs(sun[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
    const texel = (2 * R) / S;
    const lx = lv[0] * c[0] + lv[4] * c[1] + lv[8] * c[2], ly = lv[1] * c[0] + lv[5] * c[1] + lv[9] * c[2];
    const dx = Math.round(lx / texel) * texel - lx, dy = Math.round(ly / texel) * texel - ly;
    return mul(ortho(-R + dx, R + dx, -R + dy, R + dy, 1, depth * 2), lv);
  }

  function render(scene) {
    fitCanvas(canvas, 2);
    const t = scene.t, cam = scene.cam, L = scene.light;
    if (dyn.n > dynCap) { dynCap = dyn.data.length; gl.bindBuffer(gl.ARRAY_BUFFER, dynVBO); gl.bufferData(gl.ARRAY_BUFFER, dynCap * 4, gl.DYNAMIC_DRAW); }
    if (dyn.n) { gl.bindBuffer(gl.ARRAY_BUFFER, dynVBO); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn.data); }
    if (puffDirty) { gl.bindBuffer(gl.ARRAY_BUFFER, puffBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, puffData); puffDirty = false; }

    // ---- camera: perspective, nearly orthographic in play; the target snaps to whole low-res pixels
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const off = [Math.sin(cam.yaw) * cp, sp, Math.cos(cam.yaw) * cp];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const fw = [-off[0], -off[1], -off[2]];
    const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
    const px = (2 * cam.hh) / LH;
    const cx = cam.x * right[0] + cam.y * right[1] + cam.z * right[2], cy = cam.x * up[0] + cam.y * up[1] + cam.z * up[2];
    const snapK = cam.snap ?? 1;
    const sx = Math.round(cx / px) * px, sy = Math.round(cy / px) * px;
    const tgt = [cam.x + (right[0] * (sx - cx) + up[0] * (sy - cy)) * snapK, cam.y + (right[1] * (sx - cx) + up[1] * (sy - cy)) * snapK, cam.z + (right[2] * (sx - cx) + up[2] * (sy - cy)) * snapK];
    const frac = [((cx - sx) / px) * snapK, ((cy - sy) / px) * snapK];
    const D = cam.D;
    const eye = [tgt[0] + off[0] * D, tgt[1] + off[1] * D, tgt[2] + off[2] * D];
    const viewM = lookAt(eye, tgt, [0, 1, 0]);
    const near = cam.near ?? Math.max(20, D - 1000), far = cam.far ?? D + 24000;
    const fov = 2 * Math.atan(cam.hh / D);
    const VP = mul(perspective(fov, LW / LH, near, far), viewM);
    view.VP = VP; view.frac = frac; view.eye = eye;
    const PLv = planes(VP);

    // ---- shadow maps
    const sun = L.sun;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    // the town, around what the camera sees
    const localOn = cam.hh < 260;
    let LVP = null;
    if (localOn) {
      const R = Math.max(40, cam.hh * 2.2) + 40;
      LVP = sunCam(sun, [cam.x, cam.y, cam.z], R, 900, SHS);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fSh); gl.viewport(0, 0, SHS, SHS); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.polygonOffset(1.6, 3.0);
      const PLs = planes(LVP);
      P.depth.use().set('uLVP', LVP);
      drawTerrain(PLs, [1, 0, 0]); drawWorld(PLs); drawDyn();
    }
    // the giant and the land, wide
    const GR = Math.max(5200, cam.hh * 3.2);
    const gc = scene.gCentre || [cam.x, 0, cam.z];
    const GVP = sunCam(sun, gc, GR, 16000, GSS);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fGSh); gl.viewport(0, 0, GSS, GSS); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.polygonOffset(2.0, 4.0);
    const PLg = planes(GVP);
    P.depth.use().set('uLVP', GVP);
    drawTerrain(PLg, [0, 1, 1]);
    if (scene.giant) { P.gdepth.use().set('uLVP', GVP).set('uBones', scene.giant.bones).set('uSway', scene.giant.sway); gl.bindVertexArray(giantVAO); gl.drawArrays(gl.TRIANGLES, 0, giantN); }
    if (scene.dynInGiantShadow) { P.depth.use().set('uLVP', GVP); drawDyn(); }
    // the lantern: a spot looking down its axis
    const lan = scene.lantern;
    let LtVP = null;
    if (lan && lan.on > 0) {
      const tgtL = [lan.pos[0] + lan.dir[0] * 100, lan.pos[1] + lan.dir[1] * 100, lan.pos[2] + lan.dir[2] * 100];
      const lv = lookAt(lan.pos, tgtL, Math.abs(lan.dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
      LtVP = mul(perspective(Math.acos(lan.cosOuter) * 2 + 0.1, 1, 20, 3000), lv);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fLt); gl.viewport(0, 0, LTS, LTS); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.polygonOffset(1.2, 2.0);
      const PLl = planes(LtVP);
      P.depth.use().set('uLVP', LtVP);
      drawTerrain(PLl, [1, 0, 0]); drawWorld(PLl); drawDyn();
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // ---- scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, fScene); gl.viewport(0, 0, LW, LH);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const fd = Math.min(D, cam.hh * 6);
    const fogCam = [tgt[0] + off[0] * fd, tgt[1] + off[1] * fd, tgt[2] + off[2] * fd];
    const common = (p) => p.set('uTime', t).set('uCam', eye[0], eye[1], eye[2]).set('uFogCam', fogCam[0], fogCam[1], fogCam[2]).set('uSun', sun[0], sun[1], sun[2]).set('uSunCol', L.sunCol).set('uSkyCol', L.skyCol).set('uGndCol', L.gndCol)
      .set('uFogCol', L.fogCol).set('uFogSunCol', L.fogSunCol).set('uFogA', L.fogA).set('uFogB', L.fogB).set('uExposure', L.exposure).tex('uNoise', tNoise, 3);
    // sky first, under everything
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    common(P.sky.use()).set('uInvVP', invert(VP)).set('uStars', scene.stars ?? 0).set('uSunSize', scene.sunSize ?? 1).set('uSunDisc', scene.sunDisc ?? 1.4);
    gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    let cutP = [0, 0, 0, 0];
    if (scene.cut) { const c = xform(VP, scene.cut); cutP = [(c[0] / c[3] * 0.5 + 0.5) * LW, (c[1] / c[3] * 0.5 + 0.5) * LH, c[2] / c[3] * 0.5 + 0.5, 3.0 / px]; }
    const meshU = (p) => {
      common(p.use()).set('uVP', VP).set('uLVP', LVP || VP).set('uGVP', GVP).set('uLtVP', LtVP || VP)
        .set('uShTexel', 1 / SHS, 1 / SHS).set('uGShTexel', 1 / GSS, 1 / GSS).set('uLtTexel', 1 / LTS, 1 / LTS).set('uLocalOn', localOn ? 1 : 0)
        .set('uLan', lan && lan.on > 0 ? [lan.pos[0], lan.pos[1], lan.pos[2], lan.I * lan.on] : [0, 0, 0, 0]).set('uLanDir', lan ? [lan.dir[0], lan.dir[1], lan.dir[2], lan.cosOuter] : [0, -1, 0, 0.9]).set('uLanInner', lan ? lan.cosInner : 0.95).set('uLanCol', L.lanCol)
        .set('uEye', scene.eye ?? 1).set('uSnow', scene.snow ?? 0).set('uWin', scene.windows ?? 0.5).set('uCloudShadow', scene.cloudShadow ?? 1).set('uWind', 7, 2.5).set('uHoleC', scene.holeC || [-300, 0]).set('uCloudCov', scene.cloudCov ?? 0).set('uPrints', scene.prints || new Float32Array(24)).set('uCut', cutP)
        .tex('uNearMap', tNear, 0).tex('uFarMap', tFar, 1).tex('uShadow', tSh, 2).tex('uGShadow', tGSh, 4).tex('uLtShadow', tLt, 5);
      return p;
    };
    meshU(P.mesh).set('uIsGiant', 0);
    drawTerrain(PLv, [1, 1, 1]);
    drawWorld(PLv);
    drawDyn();
    if (scene.giant) {
      meshU(P.giant).set('uIsGiant', 1).set('uBones', scene.giant.bones).set('uSway', scene.giant.sway);
      gl.bindVertexArray(giantVAO); gl.drawArrays(gl.TRIANGLES, 0, giantN);
    }
    // dust and clods
    common(P.puff.use()).set('uVP', VP).set('uHH', cam.hh).set('uRight', right[0], right[1], right[2]).set('uUp', up[0], up[1], up[2]).set('uLanOn', lan && lan.on > 0 ? 1 : 0).set('uLanPos', lan ? [lan.pos[0], lan.pos[1], lan.pos[2], lan.I * lan.on] : [0, 0, 0, 0]).set('uLanDir', lan ? [lan.dir[0], lan.dir[1], lan.dir[2], lan.cosOuter] : [0, -1, 0, 0.9]);
    gl.bindVertexArray(puffVAO); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, PUFFS);
    // birds
    const nb = Math.min(256, (scene.birds || []).length);
    if (nb) {
      scene.birds.slice(0, nb).forEach((b, i) => birdsData.set(b, i * 4));
      gl.bindBuffer(gl.ARRAY_BUFFER, birdBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, birdsData, 0, nb * 4);
      P.bird.use().set('uVP', VP).set('uRight', right[0], right[1], right[2]).set('uSize', Math.max(0.5, px * 1.4));
      gl.bindVertexArray(birdVAO); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nb);
    }
    // ash
    if ((scene.ash ?? 1) > 0 && cam.hh < 200) {
      gl.depthMask(false);
      P.ash.use().set('uLan', lan && lan.on > 0 ? [lan.pos[0], lan.pos[1], lan.pos[2], lan.I * lan.on] : [0, 0, 0, 0]).set('uLanDir', lan ? [lan.dir[0], lan.dir[1], lan.dir[2], lan.cosOuter] : [0, -1, 0, 0.9]).set('uVP', VP).set('uCenter', cam.x, cam.y, cam.z).set('uTime', t).set('uBox', Math.max(60, cam.hh * 3)).set('uFall', scene.ashFall ?? 1).set('uAshLum', scene.ashLum ?? 0.7);
      gl.bindVertexArray(ashVAO); gl.drawArrays(gl.POINTS, 0, Math.floor(NASH * (scene.ash ?? 1)));
      gl.depthMask(true);
    }
    gl.disable(gl.DEPTH_TEST);

    // ---- clouds over the scene
    let src = tScene;
    gl.bindVertexArray(emptyVAO);
    if ((scene.cloudK ?? 0) > 0.01) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fScene2); gl.viewport(0, 0, LW, LH);
      common(P.clouds.use()).set('uInvVP', invert(VP)).set('uCloudK', scene.cloudK).set('uCloudNear', scene.cloudNear ?? 650).set('uWind', 7, 2.5).set('uHoleC', scene.holeC || [-300, 0]).set('uCloudCov', scene.cloudCov ?? 0)
        .tex('uScene', tScene, 0).tex('uDepth', tSceneD, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = tScene2;
    }
    // ---- palette, UI, post
    gl.bindFramebuffer(gl.FRAMEBUFFER, fQ); gl.viewport(0, 0, LW, LH);
    const gl4 = (typeof scene.glows === 'function' ? scene.glows() : scene.glows || []).slice(0, 4), gA = new Float32Array(16), gB = new Float32Array(16);
    gl4.forEach((g, i) => { gA.set([g[0] + frac[0], g[1] - frac[1], g[2], g[3]], i * 4); gB.set([g[4], g[5], 0, 0], i * 4); });
    // where the sun is on screen, and how much it faces us
    const sunP = xform(VP, [eye[0] + sun[0] * 1e5, eye[1] + sun[1] * 1e5, eye[2] + sun[2] * 1e5]);
    const facing = fw[0] * sun[0] + fw[1] * sun[1] + fw[2] * sun[2];
    const shafts = sunP[3] > 0 ? Math.max(0, Math.min(1, (facing - 0.25) / 0.5)) * (scene.shafts ?? 1) * Math.min(1, Math.max(0, (cam.hh - 60) / 200)) : 0;
    const sunScr = sunP[3] > 0 ? [(sunP[0] / sunP[3] * 0.5 + 0.5) * LW, (sunP[1] / sunP[3] * 0.5 + 0.5) * LH, shafts] : [0, 0, 0];
    P.quant.use().set('uSunScr', sunScr).set('uGlowA', gA).set('uGlowB', gB).set('uNGlow', gl4.length).tex('uDepth', tSceneD, 1).tex('uSrc', src, 0).set('uRamp', PAL.ramp).set('uRampL', PAL.rampL).set('uHueDir', PAL.hueDir).set('uNGrey', PAL.nGrey).set('uNHue', PAL.nHue).set('uDither', scene.dither ?? 0).set('uBloom', scene.bloom ?? 0).set('uLanGlow', scene.lanGlow || [1.0, 0.7, 0.38])
      .set('uChromaLo', scene.chromaLo ?? 0.05).set('uChromaHi', scene.chromaHi ?? 0.14).set('uContrast', scene.contrast ?? 1.05).set('uLift', scene.lift ?? 0).set('uGamma', scene.gamma ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const uiOn = scene.ui ? scene.ui(uictx, api) : false;
    if (uiOn) { gl.bindTexture(gl.TEXTURE_2D, tUI); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, uiCanvas); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    P.post.use().tex('uQ', tQ, 0).tex('uUI', tUI, 1).set('uLow', LW, LH).set('uView', VW, VH).set('uOff', frac[0] + (scene.shake ? scene.shake[0] : 0), frac[1] + (scene.shake ? scene.shake[1] : 0))
      .set('uCanvas', canvas.width, canvas.height).set('uTime', t).set('uTilt', scene.tilt ?? 1).set('uFocus', scene.focus ?? 0.5).set('uGrain', scene.grain ?? 0.045)
      .set('uUIon', uiOn ? 1 : 0).set('uFade', scene.fade || 0).set('uFlash', scene.flash || 0).set('uVig', scene.vignette ?? 0.4);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // dust: origin, velocity, life, sizes, kind (0 dust, 1 clod)
  function puff(x, y, z, t, vx, vy, vz, life, s0, s1, kind = 0) {
    const o = puffHead * 12;
    puffData.set([x, y, z, t, vx, vy, vz, life, s0, s1, Math.random(), kind], o);
    puffHead = (puffHead + 1) % PUFFS; puffDirty = true;
  }
  const api = { gl, canvas, render, project, view, genMs, dyn, puff, setPalette(greys, hues) { PAL = buildPalette(greys, hues); }, stats: { worldTris: world.verts / 3, terrTris: terr.idx.length / 3, giantTris: giantN / 3 } };
  return api;
}
