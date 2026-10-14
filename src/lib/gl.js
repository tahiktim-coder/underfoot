// Small WebGL2 helpers shared by the three pieces.

export function getGL(canvas, extra = {}) {
  return canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance', ...extra });
}

// Full-screen triangle; no buffers needed (gl_VertexID).
export const VS_TRI = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || '';
    const lines = src.split('\n');
    const m = /ERROR: \d+:(\d+)/.exec(log);
    const ctx = m ? lines.slice(Math.max(0, +m[1] - 3), +m[1] + 2).join('\n') : '';
    throw new Error(`${label} ${type === gl.VERTEX_SHADER ? 'VS' : 'FS'}: ${log}\n${ctx}`);
  }
  return s;
}

// Program with typed uniform setters: P.use(); P.set('uTime', t); P.set('uRes', w, h); P.tex('uMap', tex, unit)
export function program(gl, vs, fs, label = 'prog') {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, label));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, label));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(label + ' link: ' + gl.getProgramInfoLog(p));
  const U = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    U[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  const P = {
    prog: p, U,
    use() { gl.useProgram(p); return P; },
    set(name, a, b, c, d) {
      const u = U[name]; if (!u) return P;
      const L = u.loc;
      switch (u.type) {
        case gl.FLOAT: if (u.size > 1 || a.length) gl.uniform1fv(L, a); else gl.uniform1f(L, a); break;
        case gl.FLOAT_VEC2: if (a.length) gl.uniform2fv(L, a); else gl.uniform2f(L, a, b); break;
        case gl.FLOAT_VEC3: if (a.length) gl.uniform3fv(L, a); else gl.uniform3f(L, a, b, c); break;
        case gl.FLOAT_VEC4: if (a.length) gl.uniform4fv(L, a); else gl.uniform4f(L, a, b, c, d); break;
        case gl.INT: case gl.BOOL: case gl.SAMPLER_2D: case gl.SAMPLER_3D: case gl.SAMPLER_2D_SHADOW: case gl.UNSIGNED_INT_SAMPLER_2D: case gl.INT_SAMPLER_2D:
          if (a.length) gl.uniform1iv(L, a); else gl.uniform1i(L, a); break;
        case gl.INT_VEC2: gl.uniform2i(L, a, b); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(L, false, a); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(L, false, a); break;
        default: gl.uniform1f(L, a);
      }
      return P;
    },
    tex(name, t, unit, target = gl.TEXTURE_2D) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, t);
      const u = U[name]; if (u) gl.uniform1i(u.loc, unit);
      return P;
    },
  };
  return P;
}

// Texture helper. fmt: 'rgba8' | 'r8' | 'rgba16f' | 'r32f' | 'rg8' | 'depth'
export function texture(gl, w, h, { fmt = 'rgba8', filter = 'nearest', wrap = 'clamp', data = null, mips = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const F = {
    rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
    r8: [gl.R8, gl.RED, gl.UNSIGNED_BYTE],
    rg8: [gl.RG8, gl.RG, gl.UNSIGNED_BYTE],
    rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT],
    r32f: [gl.R32F, gl.RED, gl.FLOAT],
    rgba32f: [gl.RGBA32F, gl.RGBA, gl.FLOAT],
    depth: [gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT],
  }[fmt];
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], data);
  const fl = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, fl);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : fl);
  const wr = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  if (fmt === 'depth') {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  t.w = w; t.h = h; t.F = F;
  return t;
}

export function upload(gl, t, data, x = 0, y = 0, w = t.w, h = t.h) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, t.F[1], t.F[2], data);
}

export function framebuffer(gl, color, depth = null) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  const cs = Array.isArray(color) ? color : color ? [color] : [];
  cs.forEach((c, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, c, 0));
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  if (cs.length > 1) gl.drawBuffers(cs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  if (!cs.length) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete ' + st);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const ref = cs[0] || depth;
  f.w = ref.w; f.h = ref.h;
  return f;
}

export function bindTarget(gl, f, w, h) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.viewport(0, 0, f ? f.w : w, f ? f.h : h);
}

// Match the canvas backing store to its CSS size (capped DPR).
export function fitCanvas(canvas, maxDpr = 2) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
  return false;
}
