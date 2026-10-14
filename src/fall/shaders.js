// UNDERFOOT — shaders. The scene pass lights everything in colour at 386x218, tone-maps it and writes it
// out. The palette pass then snaps each pixel to a ramp: eight greys, or one of four dull hues (amber,
// moss, slate, rust) when the pixel is coloured enough, dithered with a 4x4 Bayer that stays flat inside a
// band and only breaks up near its edges. Post adds tilt-shift, fades, the UI, grain and vignette.

const MESH_ATTRS = `layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in float aMat; layout(location=3) in vec2 aUV; layout(location=4) in float aSeed;`;
const OUT = `out vec3 vP; out vec3 vN; flat out float vM; out vec2 vUV; flat out float vS; out vec3 vT; out vec3 vTN;`;

export const VS_MESH = `#version 300 es
${MESH_ATTRS}
uniform mat4 uVP;
${OUT}
void main(){
  vP = aPos; vN = aNor; vM = aMat; vUV = aUV; vS = aSeed; vT = aPos; vTN = aNor;
  gl_Position = uVP*vec4(aPos, 1.0);
}`;

// The giant: rigid parts and a skirt, skinned by up to two bones. aUV = (bone0, bone1), aSeed = weight of bone1.
// The skirt also swings a little behind the legs. vT keeps the rest position so the texture rides the body.
const SKIN = `
uniform mat4 uBones[16];
uniform vec3 uSway;
vec3 skinP(vec3 p, out vec3 n, vec3 n0){
  int b0 = int(aUV.x + 0.5), b1 = int(aUV.y + 0.5);
  float w = aSeed;
  mat4 A = uBones[b0], B = uBones[b1];
  vec3 pa = (A*vec4(p, 1.0)).xyz, pb = (B*vec4(p, 1.0)).xyz;
  n = normalize(mix(mat3(A)*n0, mat3(B)*n0, w));
  vec3 q = mix(pa, pb, w);
  float hem = clamp((1350.0 - p.y)/850.0, 0.0, 1.0);
  return q + uSway*hem*hem*(int(aMat + 0.5) == 30 ? 1.0 : 0.0);
}`;
export const VS_GIANT = `#version 300 es
${MESH_ATTRS}
uniform mat4 uVP;
${SKIN}
${OUT}
void main(){
  vec3 n; vec3 w = skinP(aPos, n, aNor);
  vP = w; vN = n; vM = aMat; vUV = vec2(0.0); vS = 0.0; vT = aPos; vTN = aNor;
  gl_Position = uVP*vec4(w, 1.0);
}`;
export const VS_GIANT_DEPTH = `#version 300 es
${MESH_ATTRS}
uniform mat4 uLVP;
${SKIN}
void main(){ vec3 n; vec3 w = skinP(aPos, n, aNor); gl_Position = uLVP*vec4(w, 1.0); }`;
export const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLVP;
void main(){ gl_Position = uLVP*vec4(aPos, 1.0); }`;
export const FS_DEPTH = `#version 300 es
precision mediump float;
void main(){}`;

// ------------------------------------------------------------------------------------------------ shared
const COMMON = `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uSun, uSunCol, uSkyCol, uGndCol, uFogCol, uFogSunCol;
uniform float uFogA, uFogB, uExposure;
uniform vec3 uFogCam;
float n1(vec2 p){ return texture(uNoise, p).r; }
float n2(vec2 p){ return texture(uNoise, p).g; }
float n3(vec2 p){ return texture(uNoise, p).b; }
float wn(vec2 p){ return texture(uNoise, p).a; }
// noise by cell size (metres): the channels have 32, 64 and 128 cells per tile
float N1(vec2 p, float c){ return texture(uNoise, p/(32.0*c)).r; }
float N2(vec2 p, float c){ return texture(uNoise, p/(64.0*c)).g; }
float N3(vec2 p, float c){ return texture(uNoise, p/(128.0*c)).b; }
float PXW = 1.0;   // metres per pixel here; set at the top of main()
float lodF(float cell){ return 1.0 - smoothstep(cell*0.6, cell*1.8, PXW); }
float N2L(vec2 p, float c){ return mix(0.5, N2(p, c), lodF(c)); }
float N3L(vec2 p, float c){ return mix(0.5, N3(p, c), lodF(c)); }
float hash(float n){ return fract(sin(n)*43758.5453); }
float hash2(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233)))*43758.5453); }
vec2 hash22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p)*43758.5453); }
float bayerF(vec2 c){ ivec2 p = ivec2(c); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[(p.y & 3)*4 + (p.x & 3)]) + 0.5)/16.0; }
// exponential height fog, integrated along the ray from the camera
vec3 fogged(vec3 col, vec3 P){
  vec3 d = P - uFogCam; float dist = max(0.0, dot(d, normalize(P - uCam))); vec3 rd = normalize(P - uCam);
  float k = rd.y*uFogB;
  float od = uFogA*exp(-uFogB*(P.y - rd.y*dist))*(abs(k) > 1e-5 ? (1.0 - exp(-k*dist))/k : dist);
  float f = 1.0 - exp(-od);
  float s = pow(max(dot(rd, uSun), 0.0), 5.0);
  return mix(col, mix(uFogCol, uFogSunCol, s), f);
}
vec4 toneOut(vec3 c){ c = 1.0 - exp(-max(c, 0.0)*uExposure); return vec4(sqrt(c), 1.0); }
`;

const CLOUDS = `
uniform vec2 uWind, uHoleC;
uniform float uCloudCov;
const float CY0 = 820.0, CY1 = 1900.0, CH = 950.0;
float cloudCov(vec2 xz){
  vec2 w = xz + uWind*uTime;
  float c = N1(w, 2600.0)*0.5 + N2(w, 760.0)*0.32 + N3(w, 230.0)*0.18;
  vec2 dh = xz - uHoleC;
  c -= 0.16*exp(-dot(dh, dh)/(1600.0*1600.0));
  return c + uCloudCov;
}
float cloudDen(vec3 p){
  float cov = smoothstep(0.55, 0.7, cloudCov(p.xz));
  if (cov <= 0.0) return 0.0;
  float h = (p.y - CY0)/(CH*(0.3 + 0.7*cov));
  if (h < 0.0 || h > 1.0) return 0.0;
  float d = cov*(1.0 - h*h)*smoothstep(0.0, 0.05, h);
  float e = N2(p.xz + vec2(p.y*0.7, -p.y*0.45), 170.0)*0.62 + N3(p.xz - vec2(p.y*0.6, p.y*0.4), 60.0)*0.38;
  d -= (e - 0.38)*0.75*(0.35 + h);
  return clamp(d*1.6, 0.0, 1.0);
}
`;
export const FS_MESH = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; flat in float vM; in vec2 vUV; flat in float vS; in vec3 vT; in vec3 vTN;
layout(location=0) out vec4 o;
${COMMON}
uniform sampler2D uNearMap, uFarMap;
uniform highp sampler2DShadow uShadow, uGShadow, uLtShadow;
uniform mat4 uLVP, uGVP, uLtVP;
uniform vec2 uShTexel, uGShTexel, uLtTexel;
uniform float uLocalOn;
uniform vec4 uLan; uniform vec4 uLanDir; uniform float uLanInner; uniform vec3 uLanCol;
uniform float uWin;            // how many windows are still lit, 0..1
uniform vec4 uPrints[6];       // giant footprints: x, z, yaw, side (+-1); w = 0 means none
uniform float uNear, uFar;
uniform float uCloudShadow;
uniform vec4 uCut;             // see-through near the player: screen xy, depth, radius in px
uniform float uIsGiant;
uniform float uEye;
uniform float uSnow;
uniform vec3 uPlayer[4];       // your coat, hood and scarf albedo, then (fill light, 0, 0), from the look
const float LAME[7] = float[7](0.0, 60.0, 110.0, 155.0, 200.0, 245.0, 290.0);   // where the foot's lames start
// the face mask's relief over its rounded base, in rest-pose metres (the same shape as maskZ in giant.js)
float g2(float a, float s){ return exp(-(a/s)*(a/s)); }
float maskRelief(vec2 p){
  float v = (p.y - 2545.0)/310.0, u = p.x/150.0, au = abs(u);
  float vb = 0.695 - 0.035*g2(u, 0.18);
  float z = 16.0*g2(v - vb, 0.042)*(1.0 - 0.3*u*u) - 4.0*g2(au - 0.05, 0.02)*g2(v - 0.68, 0.04);
  z -= 40.0*g2(au - 0.34, 0.16)*g2(v - 0.6 - 0.09*(au - 0.34), 0.058);
  float nose = smoothstep(0.36, 0.43, v)*(1.0 - smoothstep(0.6, 0.67, v));
  z += (28.0 + 14.0*(1.0 - smoothstep(0.38, 0.62, v)))*g2(u, 0.08 + 0.045*(1.0 - smoothstep(0.37, 0.5, v)))*nose;
  z -= 5.0*g2(au - 0.075, 0.03)*g2(v - 0.375, 0.022);
  z += 12.0*g2(au - 0.52, 0.16)*g2(v - 0.5, 0.07);
  z -= 9.0*g2(au - 0.43, 0.17)*g2(v - 0.32, 0.09);
  vec2 a = vec2(0.1, 0.4), d = vec2(0.17, -0.155);
  float t = clamp(dot(vec2(au, v) - a, d)/dot(d, d), 0.0, 1.0);
  z -= 4.5*g2(length(vec2(au, v) - (a + d*t)), 0.016);
  float vm = 0.232 - 0.03*(au/0.24)*(au/0.24), mw = 1.0 - smoothstep(0.2, 0.27, au);
  z += mw*(-7.0*g2(v - vm, 0.009) + 3.0*g2(v - vm - 0.022, 0.015) + 3.0*g2(v - vm + 0.024, 0.016));
  z += 9.0*g2(v - 0.09, 0.06)*g2(u, 0.33);
  return z;
}

float pcf4(highp sampler2DShadow S, vec3 l, vec2 tx, float bias){
  float s = texture(S, vec3(l.xy + vec2(-0.6, -0.6)*tx, l.z - bias));
  s += texture(S, vec3(l.xy + vec2(0.6, -0.6)*tx, l.z - bias));
  s += texture(S, vec3(l.xy + vec2(-0.6, 0.6)*tx, l.z - bias));
  s += texture(S, vec3(l.xy + vec2(0.6, 0.6)*tx, l.z - bias));
  return s*0.25;
}
const vec2 PD[8] = vec2[8](vec2(-0.613,0.617), vec2(0.17,-0.04), vec2(-0.299,-0.791), vec2(0.645,0.493), vec2(-0.651,-0.717), vec2(0.421,-0.027), vec2(-0.817,0.054), vec2(0.977,-0.108));
float sunShadow(vec3 P, vec3 n, float ndl){
  float s = 1.0;
  if (uLocalOn > 0.5){
    vec4 l = uLVP*vec4(P, 1.0); vec3 lc = l.xyz*0.5 + 0.5;
    if (lc.x > 0.002 && lc.y > 0.002 && lc.x < 0.998 && lc.y < 0.998 && lc.z < 1.0) s = pcf4(uShadow, lc, uShTexel, 0.0004 + 0.0014*(1.0 - clamp(ndl, 0.0, 1.0)));
  }
  vec4 g = uGVP*vec4(P + n*6.0, 1.0); vec3 gc = g.xyz*0.5 + 0.5;
  if (gc.x > 0.0 && gc.y > 0.0 && gc.x < 1.0 && gc.y < 1.0 && gc.z < 1.0){
    float r = 2.6, acc = 0.0, rot = hash2(floor(P.xz*0.25))*6.28;
    mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    for (int i = 0; i < 8; i++) acc += texture(uGShadow, vec3(gc.xy + R*PD[i]*uGShTexel*r, gc.z - 0.0006));
    s = min(s, acc/8.0);
  }
  return s;
}
${CLOUDS}
float cloudShadow(vec3 P){
  if (uCloudShadow <= 0.0) return 1.0;
  vec3 q = P + uSun*((1250.0 - P.y)/max(uSun.y, 0.05));
  float c = cloudCov(q.xz);
  return 1.0 - uCloudShadow*0.72*smoothstep(0.47, 0.58, c);
}
float lanternLight(vec3 P, vec3 n, out float sh){
  sh = 1.0;
  if (uLan.w <= 0.0) return 0.0;
  vec3 d = P - uLan.xyz; float dist = length(d); vec3 ld = d/dist;
  float cone = smoothstep(uLanDir.w, uLanInner, dot(ld, uLanDir.xyz));
  if (cone <= 0.0) return 0.0;
  float att = 1.0/(1.0 + (dist/260.0)*(dist/260.0));
  float ndl = max(dot(n, -ld), 0.0)*0.85 + 0.15;
  vec4 l = uLtVP*vec4(P - ld*0.6, 1.0); vec3 lc = l.xyz/l.w*0.5 + 0.5;
  if (lc.x > 0.0 && lc.y > 0.0 && lc.x < 1.0 && lc.y < 1.0 && lc.z < 1.0) sh = pcf4(uLtShadow, lc, uLtTexel, 0.00002);
  return uLan.w*cone*att*ndl*sh;
}

// half-timbering; seed packs wall length and eave height, its fraction is the house
float fachwerk(vec2 uv, float seed, bool front, out float win){
  float L = floor(seed/100.0)/10.0, H = mod(floor(seed), 100.0)/10.0, rnd = fract(seed);
  float u = uv.x, v = uv.y;
  float alb = 0.86 + (N2L(uv + rnd*40.0, 0.35) - 0.5)*0.12;
  alb -= smoothstep(0.62, 0.8, N1(uv + rnd*90.0, 1.4))*0.12;
  float bw = 0.13, nP = max(2.0, floor(L/1.5 + 0.5)), sp = L/nP, fu = mod(u, sp);
  float post = step(min(fu, sp - fu), bw);
  float rail = max(step(abs(v - 0.1), bw), max(step(abs(v - 2.5), bw*1.25), step(abs(v - (H - 0.1)), bw)));
  rail *= step(v, H + 0.01);
  float panel = floor(u/sp), pu = fu/sp, upper = step(2.5, v);
  float v0 = mix(0.1, 2.5, upper), v1 = mix(2.5, H - 0.1, upper), pv = clamp((v - v0)/(v1 - v0), 0.0, 1.0);
  float endP = (panel < 0.5 || panel > nP - 1.5) ? 1.0 : 0.0;
  float diag = panel < 0.5 ? abs(pu - pv) : abs(pu - (1.0 - pv));
  float brace = endP*step(diag*sp, bw*1.35)*step(v, H);
  float h1 = hash(panel*12.98 + rnd*78.2), xx = min(abs(pu - pv), abs(pu - (1.0 - pv)));
  float cross = (1.0 - endP)*step(0.62, h1)*upper*step(xx*sp, bw*1.25)*step(v, H);
  float gable = step(H, v), gpost = gable*step(abs(pu - 0.5)*sp, bw);
  float timber = max(max(post, rail), max(max(brace, cross), gpost));
  float h2 = hash(panel*7.13 + upper*3.7 + rnd*19.1);
  win = 0.0;
  if (gable < 0.5 && endP < 0.5 && h2 > 0.3 && cross < 0.5){ float wv0 = mix(0.9, 3.15, upper); win = step(abs(pu - 0.5)*sp, 0.38)*step(wv0, v)*step(v, wv0 + 1.0); }
  float door = 0.0;
  if (front && upper < 0.5){ float mid = floor(nP*0.5); if (abs(panel - mid) < 0.5 && v < 2.2) door = step(abs(pu - 0.5)*sp, 0.5); }
  if (timber > 0.5) alb = 0.17 + N3L(uv, 0.4)*0.06;
  if (win > 0.5) alb = 0.06;
  if (door > 0.5){ alb = 0.14 + 0.05*step(0.5, fract(u*4.0)); win = 0.0; }
  return alb;
}
float stoneHouse(vec2 uv, float seed, out float win){
  float L = floor(seed/100.0)/10.0, H = mod(floor(seed), 100.0)/10.0, rnd = fract(seed);
  float row = floor(uv.y/0.42), off = fract(row*0.5)*0.8;
  vec2 c = vec2(fract((uv.x + off)/0.8), fract(uv.y/0.42));
  float h = hash(row*3.1 + floor((uv.x + off)/0.8)*7.7 + rnd*13.0);
  float alb = (step(c.x, 0.07) + step(c.y, 0.1)) > 0.5 ? 0.42 : 0.6 + h*0.12;
  float nW = max(1.0, floor(L/2.6)), sp = L/nW, pu = fract(uv.x/sp), panel = floor(uv.x/sp);
  win = 0.0;
  float wv0 = uv.y < 2.6 ? 0.9 : 3.2;
  if (hash(panel*5.1 + rnd*9.0 + step(2.6, uv.y)) > 0.35 && uv.y < H - 0.3) win = step(abs(pu - 0.5)*sp, 0.42)*step(wv0, uv.y)*step(uv.y, wv0 + 1.05);
  if (win > 0.5) alb = 0.06;
  return alb;
}
float shingles(vec2 uv, float seed, float rowH, float colW){
  float row = floor(uv.y/rowH), off = fract(row*0.5)*colW, col = floor((uv.x + off)/colW);
  float h = hash(row*12.9 + col*78.2 + seed*3.1);
  return (0.9 + h*0.2) - step(fract(uv.y/rowH), 0.22)*0.25;
}
float stoneWall(vec2 uv, float seed){
  float row = floor(uv.y/0.5), off = fract(row*0.5)*0.95;
  vec2 c = vec2(fract((uv.x + off)/0.95), fract(uv.y/0.5));
  float h = hash(row*3.1 + floor((uv.x + off)/0.95)*7.7 + seed);
  return (step(c.x, 0.07) + step(c.y, 0.1)) > 0.5 ? 0.7 : 0.92 + h*0.18;
}
// a giant's footprint: foot-local coords (x across, z along, toes at +z). >0 inside.
float printMask(vec2 q){
  float body = 1.0 - length(vec2(q.x/80.0, (q.y - 40.0)/215.0));
  float toes = 0.0;
  for (int i = 0; i < 5; i++){ float fi = float(i); vec2 c = vec2((fi - 1.6)*30.0, 238.0 - abs(fi - 1.2)*16.0 - fi*4.0); toes = max(toes, 1.0 - length(q - c)/(i == 0 ? 30.0 : 22.0)); }
  return max(body, toes);
}

// fields: furlongs (big blocks with a hedge round them), each ploughed in long strips one way; a block
// keeps to one or two crops, so it reads as stripes, not as paving
vec3 cropCol(float h){
  if (h < 0.28) return vec3(0.5, 0.475, 0.41);     // stubble
  if (h < 0.5) return vec3(0.41, 0.42, 0.37);      // pasture
  if (h < 0.68) return vec3(0.27, 0.25, 0.225);    // ploughed
  if (h < 0.86) return vec3(0.47, 0.46, 0.43);     // fallow
  return vec3(0.36, 0.385, 0.31);                  // green
}
vec3 fieldAlb(vec2 p, out float hedge){
  vec2 g = p/320.0, gi = floor(g), gf = fract(g);
  float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 c = vec2(float(i), float(j)), o = hash22(gi + c)*0.75 + 0.125;
    float d = length(c + o - gf);
    if (d < d1){ d2 = d1; d1 = d; id = gi + c; } else if (d < d2) d2 = d;
  }
  hedge = 1.0 - smoothstep(0.004, 0.016, d2 - d1);
  float ang = hash2(id*1.3)*3.14159, w = 8.0 + 9.0*hash2(id*2.7);
  vec2 per = vec2(-sin(ang), cos(ang));
  float s = dot(p, per)/w, si = floor(s), sf = fract(s);
  float hb = hash2(id*3.1), hs = hash(si*7.31 + hb*91.0);
  vec3 c = cropCol(hs < 0.62 ? hb : fract(hb + 0.41));
  c *= 0.95 + 0.1*hash(si*3.7 + hb*13.0);
  float fur = mix(0.5, 0.5 + 0.5*sin(s*w*2.6), lodF(1.2));                // ridge and furrow, along the strip
  c *= 0.95 + 0.1*fur;
  float balk = (1.0 - smoothstep(0.0, 0.7/w, min(sf, 1.0 - sf)))*lodF(1.2);  // a grass line between strips
  c = mix(c, vec3(0.4, 0.41, 0.36), balk*0.6);
  return c*(0.94 + 0.12*N2L(p, 3.0));
}

void main(){
  PXW = max(length(dFdx(vP)), length(dFdy(vP)));
  int m = int(vM + 0.5);
  // see-through round the player when the town would hide them (never the player's own figure)
  if (uCut.w > 0.0 && m != 0 && uIsGiant < 0.5 && (m < 50 || m > 59)){
    // the lantern and its chain get a much wider hole: they must never hide you
    bool lan = m >= 37 && m <= 40;
    vec2 dd = (gl_FragCoord.xy - uCut.xy)/(vec2(1.0, 1.25)*uCut.w*(lan ? 7.0 : 1.0));
    float e = length(dd);
    if (e < 1.0 && gl_FragCoord.z < uCut.z - 0.00002 && bayerF(gl_FragCoord.xy) < (lan ? 1.2 - e*e*0.9 : 0.9 - e*e*0.6)) discard;
    // from above, the chain is a shadow hanging through the view: thin it out the higher it goes on screen
    if (m == 37 && bayerF(gl_FragCoord.xy + 1.0) < 0.35 + 0.4*smoothstep(0.0, 80.0, gl_FragCoord.y - uCut.y)) discard;
  }
  vec3 n = normalize(vN);
  bool inside = !gl_FrontFacing;
  if (inside) n = -n;
  vec3 alb = vec3(0.5), emit = vec3(0.0);
  float ao = 1.0, spec = 0.0;
  vec3 P = vP, T = vT;
  if (m == 0){
    // ---- terrain
    vec2 gN = (P.xz + 256.0)/512.0, gF = (P.xz + 9216.0)/18432.0;
    bool nearIn = gN.x > 0.0 && gN.y > 0.0 && gN.x < 1.0 && gN.y < 1.0;
    vec4 F = texture(uFarMap, gF);
    vec4 G = nearIn ? texture(uNearMap, gN) : vec4(0.0, 0.0, F.r, F.a);
    float street = G.r, road = max(G.b, F.r*(nearIn ? 0.0 : 1.0)), water = nearIn ? G.a : F.a;
    ao = 1.0 - G.g*0.55;
    // pale, dusty ground: dry grass gone grey; paler still near the town
    vec3 grass = mix(vec3(0.46, 0.46, 0.4), vec3(0.5, 0.49, 0.43), N2L(P.xz, 7.0));
    grass *= 0.95 + 0.1*N3L(P.xz, 1.5);
    grass *= 0.94 + 0.12*N1(P.xz, 90.0);
    float nearTown = 1.0 - smoothstep(90.0, 220.0, length(P.xz - vec2(-4.0, -6.0)));
    alb = mix(grass, vec3(0.62, 0.6, 0.56)*(0.96 + 0.08*N2L(P.xz, 3.0)), nearTown);
    float gh = hash2(floor(P.xz*vec2(3.0, 2.0)));
    alb *= 1.0 - step(0.95, gh)*0.18*lodF(0.5);
    float farm = F.b;
    if (farm > 0.01){ float hedge; vec3 fc = fieldAlb(P.xz, hedge); fc = mix(fc, vec3(0.15, 0.17, 0.13)*(0.8 + 0.4*N3L(P.xz, 2.0)), hedge*0.85); alb = mix(alb, fc, smoothstep(0.2, 0.6, farm)); }
    float forest = F.g;
    if (forest > 0.4){
      float can = N3L(P.xz, 7.0)*0.6 + N2L(P.xz, 30.0)*0.4;
      vec3 fc = mix(vec3(0.07, 0.09, 0.07), vec3(0.17, 0.21, 0.14), smoothstep(0.35, 0.75, can));
      fc = mix(fc, vec3(0.05, 0.06, 0.05), step(0.82, hash2(floor(P.xz*0.12)))*lodF(8.0));
      alb = mix(alb, fc, smoothstep(0.45, 0.65, forest));
    }
    if (road > 0.01){ vec3 rc = vec3(0.56, 0.52, 0.46)*(0.9 + 0.15*N2L(P.xz, 1.5)); alb = mix(alb, rc, road*0.9); }
    if (street > 0.01){
      vec2 c = fract(P.xz*vec2(2.2, 2.9)), ci = floor(P.xz*vec2(2.2, 2.9));
      float cob = (0.9 + 0.15*hash2(ci))*(1.0 - 0.3*step(0.86, max(c.x, c.y))*lodF(0.4));
      alb = mix(alb, vec3(0.55, 0.53, 0.5)*cob, street);
    }
    // rock on steep ground and on the mountains, snow on the peaks
    float steep = 1.0 - n.y;
    float rk = smoothstep(0.32, 0.5, steep + (N1(P.xz, 40.0) - 0.5)*0.2) + smoothstep(500.0, 1100.0, P.y)*smoothstep(0.08, 0.25, steep);
    vec3 strata = vec3(0.36, 0.35, 0.34)*(0.85 + 0.3*sin(P.y*0.02 + N2(P.xz, 120.0)*6.0)*0.5*lodF(25.0) + 0.3*N3L(P.xz, 18.0));
    alb = mix(alb, strata, clamp(rk, 0.0, 1.0));
    float snow = smoothstep(1150.0, 1400.0, P.y + (N1(P.xz, 200.0) - 0.5)*400.0)*smoothstep(0.55, 0.3, steep);
    alb = mix(alb, vec3(0.86, 0.87, 0.9), snow);
    if (uSnow > 0.0) alb = mix(alb, vec3(0.86, 0.875, 0.9)*(0.95 + 0.05*N2L(P.xz, 2.0)), uSnow*smoothstep(0.55, 0.85, n.y)*(1.0 - smoothstep(0.02, 0.4, water)));
    // the river
    if (water > 0.02){
      vec3 rd = normalize(P - uCam);
      float rip = N2L(P.xz*vec2(1.0, 2.5) + vec2(uTime*0.6, 0.0), 2.0);
      vec3 refl = mix(uSkyCol*1.4, uFogSunCol*1.6, pow(max(dot(reflect(rd, vec3(0.0, 1.0, 0.0)), uSun), 0.0), 8.0));
      vec3 wc = vec3(0.07, 0.09, 0.11);
      alb = mix(alb, wc, smoothstep(0.02, 0.5, water));
      emit += refl*(0.25 + 0.5*step(0.62, rip))*smoothstep(0.3, 0.7, water)*0.5;
    }
    // giant footprints: crushed ground with a raised, darker rim
    for (int i = 0; i < 6; i++){
      if (uPrints[i].w == 0.0) continue;
      vec2 q = P.xz - uPrints[i].xy; float c = cos(uPrints[i].z), s = sin(uPrints[i].z);
      vec2 l = vec2(q.x*c - q.y*s, q.x*s + q.y*c); l.x *= uPrints[i].w;
      float pm = printMask(l + (vec2(N2(P.xz, 22.0), N3(P.xz, 12.0)) - 0.5)*30.0);
      if (pm > -0.2){
        vec3 crushed = vec3(0.16, 0.14, 0.12)*(0.8 + 0.4*N3L(P.xz, 2.5));
        alb = mix(alb, crushed, smoothstep(-0.02, 0.06, pm));
        alb *= 1.0 - smoothstep(-0.2, 0.0, pm)*(1.0 - smoothstep(0.0, 0.08, pm))*0.45;
      }
    }
  } else if (m == 1 || m == 2){
    float win; float a = fachwerk(vUV, vS, m == 2, win);
    alb = a < 0.3 ? vec3(a*1.05, a*0.92, a*0.82) : vec3(a, a*0.97, a*0.9);
    if (win > 0.5 && hash(fract(vS)*91.7) < uWin) emit = vec3(1.0, 0.62, 0.3)*1.2*(0.8 + 0.2*sin(uTime*3.0 + vS));
  } else if (m == 10){
    float win; float a = stoneHouse(vUV, vS, win);
    alb = vec3(a, a*0.97, a*0.92)*0.85;
    if (win > 0.5 && hash(fract(vS)*91.7) < uWin) emit = vec3(1.0, 0.62, 0.3)*1.1;
  } else if (m == 3){
    alb = vec3(0.19, 0.16, 0.13)*(0.85 + 0.3*N3L(vUV + vS*30.0, 0.5));
  } else if (m == 4){
    alb = vec3(0.19, 0.185, 0.19)*mix(1.0, shingles(vUV, vS, 0.34, 0.5), lodF(0.3));
  } else if (m == 5){
    float sh = shingles(vUV, vS, 0.3, 0.38);
    vec3 tile = mix(vec3(0.3, 0.16, 0.12), vec3(0.35, 0.21, 0.16), hash(vS*7.0));
    alb = tile*mix(1.0, sh, lodF(0.3))*(0.9 + 0.15*N2L(vUV + vS*20.0, 0.7));
  } else if (m == 6){
    alb = vec3(0.16, 0.17, 0.2)*mix(1.0, shingles(vUV, vS, 0.26, 0.34), lodF(0.3));
  } else if (m == 7 || m == 8 || m == 20){
    float a = stoneWall(vUV, vS);
    alb = (m == 20 ? vec3(0.58, 0.55, 0.5) : vec3(0.5, 0.48, 0.45))*a;
    if (m == 8){ float u = abs(vUV.x - 3.4), v = vUV.y; if (u < 1.0 && (v < 2.6 || length(vec2(u, v - 2.6)) < 1.0) && v > -0.5) alb = vec3(0.05); if (u < 0.5 && abs(v - 27.0) < 2.0) alb = vec3(0.04); }
    if (m == 20){ if (abs(fract(vUV.x/5.2) - 0.5)*5.2 < 0.45 && vUV.y > 3.0 && vUV.y < 8.5) { alb = vec3(0.05); if (uWin > 0.05) emit = vec3(1.0, 0.65, 0.33)*0.55; } }
    alb *= 0.85 + 0.25*N1(vP.xz + vP.y*0.6, 0.9);
  } else if (m == 19){
    alb = vec3(0.44, 0.42, 0.39);
  } else if (m == 9){
    alb = vec3(0.03);
  } else if (m == 11){
    alb = vec3(0.11, 0.15, 0.11)*(0.75 + 0.5*N3L(vP.xz + vP.y*0.7, 0.9));
  } else if (m == 12){
    alb = vec3(0.19, 0.24, 0.13)*(0.7 + 0.6*N3L(vP.xz + vP.y*0.7, 0.8));
  } else if (m == 13){
    alb = vec3(0.18, 0.15, 0.12);
  } else if (m == 14){
    alb = vec3(0.6, 0.5, 0.3)*(0.85 + 0.3*N2L(vUV, 0.5));
  } else if (m == 15){
    alb = vec3(0.36, 0.3, 0.24)*(0.85 + 0.2*hash(floor(vUV.x*2.0) + vS*10.0));
  } else if (m == 16){
    alb = vec3(0.7, 0.66, 0.58);
  } else if (m == 17){
    alb = vec3(0.1);
  // ---------------------------------------------------------------- the giant
  } else if (m == 30 || m == 31 || m == 42){
    // the robe: heavy faded red-brown cloth; the mantle and hood darker and browner. Dust along the hem,
    // moss and snow where it faces up.
    float ang = atan(T.z, T.x);
    vec3 cl = m == 42 ? mix(vec3(0.12, 0.105, 0.095), vec3(0.15, 0.13, 0.115), N2(T.xz + T.y*0.7, 160.0))
                      : mix(vec3(0.15, 0.1, 0.085), vec3(0.17, 0.12, 0.1), N2(T.xz + T.y*0.7, 160.0));
    vec2 sp = vec2(ang*320.0, T.y);                                   // round the body, metres
    cl *= 0.8 + 0.4*mix(0.5, N3(sp*vec2(1.0, 0.18), 30.0), lodF(18.0));  // streaks running down the folds
    cl *= 1.0 - 0.25*smoothstep(0.55, 0.8, N1(sp*vec2(1.0, 0.3), 120.0));
    float up = smoothstep(0.3, 0.8, vTN.y);
    cl = mix(cl, vec3(0.22, 0.26, 0.17), up*smoothstep(0.42, 0.68, N1(T.xz + 70.0, 90.0))*0.9);
    cl = mix(cl, vec3(0.44, 0.41, 0.37), smoothstep(900.0, 560.0, T.y)*0.6*(0.6 + 0.4*N2(sp, 40.0)));
    cl = mix(cl, vec3(0.8, 0.81, 0.84), smoothstep(2750.0, 2950.0, T.y)*up*smoothstep(0.3, 0.55, N1(T.xz, 70.0)));
    alb = m == 31 ? vec3(0.06, 0.05, 0.045) : cl;
  } else if (m == 43 || m == 44){
    // old iron plate, near black: seams every ~100 m with a lip that catches the light, rust bleeding down
    // from them, moss where it faces up; the feet are lames with rivets, caked with dried mud
    float lw = lodF(4.0);
    vec3 base = vec3(0.1, 0.097, 0.093)*(0.85 + 0.3*N1(T.xz + T.y*0.5, 70.0));
    float ax = abs(T.x) - 180.0;
    bool foot = T.y < 140.0 && abs(ax) < 140.0 && T.z > -150.0;
    float seam = 0.0, lip = 0.0, riv = 0.0, below = 0.0;
    if (foot){
      float a = atan(max(T.y, 0.0), ax)/3.14159;
      float ra = (fract(a*11.0) - 0.5)*26.0;
      for (int i = 0; i < 7; i++){
        float d = T.z - LAME[i];
        seam = max(seam, step(-5.0, d)*step(d, 0.0));
        lip = max(lip, step(0.0, d)*step(d, 3.5));
        riv = max(riv, 1.0 - smoothstep(2.6, 3.8, length(vec2(ra, d - 10.0))));
      }
      below = 0.5;
    } else {
      float fy = mod(T.y - 40.0, 104.0);
      seam = step(fy, 3.5); lip = step(3.5, fy)*step(fy, 7.5);
      below = smoothstep(50.0, 103.0, fy);
    }
    float streak = N2(vec2(T.x*0.7 + T.z*0.7, T.y*0.07), 16.0);
    base = mix(base, vec3(0.23, 0.13, 0.085), smoothstep(0.52, 0.8, streak)*(0.3 + 0.7*below)*0.9);
    float up = smoothstep(0.45, 0.85, vTN.y);
    if (T.y > 300.0) base = mix(base, vec3(0.18, 0.21, 0.14), up*smoothstep(0.42, 0.66, N1(T.xz + 30.0, 45.0)));
    float mudH = 28.0 + 46.0*N1(T.xz*vec2(1.0, 0.6), 34.0) + 22.0*N2(T.xz + T.y, 9.0);
    float mud = 1.0 - smoothstep(mudH - 5.0, mudH + 5.0, T.y);
    mud = max(mud, step(0.78, N3(T.xz + T.y*0.8, 6.0))*(1.0 - smoothstep(60.0, 300.0, T.y))*0.9);
    base = mix(base, vec3(0.33, 0.3, 0.26)*(0.85 + 0.3*N2(T.xz + T.y, 11.0)), mud*0.92);
    base = mix(base, vec3(0.022), seam*lw*(1.0 - mud*0.6));
    base = mix(base, vec3(0.3, 0.285, 0.27), lip*lw*(1.0 - mud));
    base = mix(base, vec3(0.3, 0.28, 0.25), riv*lw*(1.0 - mud*0.5));
    alb = base;
    spec = 1.0 - mud*0.85;
  } else if (m == 45){
    // the face: a mask of paler iron than the helm. Its relief (the same function the mesh is built from)
    // shades it like cavities and ridges, so it reads as a face in any light: hollows dark, ridges worn
    // bright. An ember deep in each socket; rust runs down from the eyes like tears.
    float lw = lodF(3.0);
    float rel = maskRelief(T.xy);
    float cav = clamp(-rel/36.0, 0.0, 1.0), ridge = clamp(rel/24.0, 0.0, 1.0);
    vec3 base = vec3(0.2, 0.195, 0.19)*(0.9 + 0.2*N1(T.xy*vec2(1.0, 0.6), 60.0));
    base *= (1.0 - 0.55*cav)*(1.0 + 0.7*ridge);
    vec2 e = vec2(abs(T.x) - 51.0, T.y - 2731.0);
    float sock = exp(-(e.x*e.x)/(24.0*24.0) - (e.y*e.y)/(20.0*20.0));
    base *= 1.0 - 0.92*smoothstep(0.3, 0.8, sock);
    float pupil = 1.0 - smoothstep(0.4, 1.0, length(e/vec2(7.5, 5.5)));
    emit = vec3(1.0, 0.28, 0.06)*0.42*uEye*pupil;
    float side = T.x > 0.0 ? 37.0 : 0.0;
    float tears = smoothstep(0.54, 0.76, N2(vec2(e.x + side, T.y*0.04), 4.0))*step(e.y, -14.0)*exp((e.y + 14.0)/150.0)*(1.0 - smoothstep(14.0, 24.0, abs(e.x)));
    base = mix(base, vec3(0.2, 0.11, 0.07), tears*0.85*lw);
    float aux = abs(T.x)/150.0, lineY = 2545.0 + 310.0*(0.232 - 0.03*(aux/0.24)*(aux/0.24));
    float lipLine = (1.0 - smoothstep(1.2, 3.5, abs(T.y - lineY)))*(1.0 - smoothstep(30.0, 40.0, abs(T.x)));
    base *= 1.0 - 0.8*lipLine*lw;
    alb = base; spec = 1.3;
  } else if (m == 46){
    // mail: rows of small rings; dark, catching the light in points
    float lw = lodF(2.0);
    vec2 q = vec2(atan(T.z - 30.0, T.x)*180.0, T.y);
    vec2 c = fract(q/vec2(6.0, 4.0) + vec2(0.5*floor(q.y/4.0), 0.0)) - 0.5;
    float ring = smoothstep(0.26, 0.36, length(c))*(1.0 - smoothstep(0.42, 0.5, length(c)));
    alb = vec3(0.07, 0.068, 0.066)*(1.0 + 1.5*ring*lw)*(0.85 + 0.3*N2(q, 30.0));
    spec = 0.6;
  } else if (m == 32){
    // wrappings on the shins: bands of dirty linen
    float band = fract(T.y/46.0 + atan(T.z, T.x)*0.32);
    alb = mix(vec3(0.27, 0.25, 0.22), vec3(0.17, 0.155, 0.14), step(0.78, band))*(0.8 + 0.35*N2(vec2(atan(T.z, T.x)*90.0, T.y), 30.0));
  } else if (m == 33){
    // skin like weathered stone, cracked, lichen on top
    float cr = abs(N2(T.xz + T.y*0.8, 30.0) - 0.5);
    alb = vec3(0.33, 0.32, 0.3)*(0.78 + 0.4*N1(T.xz + T.y*0.8, 40.0));
    alb *= 0.85 + 0.15*smoothstep(0.0, 60.0, T.y);                              // dirt toward the ground
    alb *= 1.0 - (1.0 - smoothstep(0.0, 0.03, cr))*0.5*lodF(6.0);
    alb = mix(alb, vec3(0.32, 0.36, 0.24), smoothstep(0.5, 0.9, vTN.y)*smoothstep(0.5, 0.7, N1(T.xz, 30.0))*0.7);
  } else if (m == 34){
    alb = vec3(0.4, 0.38, 0.34)*(0.85 + 0.2*N2(T.xz, 4.0));
  } else if (m == 35){
    alb = vec3(0.012);
  } else if (m == 36){
    alb = vec3(0.0); emit = vec3(1.0, 0.58, 0.24)*2.4*uEye;
  } else if (m == 37 || m == 39){
    alb = vec3(0.09, 0.085, 0.08)*(0.8 + 0.4*N2L(T.xz + T.y*0.6, 3.0));
  } else if (m == 38){
    alb = vec3(0.0); emit = uLanCol*uLanCol*1.05*(0.95 + 0.1*sin(uTime*7.0) + 0.06*sin(uTime*13.0));
  } else if (m == 40){
    alb = vec3(0.0); emit = vec3(1.0, 0.8, 0.5)*5.0;
  } else if (m == 41){
    alb = vec3(0.1, 0.13, 0.1)*(0.8 + 0.4*N3L(T.xz + T.y, 6.0));
  // ---------------------------------------------------------------- people
  } else if (m == 50){ alb = uPlayer[0];
  } else if (m == 51){ alb = uPlayer[2];
  } else if (m == 52){ alb = vec3(0.62, 0.52, 0.44);
  } else if (m == 53){ alb = vec3(0.07);
  } else if (m == 54){ alb = vec3(0.6, 0.57, 0.52);
  } else if (m == 55){ alb = uPlayer[1];
  } else if (m == 56){
    // the outline hull round you: the darkest grey, unlit, unfogged
    o = vec4(0.0, 0.0, 0.0, 1.0); return;
  } else if (m == 57){
    // the ring on the ground under your feet: pale, soft-edged, dithered by its strength (the seed)
    float d = length(vUV);
    if ((1.0 - d*d)*vS < bayerF(gl_FragCoord.xy + vec2(1.0, 3.0))) discard;
    alb = vec3(0.62, 0.62, 0.64); emit = vec3(0.1, 0.1, 0.11);
  }
  if (uSnow > 0.0 && m != 0 && m != 36 && m != 38 && m != 40 && m < 50) alb = mix(alb, vec3(0.86, 0.875, 0.9), uSnow*smoothstep(0.5, 0.85, n.y)*0.95);
  if (inside){ alb *= 0.55; ao *= 0.6; }
  float ndl = dot(n, uSun);
  float sh = ndl > 0.0 ? sunShadow(P, n, ndl)*cloudShadow(P) : 0.0;
  // sky light: the dome, plus the brighter sky toward the low sun
  vec3 sunH = normalize(vec3(uSun.x, 0.0, uSun.z));
  vec3 amb = mix(uGndCol, uSkyCol, 0.5 + 0.5*n.y) + uSkyCol*0.4*max(dot(n, sunH), 0.0);
  vec3 col = alb*(uSunCol*max(ndl, 0.0)*sh + amb*ao);
  // you are never darker than the look's fill light, so the figure reads on a dark street
  if (m >= 50 && m <= 55) col = max(col, alb*uPlayer[3].x);
  float lsh; float L = lanternLight(P, n, lsh);
  col += alb*uLanCol*L;
  if (spec > 0.0){
    vec3 vd = normalize(P - uCam), hv = normalize(uSun - vd);
    col += uSunCol*pow(max(dot(n, hv), 0.0), 18.0)*0.35*sh*spec;
    vec3 lv = normalize(uLan.xyz - P); vec3 hl = normalize(lv - vd);
    col += uLanCol*L*pow(max(dot(n, hl), 0.0), 18.0)*0.6*spec;
    // iron mirrors a little of the sky: plates turned up catch it
    vec3 rr = reflect(vd, n);
    float fr = 0.06 + 0.94*pow(1.0 - max(dot(-vd, n), 0.0), 4.0);
    col += mix(uSkyCol, uFogSunCol, pow(max(dot(rr, uSun), 0.0), 3.0))*0.4*smoothstep(-0.1, 0.5, rr.y)*fr*spec;
  }
  if (uIsGiant > 0.5){
    col += alb*uLanCol*uLan.w*(m == 45 ? 0.05 : 0.06)*max(-n.y*0.8 + 0.2, 0.0)*smoothstep(1400.0, 2400.0, T.y);
    vec3 vd = normalize(P - uCam);
    float rim = pow(1.0 - abs(dot(n, vd)), 7.0)*smoothstep(0.2, 0.8, dot(vd, uSun));
    col += uSunCol*rim*0.7*cloudShadow(P);
  }
  col += emit;
  col = fogged(col, P);
  o = toneOut(col);
}`;

