/* ============================================================================
   World: terrain, river, track meshes (rails, ties, ballast, turnouts)
   ========================================================================== */
const MAT = {};
const TEX = {};
const WORLD = { pieces: [], tiles: [], treeMeshes: [], switchVis: [], lattice: null, riverPts: [], lake: { X: -1010, N: 1180, r: 290 }, roadsX: [3300, 600, -1700], roadN: -62 };

function makeTextures() {
  TEX.ballast = canvasTex(256, 256, (g, w, h) => {
    const r = rng(7); g.fillStyle = '#8a8580'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, s = 1.5 + r() * 4.5, v = 70 + r() * 110 | 0;
      g.fillStyle = `rgb(${v},${v - 4 | 0},${v - 10 | 0})`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x - s * 0.25, y - s * 0.25, s * 0.45, s * 0.3, 0, 0, TAU); g.fill();
    }
  }, { repeat: true });
  TEX.ground = canvasTex(256, 256, (g, w, h) => {
    const r = rng(11); const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = Noise.fbm(x / 22, y / 22, 3) * 0.5 + Noise.n2(x / 4, y / 4) * 0.25 + (r() - 0.5) * 0.22;
      const v = clamp(200 + n * 120, 0, 255); const i = (y * w + x) * 4;
      id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v * 0.97; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }, { repeat: true });
  TEX.wood = canvasTex(128, 32, (g, w, h) => {
    const r = rng(3); g.fillStyle = '#a49a8c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,30,22,${0.1 + r() * 0.25})`; g.lineWidth = 0.5 + r(); g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + r() * 4 - 2, w * 0.7, y + r() * 4 - 2, w, y + r() * 3 - 1.5); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(30,22,16,0.35)'; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
  }, { repeat: true });
}

/* Distance bands (metres) for detail that has a near and a far version, or that stops being drawn:
   [fade in from, fully in, start fading out, gone]. Far ends that depend on the fog are set each frame. */
const LOD = {
  treeNear: { value: new THREE.Vector4(-2, -1, 560, 720) },
  treeFar: { value: new THREE.Vector4(560, 720, 4500, 7000) },
  bush: { value: new THREE.Vector4(-2, -1, 340, 420) },
  grass: { value: new THREE.Vector4(-2, -1, 185, 230) },
  flowers: { value: new THREE.Vector4(-2, -1, 245, 300) },
  tieNear: { value: new THREE.Vector4(-2, -1, 78, 100) },
  tieFar: { value: new THREE.Vector4(78, 100, 330, 450) },
};
/* Screen-door fade by distance from the camera. Each instance fades as a whole; the near version of a
   pair uses the mirrored dither pattern so near and far fill exactly the pixels the other leaves.
   Distance comes from the view-space position: three r128 only feeds cameraPosition to some materials. */
