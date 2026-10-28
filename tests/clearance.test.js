/* Track clearance: no lineside structure may stand inside the space a train sweeps on any track.
   Builds the Berkshire Division's route and lineside scenery with the real three.js (geometry only, no page or GPU)
   and samples every scenery surface against every track centre line. Run with: node --test tests/*.test.js
   three.js r128 is read from tests/vendor/three.min.js (CI fetches it with `npm pack three@0.128.0`). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '04_world.js', '05_scenery.js'];

// the swept envelope: a car body is 1.63 m either side of centre; structures above 4.9 m (coal chutes,
// water spouts, engine house door heads) are meant to reach over the train
const HALF_WIDTH = 1.9, LOW = 0.25, HIGH = 4.9;

/* any call on a 2D canvas context is a no-op, so the scenery's painted textures build without a page */
function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}

function world() {
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {},
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    const __parts = [], __add = GeoBin.prototype.add;
    GeoBin.prototype.add = function (k, g, m) { __add.call(this, k, g, m); __parts.push({ bin: this, g, who: (new Error().stack.split('\\n')[2].match(/at (\\S+)/) || [])[1] }); return g; };
    const scene = new THREE.Group();
    WORLD.custom = false; buildRoute(); buildLattice();
    buildStations(); buildBridge(scene); buildRoads(scene); buildSignals(scene); buildSigns(); buildPoleLine(scene);
    const bins = new Set(SCN.bins.values()), parts = __parts.filter(p => bins.has(p.bin));
    scene.updateMatrixWorld(true);
    const _m = new THREE.Matrix4();
    scene.traverse(o => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      if (!o.isInstancedMesh) { parts.push({ g: o.geometry.clone().applyMatrix4(o.matrixWorld), who: o.name || 'scene mesh' }); return; }
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _m); parts.push({ g: o.geometry.clone().applyMatrix4(_m.premultiply(o.matrixWorld)), who: o.name || 'instanced mesh' }); }
    });
    ({ NET, FR, parts })`;
  return vm.runInContext(code, ctx, { filename: 'berkshire-world.js' });
}

/* every 0.5 m of every track, hashed in 5 m cells, with the railhead height */
function trackIndex(W) {
  const H = new Map();
  // a dead end stops at its bumper (or the engine house back wall), so leave out its last 3 m
  for (const e of W.NET.edges) for (let s = e.a.att.length === 1 ? 3 : 0; s <= e.len - (e.b.att.length === 1 ? 3 : 0); s += 0.5) {
    e.pose(s, W.FR); const X = W.FR.p.x, N = -W.FR.p.z, k = Math.floor(X / 5) + ',' + Math.floor(N / 5);
    let a = H.get(k); if (!a) H.set(k, a = []); a.push(X, N, W.FR.p.y);
  }
  return (X, N) => {
    const ix = Math.floor(X / 5), iy = Math.floor(N / 5); let d = Infinity, y = 0;
    for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
      const a = H.get(i + ',' + j); if (!a) continue;
      for (let q = 0; q < a.length; q += 3) { const dd = Math.hypot(a[q] - X, a[q + 1] - N); if (dd < d) { d = dd; y = a[q + 2]; } }
    }
    return { d, y };
  };
}

test('nothing lineside fouls a track', { skip: !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)' }, () => {
  const W = world(), near = trackIndex(W), fouls = new Map();
  assert.ok(W.parts.length > 1000, `only ${W.parts.length} scenery parts were built`);
  const p = [0, 0, 0];
  for (const part of W.parts) {
    const pos = part.g.attributes.position, idx = part.g.index && part.g.index.array, nt = idx ? idx.length / 3 : pos.count / 3;
    part.g.computeBoundingBox(); const bb = part.g.boundingBox;
    const r = Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
    if (near((bb.min.x + bb.max.x) / 2, -(bb.min.z + bb.max.z) / 2).d > r + HALF_WIDTH + 1) continue;
    for (let t = 0; t < nt; t++) {
      const v = [0, 1, 2].map(c => { const i = idx ? idx[t * 3 + c] : t * 3 + c; return [pos.getX(i), pos.getY(i), pos.getZ(i)]; });
      const edge = Math.max(...[[0, 1], [1, 2], [2, 0]].map(([a, b]) => Math.hypot(v[a][0] - v[b][0], v[a][1] - v[b][1], v[a][2] - v[b][2])));
      const n = Math.min(60, Math.ceil(edge / 0.3));   // a barycentric grid about 0.3 m apart over the triangle
      for (let a = 0; a <= n; a++) for (let b = 0; a + b <= n; b++) {
        const u = a / n, w = b / n;
        for (let c = 0; c < 3; c++) p[c] = v[0][c] + (v[1][c] - v[0][c]) * u + (v[2][c] - v[0][c]) * w;
        const tr = near(p[0], -p[2]), h = p[1] - tr.y;
        if (tr.d < HALF_WIDTH && h > LOW && h < HIGH) {
          const f = fouls.get(part.who);
          if (!f || tr.d < f.d) fouls.set(part.who, { d: +tr.d.toFixed(2), h: +h.toFixed(2), X: +p[0].toFixed(1), N: +(-p[2]).toFixed(1) });
        }
      }
    }
  }
  assert.deepEqual([...fouls].map(([who, f]) => `${who} is ${f.d} m off a track centre, ${f.h} m above the rail, at X ${f.X} N ${f.N}`), []);
});