// ------------------------------------------------------------------------------------------------ sky
export const FS_SKY = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location=0) out vec4 o;
${COMMON}
uniform mat4 uInvVP;
uniform float uStars, uSunSize, uSunDisc;
void main(){
  vec4 a = uInvVP*vec4(vUv*2.0 - 1.0, -1.0, 1.0), b = uInvVP*vec4(vUv*2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize(b.xyz/b.w - a.xyz/a.w);
  float up = rd.y, s = max(dot(rd, uSun), 0.0);
  vec3 zen = uSkyCol*0.62, hor = mix(uFogCol, uFogSunCol, pow(s, 3.0));
  vec3 c = mix(hor, zen, smoothstep(-0.02, 0.45, up));
  c = mix(c, uFogSunCol*1.6, pow(s, 24.0)*0.8);
  float k2 = uSunSize*uSunSize;
  c += uSunCol*smoothstep(1.0 - 0.0007*k2, 1.0 - 0.0003*k2, s)*uSunDisc;
  if (uStars > 0.0 && up > 0.0){
    // a star is one pixel at the centre of a cell, whatever the field of view
    vec2 q = rd.xz/(up + 0.12)*120.0, cell = floor(q), f = abs(fract(q) - 0.5)/max(fwidth(q), vec2(1e-4));
    float h = hash2(cell), tw = 0.6 + 0.4*sin(uTime*2.0 + h*40.0);
    c += vec3(0.75, 0.8, 1.0)*step(0.993, h)*step(max(f.x, f.y), 0.5)*smoothstep(0.02, 0.25, up)*uStars*tw*(0.8 + 1.0*hash2(cell + 3.7));
  }
  // long bands of high cloud
  vec2 cp = rd.xz/max(up + 0.08, 0.05);
  float bands = n2(cp*vec2(0.035, 0.12) + vec2(uTime*0.002, 0.0))*0.7 + n3(cp*0.09)*0.3;
  c = mix(c, mix(uSkyCol*0.7, uFogSunCol*1.2, pow(s, 2.0)), smoothstep(0.55, 0.75, bands)*smoothstep(0.0, 0.25, up)*0.6);
  o = toneOut(c);
}`;

// ------------------------------------------------------------------------------------------------ clouds
// A slab of cumulus between 950 m and ~2 km, marched per pixel after the scene: coverage from three noise
// octaves drifting with the wind, a flat base and rounded tops, eroded edges, two taps toward the sun for
// self-shadow. The town sits under a gap. Composited over the scene up to its depth.
export const FS_CLOUDS = `#version 300 es
precision highp float;
uniform sampler2D uScene, uDepth;
uniform mat4 uInvVP;
uniform float uCloudK, uCloudNear;
layout(location=0) out vec4 o;
${COMMON}
${CLOUDS}
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 sc = texelFetch(uScene, ip, 0).rgb;
  float dz = texelFetch(uDepth, ip, 0).r;
  vec2 ndc = gl_FragCoord.xy/vec2(textureSize(uScene, 0))*2.0 - 1.0;
  vec4 a = uInvVP*vec4(ndc, -1.0, 1.0), b = uInvVP*vec4(ndc, min(dz, 0.99999)*2.0 - 1.0, 1.0);
  vec3 ro = a.xyz/a.w, pe = b.xyz/b.w, rd = normalize(pe - ro);
  float tEnd = dz >= 0.99999 ? 1e7 : length(pe - ro);
  float t0 = 0.0, t1 = 0.0;
  if (abs(rd.y) > 1e-4){ float ta = (CY0 - ro.y)/rd.y, tb = (CY1 - ro.y)/rd.y; t0 = max(0.0, min(ta, tb)); t1 = min(max(ta, tb), tEnd); }
  else if (ro.y > CY0 && ro.y < CY1){ t0 = 0.0; t1 = min(tEnd, 40000.0); }
  t0 = max(t0, uCloudNear);              // never a cloud in the camera's face
  t1 = min(t1, t0 + 26000.0);
  vec3 lin = -log(max(1.0 - sc*sc, 1e-4))/uExposure;   // undo the tone curve
  if (t1 <= t0 || uCloudK <= 0.0){ o = vec4(sc, 1.0); return; }
  // march to the first point past the cloud surface, refine it, then shade it as a solid
  const int N = 40;
  t1 = min(t1, t0 + 14000.0);
  float j = bayerF(gl_FragCoord.xy);
  float thr = 0.3 + (bayerF(gl_FragCoord.xy + vec2(1.0, 2.0)) - 0.5)*0.12;
  float span = t1 - t0, ta = t0;
  float tHit = -1.0;
  for (int i = 1; i <= N; i++){
    float u = (float(i) - 0.5 + j*0.5)/float(N);
    float t = t0 + span*u*u;
    if (cloudDen(ro + rd*t)*uCloudK > thr){
      float a = ta, b = t;
      for (int k = 0; k < 5; k++){ float m = (a + b)*0.5; if (cloudDen(ro + rd*m)*uCloudK > thr) b = m; else a = m; }
      tHit = b; break;
    }
    ta = t;
  }
  float T = 1.0; vec3 acc = vec3(0.0);
  if (tHit > 0.0){
    vec3 p = ro + rd*tHit;
    float e = 30.0;
    vec3 g = vec3(cloudDen(p + vec3(e, 0.0, 0.0)) - cloudDen(p - vec3(e, 0.0, 0.0)), cloudDen(p + vec3(0.0, e, 0.0)) - cloudDen(p - vec3(0.0, e, 0.0)), cloudDen(p + vec3(0.0, 0.0, e)) - cloudDen(p - vec3(0.0, 0.0, e)));
    vec3 n = -normalize(g + vec3(0.0, 1e-5, 0.0));
    float ndl = clamp(dot(n, uSun)*0.65 + 0.35, 0.0, 1.0);
    float occ = exp(-(cloudDen(p + uSun*140.0) + cloudDen(p + uSun*420.0))*1.6);
    float h = clamp((p.y - CY0)/600.0, 0.0, 1.0);
    vec3 alb = vec3(0.86, 0.86, 0.88);
    vec3 c = alb*(uSunCol*ndl*occ*0.62 + uSkyCol*(0.55 + 0.45*n.y)*(0.7 + 0.3*h) + uGndCol*0.35*max(-n.y, 0.0));
    c += uFogSunCol*pow(max(dot(rd, uSun), 0.0), 6.0)*0.25*(1.0 - occ*0.5);
    acc = fogged(c, p);
    T = 0.0;
  }
  vec3 outc = lin*T + acc;
  o = toneOut(outc);
}`;

// ------------------------------------------------------------------------------------------------ dust and debris
// Puffs: soft dithered billboards. iA = origin + birth, iB = velocity xyz + life, iC = size0, size1, seed, kind
export const VS_PUFF = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 iA;
layout(location=2) in vec4 iB;
layout(location=3) in vec4 iC;
uniform mat4 uVP; uniform vec3 uRight, uUp; uniform float uTime;
uniform float uHH;   // the camera's half-height in metres: a puff wider than the frame is dropped
out vec2 vC; out float vT; flat out vec4 vK; out vec3 vW;
void main(){
  float t = uTime - iA.w, u = t/iB.w;
  int k = int(iC.w + 0.5);
  vec3 p = iA.xyz + iB.xyz*(k == 1 ? t : (1.0 - exp(-t*0.9))/0.9);
  if (k == 1) p.y -= 4.9*t*t;           // falling clod
  float r = mix(iC.x, iC.y, k == 1 ? 0.0 : 1.0 - pow(1.0 - clamp(u, 0.0, 1.0), 2.5));
  bool gone = u < 0.0 || u > 1.0 || r > uHH*1.5;
  vec3 w = p + (uRight*aC.x + uUp*aC.y)*r;
  vC = aC; vT = u; vK = iC; vW = w;
  gl_Position = gone ? vec4(2.0, 2.0, 2.0, 1.0) : uVP*vec4(w, 1.0);
}`;
export const FS_PUFF = `#version 300 es
precision highp float;
in vec2 vC; in float vT; flat in vec4 vK; in vec3 vW;
layout(location=0) out vec4 o;
${COMMON}
uniform float uLanOn; uniform vec4 uLanPos; uniform vec4 uLanDir;
void main(){
  float d = length(vC);
  int k = int(vK.w + 0.5);
  if (k == 1){ if (d > 1.0) discard; o = toneOut(fogged(vec3(0.05, 0.045, 0.04), vW)); return; }
  float a = (1.0 - d*d)*(0.55 + 0.6*n2(vC*0.3 + vK.z*17.0 + vT*0.3));
  a *= smoothstep(0.0, 0.06, vT)*(1.0 - smoothstep(0.45, 1.0, vT));
  if (a < bayerF(gl_FragCoord.xy) || d > 1.0) discard;
  vec3 nrm = normalize(vec3(vC, 0.6));
  vec3 col = vec3(0.42, 0.39, 0.35)*(uSkyCol*0.9 + uSunCol*0.35*(0.5 + 0.5*vC.y));
  if (uLanOn > 0.0){ vec3 dv = vW - uLanPos.xyz; float dl = length(dv); col += vec3(0.42, 0.26, 0.12)*0.5*uLanPos.w*smoothstep(uLanDir.w - 0.03, uLanDir.w + 0.02, dot(dv/dl, uLanDir.xyz))/(1.0 + (dl/260.0)*(dl/260.0)); }
  o = toneOut(fogged(col, vW));
}`;