function fadeByDistance(mat, band, mirror = false) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uFade = band; sh.uniforms.uFadeMirror = { value: mirror ? 1 : 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFadeD;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vFadeD = length((modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);\n#else\n vFadeD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uFade; uniform float uFadeMirror; varying float vFadeD;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          float keep = smoothstep(uFade.x, uFade.y, vFadeD) * (1.0 - smoothstep(uFade.z, uFade.w, vFadeD));
          float dn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (uFadeMirror > 0.5) dn = 1.0 - dn;
          if (dn >= keep) discard;
        }`);
  };
  mat.customProgramCacheKey = () => key + '|fade';
  return mat;
}
/* fog-matched draw distance: where exponential-squared fog has all but swallowed the scene */
function fogFar(cap) { return Math.min(cap, 1.9 / Math.max(1e-6, scene.fog ? scene.fog.density : 0)); }

function makeMaterials() {
  makeTextures();
  MAT.ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.ground });
  MAT.ground.extensions = { derivatives: true };
  TEX.ground.repeat.set(1, 1);
  WORLD.snowU = { value: 0 };
  WORLD.fieldTex = makeFieldTexture();
  MAT.ground.onBeforeCompile = sh => {
    sh.uniforms.uSnow = WORLD.snowU;
    sh.uniforms.uField = { value: WORLD.fieldTex.tex };
    sh.uniforms.uFieldXf = { value: new THREE.Vector4(WORLD.fieldTex.i0, WORLD.fieldTex.j0, WORLD.fieldTex.w, WORLD.fieldTex.h) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUp; varying vec3 vWPos; attribute float aCrop; varying float vCropW;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = normal.y;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vCropW = aCrop;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vUp; varying vec3 vWPos; varying float vCropW; uniform sampler2D uField; uniform vec4 uFieldXf;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + CROP_GLSL + '\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86,0.89,0.93), uSnow * smoothstep(0.55,0.85,vUp) * (0.85 + 0.15*diffuseColor.g));');
  };
  MAT.ballast = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.ballast });
  MAT.ballast.onBeforeCompile = sh => {
    sh.uniforms.uSnow = WORLD.snowU;
    sh.uniforms.uTieFade = LOD.tieFar;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp; varying float vCamD;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = normal.y;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow; uniform vec4 uTieFade; varying float vUp; varying float vCamD;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' +
        // past the distance where the ties dissolve, the crown takes on their average colour so the track keeps its look
        ' diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085,0.062,0.045), 0.5 * (1.0 - smoothstep(1.15, 1.4, abs(vUv.x * 1.4))) * smoothstep(uTieFade.z, uTieFade.w, vCamD));\n' +
        ' diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86,0.89,0.93), uSnow * smoothstep(0.55,0.85,vUp) * (0.85 + 0.15*diffuseColor.g));');
  };
  MAT.rail = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.42 });
  MAT.tie = new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.wood });
  MAT.tie.onBeforeCompile = sh => {   // snow settles on the tie tops too
    sh.uniforms.uSnow = WORLD.snowU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n#ifdef USE_INSTANCING\nvUp = (modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).y;\n#else\nvUp = (modelMatrix * vec4(objectNormal, 0.0)).y;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vUp;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80,0.83,0.87), uSnow * 0.75 * smoothstep(0.6,0.9,vUp));');
  };
  MAT.plate = new THREE.MeshLambertMaterial({ color: 0x4a3d33 });
  MAT.steelDark = new THREE.MeshStandardMaterial({ color: 0x2b2c2e, metalness: 0.6, roughness: 0.6 });
  MAT.bridge = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.55, roughness: 0.62 });
  MAT.concrete = new THREE.MeshLambertMaterial({ color: 0xa8a293 });
  MAT.water = new THREE.MeshStandardMaterial({ color: 0x3a5457, metalness: 0.35, roughness: 0.1, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  MAT.road = new THREE.MeshLambertMaterial({ color: 0x5a5852, map: TEX.ground });
  MAT.gravelRoad = new THREE.MeshLambertMaterial({ color: 0x9b8f78, map: TEX.ballast });
  MAT.white = new THREE.MeshLambertMaterial({ color: 0xe8e6df });
  MAT.redPaint = new THREE.MeshLambertMaterial({ color: 0x9b2b22 });
  MAT.black = new THREE.MeshLambertMaterial({ color: 0x18191a });
  MAT.lampGreen = new THREE.MeshBasicMaterial({ color: 0x55ff99 });
  MAT.lampRed = new THREE.MeshBasicMaterial({ color: 0xff4433 });
  MAT.lampAmber = new THREE.MeshBasicMaterial({ color: 0xffb340 });
  MAT.lampOff = new THREE.MeshLambertMaterial({ color: 0x1d2222 });
  MAT.tree = new THREE.MeshLambertMaterial({ vertexColors: true });
  // level-of-detail pairs dissolve into each other instead of popping (see fadeByDistance)
  MAT.treeNear = fadeByDistance(MAT.tree.clone(), LOD.treeNear, true);
  MAT.treeFar = fadeByDistance(MAT.tree.clone(), LOD.treeFar);
  MAT.bush = fadeByDistance(MAT.tree.clone(), LOD.bush, true);
  MAT.tieNear = MAT.tie.clone(); MAT.tieNear.onBeforeCompile = MAT.tie.onBeforeCompile; fadeByDistance(MAT.tieNear, LOD.tieNear, true);
  MAT.tieFar = MAT.tie.clone(); MAT.tieFar.onBeforeCompile = MAT.tie.onBeforeCompile; fadeByDistance(MAT.tieFar, LOD.tieFar);
  MAT.hit = new THREE.MeshBasicMaterial({ visible: false });
  MAT.switchBody = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.switchLens = new THREE.MeshBasicMaterial({ vertexColors: true });
}

/* ---------------- terrain height model ---------------- */
const INNER = { x0: -6000, x1: 6000, n0: -2000, n1: 7000, step: 20 };
function riverX(N) { const A = n => 170 * Math.sin(n / 700) + 70 * Math.sin(n / 230 + 1); return -1203 + A(N) - A(2402); }
function naturalH(X, N) {
  if (WORLD.custom) return layoutH(X, N);
  if (WORLD.mtn) return mtNaturalH(X, N);
  let h = 6.5 * Noise.fbm(X / 1600 + 3.1, N / 1600 - 1.7, 4) + 2.2 * Noise.fbm(X / 320, N / 320, 3);
  // Kenton Hill (track crest at +13.5)
  h += 15.5 * Math.exp(-(((X - 1900) / 1150) ** 2 + ((N - 2400) / 820) ** 2));
  // rolling ridge north of the line, higher hills at the horizon
  h += 11 * smooth(3400, 6200, N) * (0.6 + 0.4 * Noise.fbm(X / 1800, N / 1800 + 4, 3));
  const er = Math.hypot(X / 9000, (N - 2200) / 7600);
  h += 70 * smooth(0.9, 1.6, er) * (0.55 + 0.45 * Noise.fbm(X / 2600 - 5, N / 2600, 3));
  return h;
}
function riverDist(X, N) {
  if (WORLD.custom) return 1e9;
  if (WORLD.mtn) return mtRiverDist(X, N);
  let d = 1e9;
  if (N > 2402 - 40) d = Math.abs(X - riverX(N));
  else if (N > WORLD.lake.N) { const t = (N - WORLD.lake.N) / (2402 - WORLD.lake.N); const x = lerp(WORLD.lake.X, riverX(2402), smooth(0, 1, t)); d = Math.abs(X - x); }
  const dl = Math.hypot(X - WORLD.lake.X, N - WORLD.lake.N) - WORLD.lake.r;
  return Math.min(d, Math.max(dl + 22, 0));
}
/* custom layouts sit in open, gently rolling farm country with hills only at the horizon */
function layoutH(X, N) {
  let h = 3.4 * Noise.fbm(X / 1700 + 3.1, N / 1700 - 1.7, 4) + 1.3 * Noise.fbm(X / 330, N / 330, 3);
  const er = Math.hypot(X / 8200, (N - 2500) / 6400);
  h += 70 * smooth(1.0, 1.6, er) * (0.55 + 0.45 * Noise.fbm(X / 2600 - 5, N / 2600, 3));
  return h;
}
function heightRaw(X, N) {
  let h = naturalH(X, N);
  if (WORLD.mtn) return h;   // the mountain streams cut their own beds
  const dr = riverDist(X, N);
  if (dr < 130) h = lerp(-5.6, h, smooth(15, 110, dr));
  return h;
}

/* Lattice of track proximity over the inner region (one cell per terrain vertex). */
function buildLattice() {
  const L = INNER, nx = Math.round((L.x1 - L.x0) / L.step) + 1, nn = Math.round((L.n1 - L.n0) / L.step) + 1;
  const d = new Float32Array(nx * nn).fill(1e9), y = new Float32Array(nx * nn);
  const R = 80, rc = Math.ceil(R / L.step);
  for (const e of NET.edges) {
    for (let s = 0; s <= e.len; s += 3) {
      if (e.isBridge(s) || e.isTunnel(s)) continue;
      const [X, N] = e.xz(s), ty = e.elev(s);
      const ci = Math.round((X - L.x0) / L.step), cj = Math.round((N - L.n0) / L.step);
      for (let j = cj - rc; j <= cj + rc; j++) {
        if (j < 0 || j >= nn) continue;
        for (let i = ci - rc; i <= ci + rc; i++) {
          if (i < 0 || i >= nx) continue;
          const vx = L.x0 + i * L.step, vn = L.n0 + j * L.step, dd = Math.hypot(vx - X, vn - N);
          const k = j * nx + i;
          if (dd < d[k]) { d[k] = dd; y[k] = ty; }
        }
      }
    }
  }
  WORLD.lattice = { nx, nn, d, y };
  WORLD.hgrid = { nx, nn, h: new Float32Array(nx * nn).fill(NaN), ready: false };
}
function latticeAt(X, N) {
  const L = INNER, W = WORLD.lattice;
  const i = Math.round((X - L.x0) / L.step), j = Math.round((N - L.n0) / L.step);
  if (i < 0 || j < 0 || i >= W.nx || j >= W.nn) return null;
  const k = j * W.nx + i; return { d: W.d[k], y: W.y[k] };
}
/* Final ground height at a lattice-aligned point (or anywhere, approximately). */
function groundH(X, N, lat) {
  let h = heightRaw(X, N);
  if (lat && lat.d < 80) {
    const w = 1 - smooth(14, 76, lat.d);
    h = lerp(h, lat.y - 0.95, w);
  }
  return h;
}
function groundAt(X, N) { // continuous sampler; exact terrain triangles once the grid is filled
  const L = INNER;
  if (X < L.x0 || X > L.x1 || N < L.n0 || N > L.n1) return heightRaw(X, N);
  const HG = WORLD.hgrid;
  if (HG && (HG.ready || WORLD.mtn)) {
    const fx = (X - L.x0) / L.step, fn = (N - L.n0) / L.step;
    let i = Math.floor(fx), j = Math.floor(fn); if (i >= HG.nx - 1) i = HG.nx - 2; if (j >= HG.nn - 1) j = HG.nn - 2;
    const tx = fx - i, tn = fn - j, k = j * HG.nx + i, H = HG.h;
    // the mountain's terrain is built as the camera nears it, so its grid heights are worked out when first asked for
    if (WORLD.mtn) for (const q of [k, k + 1, k + HG.nx, k + HG.nx + 1]) if (H[q] !== H[q]) { const vx = L.x0 + (q % HG.nx) * L.step, vn = L.n0 + Math.floor(q / HG.nx) * L.step; H[q] = groundH(vx, vn, latticeAt(vx, vn)); }
    const a = H[k], b = H[k + 1], d = H[k + HG.nx], e = H[k + HG.nx + 1];
    return tx + tn <= 1 ? a + (b - a) * tx + (d - a) * tn : e + (d - e) * (1 - tx) + (b - e) * (1 - tn);
  }
  const fx = (X - L.x0) / L.step, fn = (N - L.n0) / L.step, i = Math.floor(fx), j = Math.floor(fn), tx = fx - i, tn = fn - j;
  const g = (ii, jj) => { const vx = L.x0 + ii * L.step, vn = L.n0 + jj * L.step; return groundH(vx, vn, latticeAt(vx, vn)); };
  return lerp(lerp(g(i, j), g(i + 1, j), tx), lerp(g(i, j + 1), g(i + 1, j + 1), tx), tn);
}

/* ---------------- field patchwork colours ---------------- */
const FIELD = { w: 420, h: 260 };
const CROPS = [
  { c: [0.62, 0.55, 0.31], p: 0.21, n: 'corn' },      // standing corn, drying
  { c: [0.50, 0.35, 0.19], p: 0.16, n: 'soy' },       // soybeans turned
  { c: [0.74, 0.64, 0.40], p: 0.09, n: 'stubble' },   // wheat stubble
  { c: [0.35, 0.27, 0.19], p: 0.14, n: 'plowed' },    // fall plowing
  { c: [0.36, 0.53, 0.23], p: 0.16, n: 'pasture' },
  { c: [0.27, 0.50, 0.17], p: 0.16, n: 'wheat' },     // winter wheat coming up green
  { c: [0.34, 0.34, 0.20], p: 0.08, n: 'woods' },
];
function fieldAt(X, N) {
  const fx = (X + 40000) / FIELD.w, fn = (N + 40000) / FIELD.h, i = Math.floor(fx), j = Math.floor(fn);
  let r = Noise.hash(i, j), acc = 0, t = CROPS[0];
  for (const c of CROPS) { acc += c.p; if (r <= acc) { t = c; break; } }
  const ex = Math.min(fx - i, 1 - (fx - i)) * FIELD.w, en = Math.min(fn - j, 1 - (fn - j)) * FIELD.h;
  return { t, edge: Math.min(ex, en), i, j, u: fx - i, v: fn - j };
}
/* Vertex colour carries everything that is not crop (verges, ballast shoulders, banks, roads, hills).
   out[3] is the crop weight; the ground shader paints the crop pattern itself, per pixel. */
function groundColor(X, N, h, lat, out) {
  let r = 0.37, g = 0.49, b = 0.22, w = 1;
  if (lat && lat.d < 30) {
    const k = 1 - smooth(6, 30, lat.d); r = lerp(r, 0.34, k); g = lerp(g, 0.45, k); b = lerp(b, 0.21, k); w *= 1 - k;
    if (lat.d < 7) { const k2 = 1 - smooth(3, 7, lat.d); r = lerp(r, 0.34, k2); g = lerp(g, 0.33, k2); b = lerp(b, 0.30, k2); }
  }
  const dr = riverDist(X, N);
  if (dr < 60) { const k = 1 - smooth(18, 60, dr); r = lerp(r, 0.36, k); g = lerp(g, 0.35, k); b = lerp(b, 0.25, k); w *= 1 - k; }
  for (const rx of WORLD.roadsX) { const dd = Math.abs(X - rx); if (dd < 9) { const k = 1 - smooth(4, 9, dd); r = lerp(r, 0.5, k); g = lerp(g, 0.47, k); b = lerp(b, 0.40, k); w *= 1 - k; } }
  if (Math.abs(N - WORLD.roadN) < 10) { const k = 1 - smooth(5, 10, Math.abs(N - WORLD.roadN)); r = lerp(r, 0.5, k); g = lerp(g, 0.47, k); b = lerp(b, 0.40, k); w *= 1 - k; }
  if (h > 30) { const k = smooth(30, 70, h); r = lerp(r, 0.30, k); g = lerp(g, 0.36, k); b = lerp(b, 0.22, k); w *= 1 - k * 0.85; }
  if (WORLD.townMask && inTown(X, N)) { r = 0.36; g = 0.47; b = 0.22; w = 0; }
  const n = 0.84 + 0.3 * (Noise.n2(X / 37, N / 37) * 0.5 + 0.5);
  out[0] = r * n; out[1] = g * n; out[2] = b * n; out[3] = w;
}
const CROP_IDS = { corn: 0, soy: 1, stubble: 2, plowed: 3, pasture: 4, wheat: 5, woods: 6 };
function makeFieldTexture() {
  const i0 = 40, j0 = 80, w = 128, h = 256;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const fi = i0 + i, fj = j0 + j;
    let r = Noise.hash(fi, fj), acc = 0, t = CROPS[0];
    for (const c of CROPS) { acc += c.p; if (r <= acc) { t = c; break; } }
    const k = (j * w + i) * 4;
    data[k] = CROP_IDS[t.n] * 36; data[k + 1] = Noise.hash(fi * 3 + 7, fj * 5 + 2) < 0.5 ? 0 : 255; data[k + 2] = (Noise.hash(fi * 7 + 3, fj * 5 + 1) * 255) | 0; data[k + 3] = 0;   // alpha: woodlot planted
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const plant = (fi, fj) => { const i = fi - i0, j = fj - j0; if (i >= 0 && j >= 0 && i < w && j < h) { data[(j * w + i) * 4 + 3] = 255; tex.needsUpdate = true; } };
  return { tex, i0, j0, w, h, plant };
}
const CROP_GLSL = `
  {
    vec2 fxy = vec2((vWPos.x + 40000.0) / 420.0, (-vWPos.z + 40000.0) / 260.0);
    vec2 cell = floor(fxy);
    vec4 fd = texture2D(uField, (cell - uFieldXf.xy + 0.5) / uFieldXf.zw);
    float type = floor(fd.r * 255.0 / 36.0 + 0.5);
    vec2 fl = fxy - cell;
    float edgeM = min(min(fl.x, 1.0 - fl.x) * 420.0, min(fl.y, 1.0 - fl.y) * 260.0);
    vec3 crop = vec3(0.37, 0.49, 0.22); float rowSp = 0.0; float rowAmp = 0.0;
    if (type < 0.5)      { crop = vec3(0.60, 0.53, 0.31); rowSp = 0.76; rowAmp = 0.35; }
    else if (type < 1.5) { crop = vec3(0.50, 0.36, 0.20); rowSp = 0.38; rowAmp = 0.32; }
    else if (type < 2.5) { crop = vec3(0.74, 0.64, 0.40); rowSp = 0.19; rowAmp = 0.25; }
    else if (type < 3.5) { crop = vec3(0.35, 0.27, 0.19); rowSp = 0.36; rowAmp = 0.5; }
    else if (type < 4.5) { crop = vec3(0.36, 0.53, 0.23); }
    else if (type < 5.5) { crop = vec3(0.27, 0.50, 0.17); rowSp = 0.19; rowAmp = 0.5; }
    // woods: leaf litter only where a woodlot was actually planted (alpha set by buildTrees); otherwise rough meadow
    else if (fd.a > 0.5) { crop = (fl.x < 0.18 || fl.x > 0.82 || fl.y < 0.2 || fl.y > 0.78) ? vec3(0.40, 0.50, 0.24) : vec3(0.34, 0.34, 0.20); }
    else { crop = vec3(0.40, 0.50, 0.24); }
    crop *= 0.88 + 0.24 * fd.b;
    if (rowSp > 0.0) {
      float across = fd.g > 0.5 ? vWPos.x : vWPos.z;
      float ph = across / rowSp;
      float fw = fwidth(ph);
      float stripe = 0.5 + 0.5 * cos(ph * 6.2831853);
      float aa = 1.0 - smoothstep(0.25, 0.8, fw);
      if (type > 4.5 && type < 5.5) crop = mix(crop, vec3(0.33, 0.25, 0.17), (1.0 - stripe) * 0.6 * aa + 0.25 * (1.0 - aa));
      else crop *= mix(1.0, 1.0 - rowAmp + rowAmp * 1.5 * stripe, aa);
    }
    float hedge = 1.0 - smoothstep(1.0, 4.5, edgeM);
    crop = mix(crop, vec3(0.33, 0.42, 0.19), hedge * 0.85);
    float speck = texture2D(map, vWPos.xz * 0.27).r;
    float macro = texture2D(map, vWPos.xz * 0.0021 + 0.37).r;
    crop *= (0.8 + 0.3 * speck) * (0.85 + 0.3 * macro);
    vec4 mtx = mapTexelToLinear(texture2D(map, vUv));
    diffuseColor.rgb = mix(diffuseColor.rgb, pow(crop, vec3(2.2)) * mtx.rgb, vCropW);
  }`;

/* ---------------- terrain tiles ---------------- */
function buildTerrainTile(x0, n0, size, step, scene, lazy = false) {
  const ml = new THREE.Mesh(terrainGeo(x0, n0, size, 75), MAT.ground);
  ml.receiveShadow = false; ml.visible = lazy;
  scene.add(ml);
  const t = { hi: null, lo: ml, x0, n0, size, step, c: new THREE.Vector3(x0 + size / 2, 0, -(n0 + size / 2)), r: size * 0.72 };
  if (!lazy) tileHi(t, scene);
  WORLD.tiles.push(t);
}
/* the full-detail mesh of a tile; a huge world builds these only round the camera and lets far ones go */
function tileHi(t, scene) {
  const mh = new THREE.Mesh(terrainGeo(t.x0, t.n0, t.size, t.step), MAT.ground);
  mh.receiveShadow = true; scene.add(mh); t.hi = mh;
  if (WORLD.portalHoles) WORLD.portalHoles(t);
}
function tileDrop(t) { scene.remove(t.hi); t.hi.geometry.dispose(); t.hi = null; }
function terrainGeo(x0, n0, size, step) {
  const n = Math.round(size / step) + 1;
  const verts = n * n, skirt = 4 * (n - 1) * 2;
  const pos = new Float32Array((verts + skirt) * 3), col = new Float32Array((verts + skirt) * 3), uv = new Float32Array((verts + skirt) * 2), crop = new Float32Array(verts + skirt);
  const c = [0, 0, 0, 0];
  const HG = WORLD.hgrid, fill = HG && step === INNER.step;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const X = x0 + i * step, N = n0 + j * step;
    const lat = latticeAt(X, N);
    const h = groundH(X, N, lat);
    const k = j * n + i;
    pos[k * 3] = X; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -N;
    groundColor(X, N, h, lat, c);
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; crop[k] = c[3];
    uv[k * 2] = X / 14; uv[k * 2 + 1] = N / 14;
    if (fill) { const gi = Math.round((X - INNER.x0) / step), gj = Math.round((N - INNER.n0) / step); if (gi >= 0 && gj >= 0 && gi < HG.nx && gj < HG.nn) HG.h[gj * HG.nx + gi] = h; }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, d = a + n, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  // skirts
  let v = verts;
  const edgeLists = [[], [], [], []];
  for (let i = 0; i < n; i++) { edgeLists[0].push(i); edgeLists[1].push((n - 1) * n + i); edgeLists[2].push(i * n); edgeLists[3].push(i * n + n - 1); }
  for (const L of edgeLists) {
    for (let q = 0; q < L.length - 1; q++) {
      const a = L[q], b = L[q + 1];
      const sa = v++, sb = v++;
      for (const [src, dst] of [[a, sa], [b, sb]]) { pos[dst * 3] = pos[src * 3]; pos[dst * 3 + 1] = pos[src * 3 + 1] - 9; pos[dst * 3 + 2] = pos[src * 3 + 2]; col.copyWithin(dst * 3, src * 3, src * 3 + 3); crop[dst] = crop[src]; uv[dst * 2] = uv[src * 2]; uv[dst * 2 + 1] = uv[src * 2 + 1]; }
      idx.push(a, sa, b, b, sa, sb, a, b, sa, b, sb, sa);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aCrop', new THREE.BufferAttribute(crop, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
function buildFarTerrain(scene) {
  const st = 250, [x0, x1, n0, n1] = WORLD.mtn ? [INNER.x0 - 15000, INNER.x1 + 15000, INNER.n0 - 15000, INNER.n1 + 15000] : [-22000, 22000, -18000, 24000];
  const nx = Math.round((x1 - x0) / st) + 1, nn = Math.round((n1 - n0) / st) + 1;
  const pos = new Float32Array(nx * nn * 3), col = new Float32Array(nx * nn * 3), uv = new Float32Array(nx * nn * 2), crop = new Float32Array(nx * nn), c = [0, 0, 0, 0];
  for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * st, N = n0 + j * st, k = j * nx + i;
    const inside = X > INNER.x0 + 1 && X < INNER.x1 - 1 && N > INNER.n0 + 1 && N < INNER.n1 - 1;
    const h = inside ? -60 : heightRaw(X, N);
    pos[k * 3] = X; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -N;
    groundColor(X, N, h, null, c); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; crop[k] = c[3];
    uv[k * 2] = X / 14; uv[k * 2 + 1] = N / 14;
  }
  const idx = [];
  for (let j = 0; j < nn - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; idx.push(a, b, d, b, e, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aCrop', new THREE.BufferAttribute(crop, 1));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, MAT.ground); m.receiveShadow = false; scene.add(m);
}

/* ---------------- water ---------------- */
function buildWater(scene) {
  if (WORLD.mtn) { mtBuildWater(scene); return; }
  const pts = [];
  for (let N = 8600; N >= 2402; N -= 25) pts.push([riverX(N), N]);
  for (let t = 1; t >= 0; t -= 0.04) { const N = lerp(WORLD.lake.N, 2402, t); pts.push([lerp(WORLD.lake.X, riverX(2402), smooth(0, 1, t)), N]); }
  WORLD.riverPts = pts;
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dn = b[1] - a[1], L = Math.hypot(dx, dn) || 1, nx = -dn / L, nn = dx / L;
    const w = 42;
    pos.push(pts[i][0] + nx * w, -3.5, -(pts[i][1] + nn * w), pts[i][0] - nx * w, -3.5, -(pts[i][1] - nn * w));
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const river = new THREE.Mesh(g, MAT.water); river.renderOrder = 1; scene.add(river);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(WORLD.lake.r + 24, 48), MAT.water);
  lake.rotation.x = -Math.PI / 2; lake.position.set(WORLD.lake.X, -3.5, -WORLD.lake.N); scene.add(lake);
}

/* ---------------- track geometry ---------------- */
const RAIL_PROFILE = [[-0.036, 0], [0.036, 0], [0.036, -0.038], [0.010, -0.048], [0.010, -0.140], [0.074, -0.158], [0.074, -0.170], [-0.074, -0.170], [-0.074, -0.158], [-0.010, -0.140], [-0.010, -0.048], [-0.036, -0.038]];
const RAIL_FACES = (() => { const f = []; for (let i = 0; i < 12; i++) { if (i === 6) continue; f.push([i, (i + 1) % 12]); } return f; })();
const RAIL_COL = i => i === 0 ? [0.80, 0.79, 0.77] : (i === 1 || i === 11 ? [0.46, 0.40, 0.34] : [0.34, 0.23, 0.16]);
const FR = newFrame(), FR2 = newFrame();

function railSamples(e, s0, s1) {
  const out = [s0];
  let s = s0;
  while (s < s1 - 1e-4) {
    const k = Math.abs(e.curv(s));
    let st = k > 1e-6 ? Math.sqrt(0.02 / k) : 20;
    st = clamp(st, 1.2, 20);
    s = Math.min(s1, s + st); out.push(s);
  }
  return out;
}
/* Append an extruded rail. frameFn(s, out) returns frame; lat lateral offset; taper(s)->0..1 width scale */
function extrudeRail(acc, ss, frameFn, lat, taper, lift = 0) {
  const base = acc.pos.length / 3;
  const nr = ss.length;
  for (let fi = 0; fi < RAIL_FACES.length; fi++) {
    const [ia, ib] = RAIL_FACES[fi];
    const pa = RAIL_PROFILE[ia], pb = RAIL_PROFILE[ib];
    const col = RAIL_COL(fi === 0 ? 0 : (fi <= 1 || fi >= 10 ? 1 : 2));
    const vb = acc.pos.length / 3;
    for (let r = 0; r < nr; r++) {
      const F = frameFn(ss[r], FR);
      const w = taper ? taper(ss[r]) : 1;
      const ua = pa[0] * (pa[1] > -0.05 ? w : 1), ub = pb[0] * (pb[1] > -0.05 ? w : 1);
      let du = ub - ua, dv = pb[1] - pa[1]; const L = Math.hypot(du, dv) || 1; const nu = -dv / L, nv = du / L;
      for (const [u, v] of [[ua, pa[1]], [ub, pb[1]]]) {
        acc.pos.push(F.p.x + F.r.x * (lat + u) + F.u.x * (v + lift), F.p.y + F.r.y * (lat + u) + F.u.y * (v + lift), F.p.z + F.r.z * (lat + u) + F.u.z * (v + lift));
        acc.nor.push(F.r.x * nu + F.u.x * nv, F.r.y * nu + F.u.y * nv, F.r.z * nu + F.u.z * nv);
        acc.col.push(col[0], col[1], col[2]);
      }
      if (r > 0) { const k = vb + (r - 1) * 2; acc.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  return base;
}
function accGeo(acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
  if (acc.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3));
  if (acc.uv && acc.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setIndex(acc.idx); g.computeBoundingSphere(); return g;
}
const newAcc = () => ({ pos: [], nor: [], col: [], uv: [], idx: [] });
const _nm3 = new THREE.Matrix3();
function accAddGeo(acc, geo, m, col) {
  const base = acc.pos.length / 3, p = geo.attributes.position, n = geo.attributes.normal;
  _nm3.getNormalMatrix(m);
  for (let i = 0; i < p.count; i++) {
    _v1.fromBufferAttribute(p, i).applyMatrix4(m); acc.pos.push(_v1.x, _v1.y, _v1.z);
    _v2.fromBufferAttribute(n, i).applyMatrix3(_nm3).normalize(); acc.nor.push(_v2.x, _v2.y, _v2.z);
    acc.col.push(col[0], col[1], col[2]);
  }
  const ix = geo.index.array; for (let i = 0; i < ix.length; i++) acc.idx.push(base + ix[i]);
}

/* tie geometry: local x along track, z lateral */
function dropFaces(g, keep) { // keep: indices of BoxGeometry groups to keep (0:+x 1:-x 2:+y 3:-y 4:+z 5:-z)
  const ix = g.index.array, out = [];
  for (const k of keep) { const gr = g.groups[k]; for (let i = gr.start; i < gr.start + gr.count; i++) out.push(ix[i]); }
  g.setIndex(out); g.clearGroups(); return g;
}
function tieGeometry(len = 2.59, plates = true) {
  const parts = [];
  const t = dropFaces(new THREE.BoxGeometry(0.23, 0.178, len), plates ? [0, 1, 2, 4, 5] : [0, 1, 2]); t.translate(0, -0.186 - 0.089, 0);
  parts.push(t);
  if (plates) for (const z of [-RAIL_OFF, RAIL_OFF]) { const p = dropFaces(new THREE.BoxGeometry(0.2, 0.016, 0.36), [0, 1, 2]); p.translate(0, -0.178, z); const c = new Float32Array(p.attributes.position.count * 3).fill(0.32); p.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(p); }
  for (const p of parts) if (!p.attributes.color) { const c = new Float32Array(p.attributes.position.count * 3).fill(1); p.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  return mergeGeos(parts);
}
const _tm = new THREE.Matrix4(), _tc = new THREE.Color();
function frameMatrix(F, m) { m.makeBasis(F.f, F.u, F.r); m.setPosition(F.p); return m; }

/* Per-edge decorations computed from switches */
function prepareSwitchData() {
  for (const e of NET.edges) { e.trim = [[], []]; e.noTie = []; e.drop = []; }
  const P = 7.0;
  for (const sw of NET.switches) {
    const A = sw.legs[0], B = sw.legs[1];
    const away = (att, u, F) => { const s = att.end === 0 ? u : att.edge.len - u; att.edge.pose(s, F); if (att.end === 1) { F.f.negate(); F.r.negate(); } return F; };
    const d = u => { away(A, u, FR); away(B, u, FR2); return _v1.subVectors(FR2.p, FR.p).dot(FR.r); };
    const sgn = Math.sign(d(25)) || 1;
    let uEnd = 0; for (let u = 0; u < 80; u += 0.25) { if (Math.abs(d(u)) >= 2.75) { uEnd = u; break; } }
    let uF = 0; for (let u = 0; u < 60; u += 0.05) { if (Math.abs(d(u)) >= 2 * RAIL_OFF) { uF = u; break; } }
    const rng2 = (att, u0, u1) => att.end === 0 ? [u0, u1] : [att.edge.len - u1, att.edge.len - u0];
    const edgeSide = (att, side) => att.end === 0 ? side : -side;
    // trims for point rails
    const sideA = sgn, sideB = -sgn;
    A.edge.trim[edgeSide(A, sideA) > 0 ? 1 : 0].push(rng2(A, 0, P));
    B.edge.trim[edgeSide(B, sideB) > 0 ? 1 : 0].push(rng2(B, 0, P));
    A.edge.noTie.push(rng2(A, 0, uEnd)); B.edge.noTie.push(rng2(B, 0, uEnd));
    B.edge.drop.push(rng2(B, 0, 90));
    sw.geo = { P, sgn, uEnd, uF, away, d, sideA, sideB };
  }
}
const inRanges = (s, R) => { for (const r of R) if (s >= r[0] && s <= r[1]) return true; return false; };

function buildTrack(scene) {
  prepareSwitchData();
  const tieGeoBase = tieGeometry(), tieGeoLo = tieGeometry(2.59, false);
  const jointGeo = dropFaces(new THREE.BoxGeometry(0.62, 0.11, 0.025), [2, 4]);
  for (const e of NET.edges) {
    const nP = Math.max(1, Math.ceil(e.len / 400));
    for (let pi = 0; pi < nP; pi++) {
      const s0 = e.len * pi / nP, s1 = e.len * (pi + 1) / nP;
      const grp = new THREE.Group();
      // ---- rails
      const acc = newAcc();
      for (const side of [-1, 1]) {
        const trims = e.trim[side > 0 ? 1 : 0];
        // split [s0,s1] around trims
        let segs = [[s0, s1]];
        for (const t of trims) { const nx = []; for (const sg of segs) { if (t[1] <= sg[0] || t[0] >= sg[1]) nx.push(sg); else { if (t[0] > sg[0]) nx.push([sg[0], t[0]]); if (t[1] < sg[1]) nx.push([t[1], sg[1]]); } } segs = nx; }
        for (const sg of segs) if (sg[1] - sg[0] > 0.05) extrudeRail(acc, railSamples(e, sg[0], sg[1]), (s, F) => e.pose(s, F), side * RAIL_OFF, null);
      }
      // joint bars every 39 ft, merged into the rail mesh
      for (let s = Math.ceil(s0 / 11.89) * 11.89; s < s1; s += 11.89) {
        if (inRanges(s, e.noTie)) continue;
        e.pose(s, FR);
        for (const side of [-1, 1]) { const m = frameMatrix(FR, _tm.clone()).multiply(_m4.makeTranslation(0, -0.085, side * (RAIL_OFF + 0.024))); if (side < 0) m.multiply(_m4.makeRotationY(Math.PI)); accAddGeo(acc, jointGeo, m, [0.24, 0.21, 0.19]); }
      }
      const rails = new THREE.Mesh(accGeo(acc), MAT.rail); rails.castShadow = false; rails.receiveShadow = true; grp.add(rails);
      // ---- ballast
      const bal = newAcc();
      const PU = [-7.6, -3.15, -1.9, -1.25, 1.25, 1.9, 3.15, 7.6], PV = [-3.4, -0.95, -0.205, -0.2, -0.2, -0.205, -0.95, -3.4];
      const PC = [[0.32, 0.34, 0.21], [0.42, 0.40, 0.36], [0.55, 0.53, 0.5], [0.5, 0.48, 0.45], [0.5, 0.48, 0.45], [0.55, 0.53, 0.5], [0.42, 0.40, 0.36], [0.32, 0.34, 0.21]];
      let rings = 0; let lastB = false;
      const bs = railSamples(e, s0, s1);
      // ring exactly at each bridge limit, so the shoulders run right up to the abutment fill
      for (const b of e.bridges) for (const sb of [b[0] - 0.001, b[1] + 0.001]) if (sb > s0 && sb < s1) bs.push(sb);
      bs.sort((a, b) => a - b);
      for (const s of bs) {
        const br = e.isBridge(s);
        if (br) { lastB = true; continue; }
        if (lastB && rings > 0) { rings = 0; } // restart strip after bridge
        lastB = false;
        e.pose(s, FR);
        const drop = inRanges(s, e.drop) ? -0.025 : 0;
        const vb = bal.pos.length / 3;
        for (let q = 0; q < 8; q++) {
          const u = PU[q], v = PV[q] + drop, cant = (q === 0 || q === 7);
          bal.pos.push(FR.p.x + FR.r.x * u + (cant ? 0 : FR.u.x * v), FR.p.y + (cant ? v : FR.r.y * u + FR.u.y * v), FR.p.z + FR.r.z * u + (cant ? 0 : FR.u.z * v));
          bal.nor.push(0, 1, 0); bal.col.push(...PC[q]); bal.uv.push(u / 1.4, s / 1.4);
        }
        if (rings > 0) { const k = vb - 8; for (let q = 0; q < 7; q++) bal.idx.push(k + q, k + q + 1, k + q + 8, k + q + 1, k + q + 9, k + q + 8); }   // wound to face up
        rings++;
      }
      if (bal.idx.length) {
        const bg = accGeo(bal); bg.computeVertexNormals();
        // loose stone scatters light: lean the shoulder normals toward the sky so the shaded side isn't a black band
        { const n = bg.attributes.normal; for (let i = 0; i < n.count; i++) { _v1.set(n.getX(i), n.getY(i) + 0.8, n.getZ(i)).normalize(); n.setXYZ(i, _v1.x, _v1.y, _v1.z); } }
        const bm = new THREE.Mesh(bg, MAT.ballast); bm.receiveShadow = true; grp.add(bm);
      }
      // ---- ties, instanced in ~130 m chunks with a near (plated) and far (plain) version
      const tieChunks = [];
      const nC = Math.max(1, Math.round((s1 - s0) / 130));
      for (let ci = 0; ci < nC; ci++) {
        const c0 = s0 + (s1 - s0) * ci / nC, c1 = s0 + (s1 - s0) * (ci + 1) / nC;
        const ties = [];
        for (let s = Math.ceil(c0 / 0.495) * 0.495 + 0.2; s < c1; s += 0.495) { if (e.isBridge(s) || inRanges(s, e.noTie)) continue; ties.push(s); }
        if (!ties.length) continue;
        const hi = new THREE.InstancedMesh(tieGeoBase.clone(), MAT.tieNear, ties.length);
        const r = rng(e.id * 977 + pi * 31 + ci);
        const pts = [];
        ties.forEach((s, i) => {
          e.pose(s, FR);
          FR.p.addScaledVector(FR.f, (r() - 0.5) * 0.04);
          frameMatrix(FR, _tm); _tm.multiply(_m4.makeRotationY((r() - 0.5) * 0.035));
          hi.setMatrixAt(i, _tm); pts.push(FR.p.clone());
          const v = 0.62 + r() * 0.5; _tc.setRGB(0.42 * v, 0.36 * v, 0.29 * v); if (r() < 0.06) _tc.setRGB(0.36, 0.25, 0.17);
          hi.setColorAt(i, _tc);
        });
        const lo = new THREE.InstancedMesh(tieGeoLo.clone(), MAT.tieFar, ties.length);
        lo.instanceMatrix.copy(hi.instanceMatrix); lo.instanceColor = hi.instanceColor;
        const sp = new THREE.Sphere().setFromPoints(pts); sp.radius += 3;
        hi.geometry.boundingSphere = sp; lo.geometry.boundingSphere = sp.clone();
        hi.receiveShadow = lo.receiveShadow = true; hi.visible = lo.visible = false;
        grp.add(hi); grp.add(lo);
        tieChunks.push({ hi, lo, sp });
      }
      const jm = null;
      // bounding sphere for the piece
      const sph = rails.geometry.boundingSphere.clone(); sph.radius += 8;
      grp.userData = { sphere: sph, ties: tieChunks, edge: e, s0, s1 };
      scene.add(grp);
      WORLD.pieces.push(grp);
    }
  }
  buildSwitches(scene);
  buildBumpers(scene);
}

function buildSwitches(scene) {
  const tau = 0.12;
  for (const sw of NET.switches) {
    const G = sw.geo, A = sw.legs[0], B = sw.legs[1];
    const gb = new GeoBin();
    // switch ties along leg A
    const r = rng(sw.id * 31);
    const standSide = -G.sgn;
    for (let u = -0.6; u <= G.uEnd + 0.3; u += 0.495) {
      const dd = u <= 0 ? 0 : G.d(u);
      G.away(A, Math.max(u, 0), FR);
      if (u < 0) FR.p.addScaledVector(FR.f, u);
      let len = 2.59 + Math.abs(dd) + (u > G.uF - 2 ? 0.2 : 0), mid = dd / 2;
      if (Math.abs(u - 0.6) < 0.3) {   // long head-block ties carry the switch stand
        let z0 = mid - len / 2, z1 = mid + len / 2;
        if (standSide > 0) z1 = Math.max(z1, 3.05); else z0 = Math.min(z0, -3.05);
        len = z1 - z0; mid = (z0 + z1) / 2;
      }
      const geo = new THREE.BoxGeometry(0.23, 0.178, len);
      geo.translate(0, -0.275, mid);
      const v = 0.6 + r() * 0.4; const c = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = 0.42 * v; c[i + 1] = 0.36 * v; c[i + 2] = 0.29 * v; }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      gb.add('tie', geo, frameMatrix(FR, new THREE.Matrix4()));
    }
    // guard rails & frog
    const acc = newAcc();
    const gr = (att, side, u0, u1) => extrudeRail(acc, (() => { const a = []; for (let u = u0; u <= u1 + 1e-6; u += 0.5) a.push(u); return a; })(), (u, F) => G.away(att, u, F), side * (RAIL_OFF - 0.065), null);
    if (G.uF > 3) {
      gr(A, -G.sgn, G.uF - 2.8, G.uF + 2.8);
      gr(B, G.sgn, G.uF - 2.8, G.uF + 2.8);
      G.away(A, G.uF, FR); FR.p.addScaledVector(FR.r, G.sgn * RAIL_OFF);
      gb.add('steel', new THREE.BoxGeometry(2.2, 0.18, 0.32).translate(0.6, -0.1, 0), frameMatrix(FR, new THREE.Matrix4()));
    }
    // switch stand on the side away from the diverging route
    G.away(A, 0.6, FR);
    // ballast widened under the head-block ties so the stand isn't perched on the shoulder slope
    {
      const pad = new THREE.BoxGeometry(1, 1, 1), pp = pad.attributes.position;
      const c = new Float32Array(pp.count * 3);
      for (let i = 0; i < pp.count; i++) {
        const top = pp.getY(i) > 0, out = pp.getZ(i) * standSide > 0;
        const lat = standSide * (out ? (top ? 3.4 : 4.5) : 1.9);
        pp.setXYZ(i, pp.getX(i) * (top ? 2.4 : 4.4), top ? -0.205 : -1.1, lat);
        const k = top ? [0.55, 0.53, 0.5] : [0.42, 0.4, 0.36]; c.set(k, i * 3);
      }
      const uv = pad.attributes.uv; for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / 1.4 + pp.getY(i) / 1.4, pp.getZ(i) / 1.4);
      pad.setAttribute('color', new THREE.BufferAttribute(c, 3)); pad.computeVertexNormals();
      { const n = pad.attributes.normal; for (let i = 0; i < n.count; i++) { _v1.set(n.getX(i), n.getY(i) + 0.8, n.getZ(i)).normalize(); n.setXYZ(i, _v1.x, _v1.y, _v1.z); } }   // lit like the shoulders it joins
      gb.add('ballast', pad, frameMatrix(FR, new THREE.Matrix4()));
    }
    const sp = FR.p.clone().addScaledVector(FR.r, standSide * 2.55);
    const yaw = Math.atan2(-FR.f.z, FR.f.x);
    const sm = new THREE.Matrix4().makeRotationY(yaw).setPosition(sp);
    gb.add('steel', new THREE.BoxGeometry(0.9, 0.12, 0.5).translate(0, -0.15, 0), sm);
    gb.add('steel', new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8).translate(0, 0.6, 0), sm);
    gb.add('steel', new THREE.BoxGeometry(0.06, 0.06, 3.3).translate(0, -0.2, -standSide * 1.675), sm);
    gb.add('steel', new THREE.BoxGeometry(0.5, 0.05, 0.06).translate(0.25, 0.25, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.5)), sm);
    const vis = gb.build({ tie: MAT.tie, steel: MAT.steelDark, rail: MAT.rail, ballast: MAT.ballast });
    if (acc.idx.length) { const m = new THREE.Mesh(accGeo(acc), MAT.rail); m.receiveShadow = true; vis.add(m); }
    scene.add(vis);
    // rotating target with lamp
    const tgt = new THREE.Group(); tgt.position.copy(sp).add(new THREE.Vector3(0, 1.32, 0)); tgt.rotation.y = yaw; tgt.userData.yaw0 = yaw;
    const vc = (g, c) => { const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const body = mergeGeos([
      vc(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20).applyMatrix4(M(0, 0, 0, Math.PI / 2, Math.PI / 2, 0)), [0.12, 0.54, 0.26]),
      vc(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20).applyMatrix4(M(0, 0, 0, Math.PI / 2, 0, 0)), [0.7, 0.15, 0.11]),
      vc(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(0, 0.48, 0), [0.09, 0.09, 0.1])]);
    const lenses = mergeGeos([0, 1, 2, 3].map(q => { const a = q * Math.PI / 2; return vc(new THREE.CircleGeometry(0.065, 12).applyMatrix4(M(Math.sin(a) * 0.112, 0.48, Math.cos(a) * 0.112, 0, a, 0)), q % 2 ? [0.3, 1, 0.55] : [1, 0.66, 0.22]); }));
    tgt.add(new THREE.Mesh(body, MAT.switchBody), new THREE.Mesh(lenses, MAT.switchLens));
    scene.add(tgt);
    // tap target
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4), MAT.hit); hit.position.copy(sp).add(new THREE.Vector3(0, 0.8, 0)); hit.userData.sw = sw; scene.add(hit);
    // point rails (pivot at heel)
    const pts = [];
    for (const [att, side, sgnOpen] of [[A, G.sideA, 0], [B, G.sideB, 1]]) {
      const a2 = newAcc(); const ss = []; for (let u = 0; u <= G.P + 1e-6; u += 0.35) ss.push(u);
      extrudeRail(a2, ss, (u, F) => G.away(att, u, F), side * RAIL_OFF, u => 0.25 + 0.75 * smooth(0, G.P * 0.7, u), 0.002);
      G.away(att, G.P, FR); const heel = FR.p.clone();
      const geo = accGeo(a2); geo.translate(-heel.x, -heel.y, -heel.z); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, MAT.rail); m.position.copy(heel); m.receiveShadow = true; scene.add(m);
      pts.push(m);
    }
    sw.vis = { tgt, points: pts, hit, standPos: sp, stat: vis };
    WORLD.switchVis.push(sw);
  }
}
/* points travel at a fixed rate in sim time; the AI waits for them to finish before it takes a route */
function stepSwitches(dt) { for (const sw of NET.switches) sw.anim += clamp(sw.state - sw.anim, -dt * 0.9, dt * 0.9); }
function updateSwitchVisuals() {
  const tau = 0.12;
  for (const sw of NET.switches) {
    const k = sw.anim, G = sw.geo;
    const offA = -G.sgn * tau * k, offB = G.sgn * tau * (1 - k);
    sw.vis.points[0].rotation.y = offA / G.P;
    sw.vis.points[1].rotation.y = offB / G.P;
    sw.vis.tgt.rotation.y = sw.vis.tgt.userData.yaw0 + k * Math.PI / 2;
  }
}
function buildBumpers(scene) {
  const gb = new GeoBin();
  for (const nd of ROUTE.bumpers) {
    const a = nd.att[0];
    // frame facing back along the track, 1.5 m short of the end
    const s = a.end === 1 ? a.edge.len - 1.2 : 1.2;
    a.edge.pose(s, FR); if (a.end === 0) { FR.f.negate(); FR.r.negate(); }
    const m = frameMatrix(FR, new THREE.Matrix4());
    for (const side of [-1, 1]) {
      gb.add('steel', new THREE.BoxGeometry(0.12, 1.3, 0.12).translate(0.4, 0.4, side * RAIL_OFF), m.clone());
      gb.add('steel', new THREE.BoxGeometry(1.4, 0.1, 0.1).translate(0.0, 0.4, side * RAIL_OFF).applyMatrix4(new THREE.Matrix4().makeRotationZ(0.6)), m.clone());
    }
    gb.add('red', new THREE.BoxGeometry(0.35, 0.4, 2.4).translate(0.45, 0.95, 0), m.clone());
    gb.add('white', new THREE.BoxGeometry(0.36, 0.12, 0.6).translate(0.45, 0.95, 0), m.clone());
  }
  scene.add(gb.build({ steel: MAT.steelDark, red: MAT.redPaint, white: MAT.white }));
}

/* distance culling of fine track detail */
function updateTrackLOD(cam) {
  const cp = cam.position;
  const tn = LOD.tieNear.value, tf = LOD.tieFar.value;
  for (const p of WORLD.pieces) {
    const d = p.userData.sphere.center.distanceTo(cp) - p.userData.sphere.radius;
    if (d > tf.w) { for (const c of p.userData.ties) c.hi.visible = c.lo.visible = false; continue; }
    // a chunk is drawn while any of it is inside its band; the shader dissolves it across the band edges
    for (const c of p.userData.ties) { const dc = c.sp.center.distanceTo(cp); c.hi.visible = dc - c.sp.radius < tn.w; c.lo.visible = dc + c.sp.radius > tf.x && dc - c.sp.radius < tf.w; }
  }
  for (const sw of NET.switches) { const d = sw.vis.standPos.distanceTo(cp); sw.vis.tgt.visible = d < 900; sw.vis.points[0].visible = sw.vis.points[1].visible = d < 700; sw.vis.stat.visible = d < 1400; }
  for (const g of WORLD.poleGroups || []) g.forEach(m => m.visible = m.userData.c.distanceTo(cp) - m.userData.r < 1800);
  // buildings and signals stay until the fog has hidden them, so they never blink out in clear air
  const far = fogFar(6500);
  updateWire(cp);
  for (const b of WORLD.binGroups || []) b.visible = b.userData.c.distanceTo(cp) - b.userData.r < Math.max(3400, far);
  for (const sg of SCN.signals) { const d = Math.hypot(sg.X - cp.x, -sg.N - cp.z); for (const h of sg.heads) h.visible = d < Math.max(3500, far); }
  let hiBudget = 1;
  for (const t of WORLD.tiles) {
    const d = t.c.distanceTo(cp) - t.r; let near = d < 2300;
    if (near && !t.hi) { if (hiBudget-- > 0) tileHi(t, scene); else near = false; }
    else if (!near && t.hi && WORLD.mtn && d > 3800) tileDrop(t);
    if (t.hi) t.hi.visible = near; t.lo.visible = !near;
  }
  const tN = LOD.treeNear.value, tF = LOD.treeFar.value;
  tF.w = fogFar(7000); tF.z = tF.w * 0.65;
  for (const t of WORLD.treeTiles || []) {
    const dc = t.c.distanceTo(cp), near = dc - t.r < tN.w, farOn = dc + t.r > tF.x && dc - t.r < tF.w;
    t.hi.forEach(m => m.visible = near); t.lo.forEach(m => m.visible = farOn);
  }
}
