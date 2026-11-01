"use strict";
/* ============================================================================
   BERKSHIRE DIVISION — utilities
   World axes: x = east, y = up, z = south.  2D plan coords (X,N): x = X, z = -N.
   Vehicle local frame: +X forward, +Y up, +Z right (engineer's side).
   ========================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const MPH = 0.44704, PSI = 6894.76, LBF = 4.44822, STON = 907.185, IN = 0.0254, FT = 0.3048, MILE = 1609.344;
const GAUGE = 1.435, RAIL_OFF = 0.7535;
const $ = id => document.getElementById(id);

function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Noise = (() => {
  const perm = new Uint8Array(512);
  const r = rng(90765);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const X = xi & 255, Y = yi & 255; x -= xi; y -= yi;
    const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
    const A = perm[X] + Y, B = perm[X + 1] + Y;
    return lerp(lerp(grad(perm[A], x, y), grad(perm[B], x - 1, y), u),
                lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u), v) * 0.7;
  }
  function fbm(x, y, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  return { n2, fbm, hash };
})();

/* ---------- geometry helpers ---------- */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function mergeGeos(list) {
  let n = 0; const parts = [];
  let hasColor = false;
  for (const g of list) { const gg = g.index ? g.toNonIndexed() : g; if (!gg.attributes.normal) gg.computeVertexNormals(); parts.push(gg); n += gg.attributes.position.count; if (gg.attributes.color) hasColor = true; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = hasColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) { if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3); }
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
/* Collects geometry per material key, then merges into one mesh per key. */
class GeoBin {
  constructor() { this.bins = {}; }
  add(key, geo, m) { if (m) geo.applyMatrix4(m); (this.bins[key] || (this.bins[key] = [])).push(geo); return geo; }
  box(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(key, new THREE.BoxGeometry(w, h, d), M(x, y, z, rx, ry, rz)); }
  cyl(key, r1, r2, len, seg, x, y, z, rx = 0, ry = 0, rz = 0, open = false) { return this.add(key, new THREE.CylinderGeometry(r1, r2, len, seg, 1, open), M(x, y, z, rx, ry, rz)); }
  /* cylinder lying along X (boiler-style) */
  cylX(key, r1, r2, len, seg, x, y, z) { return this.add(key, new THREE.CylinderGeometry(r2, r1, len, seg, 1, false), M(x, y, z, 0, 0, -Math.PI / 2)); }
  cylZ(key, r, len, seg, x, y, z) { return this.add(key, new THREE.CylinderGeometry(r, r, len, seg), M(x, y, z, Math.PI / 2, 0, 0)); }
  tube(key, pts, r, seg = 24, rs = 6) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))); return this.add(key, new THREE.TubeGeometry(c, seg, r, rs, false)); }
  build(mats, opt = {}) {
    const g = new THREE.Group();
    for (const k in this.bins) {
      if (!this.bins[k].length) continue;
      const mesh = new THREE.Mesh(mergeGeos(this.bins[k]), mats[k]);
      mesh.castShadow = opt.cast !== false && !(mats[k] && mats[k].userData.noShadow);
      mesh.receiveShadow = opt.receive !== false;
      mesh.name = k;
      g.add(mesh);
    }
    return g;
  }
}
/* a round bar from point a to point b ([x, y, z] arrays) */
function barGeo(r, a, b, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize())));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
/* Canvas texture helper */
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (opts.srgb !== false) t.encoding = THREE.sRGBEncoding;
  return t;
}
const hexCss = h => '#' + ((h >>> 0) & 0xffffff).toString(16).padStart(6, '0');
function fmtMi(m) { const mi = m / MILE; return mi < 0.1 ? Math.round(m / FT / 10) * 10 + ' ft' : mi.toFixed(mi < 10 ? 1 : 0) + ' mi'; }

/* Three r128 treats hex colours and vertex colours as linear. Everything here is
   authored in sRGB, so convert once after building. */
function linearizeObject(root) {
  const done = linearizeObject.done || (linearizeObject.done = new WeakSet());
  root.traverse(o => {
    const g = o.geometry;
    if (g && g.attributes && g.attributes.color && !done.has(g.attributes.color.array)) {
      const a = g.attributes.color.array; for (let i = 0; i < a.length; i++) a[i] = Math.pow(a[i], 2.2);
      g.attributes.color.needsUpdate = true; done.add(a);
    }
    if (o.isInstancedMesh && o.instanceColor && !o.instanceColor.userData) {
      const a = o.instanceColor.array; for (let i = 0; i < a.length; i++) a[i] = Math.pow(a[i], 2.2);
      o.instanceColor.needsUpdate = true; o.instanceColor.userData = { lin: true };
    }
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.userData.lin) continue; m.userData.lin = true;
      if (m.color && !(m.isShaderMaterial)) m.color.convertSRGBToLinear();
      if (m.emissive) m.emissive.convertSRGBToLinear();
    }
  });
}