// ash and grit, single pixels drifting through a box round the camera target
export const VS_ASH = `#version 300 es
layout(location=0) in vec4 aP;
uniform mat4 uVP; uniform vec3 uCenter; uniform float uTime, uBox, uFall;
uniform vec4 uLan; uniform vec4 uLanDir;
flat out float vK; flat out float vL;
void main(){
  float sp = (0.5 + aP.z*0.8)*uFall;
  vec3 w = vec3(aP.x*uBox + uTime*(0.9 + aP.z) + sin(uTime*0.6 + aP.z*30.0)*1.2, aP.y*uBox*0.6 - uTime*sp, aP.w*uBox + uTime*0.3 + cos(uTime*0.5 + aP.x*20.0));
  vec3 base = uCenter - vec3(uBox*0.5, uBox*0.15, uBox*0.5);
  vec3 p = base + mod(w - base, vec3(uBox, uBox*0.6, uBox));
  vK = aP.z;
  vec3 d = p - uLan.xyz; float dist = length(d);
  vL = uLan.w > 0.0 ? smoothstep(uLanDir.w, uLanDir.w + 0.02, dot(d/dist, uLanDir.xyz))*uLan.w/(1.0 + (dist/260.0)*(dist/260.0)) : 0.0;
  gl_Position = uVP*vec4(p, 1.0);
  gl_PointSize = 1.0;
}`;
export const FS_ASH = `#version 300 es
precision mediump float;
flat in float vK; flat in float vL;
uniform float uAshLum;
layout(location=0) out vec4 o;
void main(){
  vec3 c = vec3(vK > 0.5 ? uAshLum : uAshLum*0.75);
  c = mix(c, vec3(1.0, 0.72, 0.4), clamp(vL*0.8, 0.0, 1.0));
  o = vec4(c, 1.0);
}`;

// birds: tiny dark billboards, flapping
export const VS_BIRD = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 iA;
uniform mat4 uVP; uniform vec3 uRight; uniform float uSize;
out vec2 vC; flat out float vPh;
void main(){ vec3 w = iA.xyz + uRight*aC.x*uSize + vec3(0.0, aC.y*uSize*0.6, 0.0); vC = aC; vPh = iA.w; gl_Position = uVP*vec4(w, 1.0); }`;
export const FS_BIRD = `#version 300 es
precision highp float;
in vec2 vC; flat in float vPh;
layout(location=0) out vec4 o;
void main(){
  float f = sin(vPh*6.2831);
  float wing = step(abs(vC.y - f*abs(vC.x)*0.9), 0.22)*step(abs(vC.x), 0.95);
  float body = step(length(vec2(vC.x*2.2, vC.y*1.6)), 0.4);
  if (wing + body < 0.5) discard;
  o = vec4(vec3(0.12), 1.0);
}`;

// ------------------------------------------------------------------------------------------------ palette
export const FS_QUANT = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec3 uRamp[28];      // 8 greys, then 4 hue ramps of 5
uniform float uRampL[28];    // their luma
uniform vec2 uHueDir[4];     // unit chroma direction of each hue ramp (in u, v)
uniform float uChromaLo, uChromaHi, uContrast, uLift, uGamma;
uniform sampler2D uDepth;
uniform vec4 uGlowA[4]; uniform vec4 uGlowB[4]; uniform int uNGlow;   // A: screen x, y (low-res, top-left origin), depth, radius; B: intensity, kind
uniform vec3 uSunScr;          // the sun in low-res pixels (bottom-left origin) and how strong its shafts are
uniform int uNGrey, uNHue;     // how many neutral steps (2..8) and hue ramps (0..4) the look uses
uniform int uDither;           // 0: flat inside a band, dithered at its edges; 1: ordered 8x8 dither all the way; 2: three flat levels
uniform float uBloom;
uniform vec3 uLanGlow;        // the lantern's halo, in the look's lantern colour
layout(location=0) out vec4 o;
float bayer4(ivec2 p){ int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[(p.y & 3)*4 + (p.x & 3)]) + 0.5)/16.0; }
float bayer8(ivec2 p){ return (bayer4(p) + bayer4(p >> 2)/16.0 - 0.5/16.0); }
// pick an entry of a ramp for a luma: flat inside a band, dithered only near the band edges
vec3 rampPick(int o0, int n, float L, float b){
  if (L <= uRampL[o0]) { float f = clamp(L/uRampL[o0], 0.0, 1.0); return f > b ? uRamp[o0] : uRamp[0]; }
  for (int i = 0; i < 7; i++){
    if (i >= n - 1) break;
    float a = uRampL[o0 + i], c = uRampL[o0 + i + 1];
    if (L <= c){
      float fr = (L - a)/(c - a);
      if (uDither == 0) fr = fr < 0.25 ? 0.0 : (fr > 0.75 ? 1.0 : (fr - 0.25)/0.5);
      else if (uDither == 2) fr = fr < 0.34 ? 0.0 : (fr > 0.66 ? 1.0 : 0.5);   // three flat levels: ink, a 50% screen, paper
      return fr > b ? uRamp[o0 + i + 1] : uRamp[o0 + i];
    }
  }
  float top = uRampL[o0 + n - 1];
  float f = clamp((L - top)/max(0.02, uRampL[7] - top), 0.0, 1.0);
  return f > b ? uRamp[7] : uRamp[o0 + n - 1];
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 s = texelFetch(uSrc, p, 0).rgb;
  vec2 sz = vec2(textureSize(uSrc, 0));
  for (int i = 0; i < 4; i++){
    if (i >= uNGlow) break;
    vec2 c = vec2(uGlowA[i].x + 1.0, sz.y - 1.0 - uGlowA[i].y);
    float d = length(gl_FragCoord.xy - c)/uGlowA[i].w;
    float occ = texelFetch(uDepth, ivec2(clamp(c, vec2(0.0), sz - 1.0)), 0).r < uGlowA[i].z - 0.0005 ? 0.25 : 1.0;
    vec3 gc = uGlowB[i].y > 1.5 ? vec3(1.0, 0.5, 0.2) : uLanGlow;
    s += gc*uGlowB[i].x*occ*exp(-d*d*2.2);
  }
  if (uSunScr.z > 0.0){
    // shafts: walk toward the sun, gather what is open, bright sky; anything solid in the way casts a shadow
    vec2 pp = gl_FragCoord.xy, d = (uSunScr.xy - pp)/28.0;
    float acc = 0.0, w = 1.0, j = bayer4(p);
    pp += d*j;
    for (int i = 0; i < 28; i++){
      pp += d;
      ivec2 q = ivec2(clamp(pp, vec2(0.0), sz - 1.0));
      float open = texelFetch(uDepth, q, 0).r >= 0.99999 ? 1.0 : 0.0;
      vec3 c = texelFetch(uSrc, q, 0).rgb;
      acc += open*max(dot(c, vec3(0.333)) - 0.6, 0.0)*w;
      w *= 0.955;
    }
    s += vec3(1.0, 0.95, 0.88)*acc*uSunScr.z*0.05;
  }
  if (uBloom > 0.0){
    // a soft glow round bright things: a spiral of taps over the scene, brightness above a knee
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 14; i++){
      float a = float(i)*2.39996 + 0.7, r = 1.5 + float(i)*0.85;
      vec3 c = texelFetch(uSrc, ivec2(clamp(gl_FragCoord.xy + vec2(cos(a), sin(a))*r, vec2(0.0), sz - 1.0)), 0).rgb;
      acc += max(c - 0.6, 0.0);
    }
    s += acc/14.0*uBloom;
  }
  s = min(s, vec3(1.0));
  float Y = dot(s, vec3(0.299, 0.587, 0.114));
  Y = clamp((pow(Y, uGamma) - 0.5)*uContrast + 0.5 + uLift, 0.0, 1.0);
  vec2 uv = vec2(s.b - dot(s, vec3(0.299, 0.587, 0.114)), s.r - dot(s, vec3(0.299, 0.587, 0.114)));
  float ch = length(uv);
  float b = uDither == 1 ? bayer8(p) : bayer4(p), b2 = bayer4(p + ivec2(2, 1));
  float cw = smoothstep(uChromaLo, uChromaHi, ch*(0.6 + 0.8*smoothstep(0.08, 0.35, Y)));
  vec3 col;
  if (cw > b2 && uNHue > 0){
    int best = 0; float bd = -2.0;
    for (int i = 0; i < 4; i++){ if (i >= uNHue) break; float d = dot(uv/max(ch, 1e-4), uHueDir[i]); if (d > bd){ bd = d; best = i; } }
    col = rampPick(8 + best*5, 5, Y, b);
  } else col = rampPick(0, uNGrey, Y, b);
  o = vec4(col, 1.0);
}`;

export const FS_POST = `#version 300 es
precision highp float;
uniform sampler2D uQ, uUI;
uniform vec2 uLow, uView, uOff, uCanvas;
uniform float uTime, uTilt, uFocus, uGrain, uUIon, uFade, uFlash, uVig;
layout(location=0) out vec4 o;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
const vec2 PD[12] = vec2[12](vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696,0.457), vec2(-0.203,0.621), vec2(0.962,-0.195), vec2(0.473,-0.480), vec2(0.519,0.767), vec2(0.185,-0.893), vec2(0.507,0.064), vec2(0.896,0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
void main(){
  vec2 uv = gl_FragCoord.xy/uCanvas;
  vec2 lp = uv*uView + vec2(1.0) + uOff;
  vec3 crisp = texelFetch(uQ, ivec2(floor(lp)), 0).rgb;
  float dy = abs(uv.y - uFocus);
  float r = uTilt*smoothstep(0.2, 0.55, dy)*1.7;
  vec3 col = crisp;
  if (r > 0.04){
    vec3 acc = vec3(0.0);
    float rot = hash(floor(gl_FragCoord.xy*0.5))*6.2831;
    mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    for (int i = 0; i < 12; i++) acc += texture(uQ, (lp + R*PD[i]*r)/uLow).rgb;
    col = mix(crisp, acc/12.0, smoothstep(0.0, 0.7, r));
  }
  vec2 q = uv - 0.5; q.x *= uCanvas.x/uCanvas.y*0.62;
  col = mix(col, vec3(0.92, 0.86, 0.74), uFlash);
  col = mix(col, vec3(0.043, 0.04, 0.047), uFade);
  if (uUIon > 0.5){ vec4 ui = texelFetch(uUI, ivec2(floor(uv.x*uView.x), floor((1.0 - uv.y)*uView.y)), 0); col = mix(col, ui.rgb, ui.a); }
  col += (hash(gl_FragCoord.xy*0.5 + fract(uTime*7.13)*317.0) - 0.5)*uGrain;
  col *= 1.0 - uVig*pow(clamp(length(q)*1.3, 0.0, 1.0), 2.3);
  o = vec4(col, 1.0);
}`;
