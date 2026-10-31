/* Foliage and ground cover: the field cover grown round the camera and the mountain forest (trees, boulders, ledge
   rock) stay well clear of every track, and the tree models stay inside their triangle budget (phones draw
   thousands of them). Builds each route's track and terrain with the real three.js, no page or GPU.
   Run with: node --test tests/*.test.js (needs tests/vendor/three.min.js, as the clearance test does). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = {
  ohio: ['01_util.js', '02_track.js', '03_route.js', '04_world.js', '04c_foliage.js', '05_scenery.js', '05b_detail.js'],
  laurel: ['01_util.js', '02_track.js', '03_route.js', '03c_mountain.js', '04_world.js', '04b_mountain.js', '04c_foliage.js', '05_scenery.js', '05b_detail.js', '05d_mountain.js'],
};
const BUILD = {
  ohio: `WORLD.custom = false; buildRoute(); buildLattice();`,
  laurel: `WORLD.custom = false; WORLD.roadsX = []; WORLD.roadN = 1e7; buildMountainRoute(); mtPrepare(); buildLattice();`,
};

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}
function world(route) {
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=' + route },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES[route].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    const scene = new THREE.Group(); var SKY = { snow: false };
    ${BUILD[route]}
    buildTrackHash(); WORLD.treeTiles = [];
    ({ NET, FR, WORLD, INNER, scene, coverCell, foliageGeos, mtForestTile: typeof mtForestTile === 'function' ? mtForestTile : null })`;
  return vm.runInContext(code, ctx, { filename: 'berkshire-foliage.js' });
}
/* nearest track centre, from 1 m samples hashed in 10 m cells */
function trackDist(W) {
  const H = new Map();
  for (const e of W.NET.edges) for (let s = 0; s <= e.len; s += 1) {
    if (e.isTunnel && e.isTunnel(s)) continue;   // the woods grow on the mountain over a bore
    e.pose(s, W.FR); const X = W.FR.p.x, N = -W.FR.p.z, k = Math.floor(X / 10) + ',' + Math.floor(N / 10);
    let a = H.get(k); if (!a) H.set(k, a = []); a.push(X, N);
  }
  return (X, N, reach = 3) => {
    const ix = Math.floor(X / 10), iy = Math.floor(N / 10); let d = Infinity;
    for (let j = iy - reach; j <= iy + reach; j++) for (let i = ix - reach; i <= ix + reach; i++) {
      const a = H.get(i + ',' + j); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) d = Math.min(d, Math.hypot(a[q] - X, a[q + 1] - N));
    }
    return d;
  };
}
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

test('tree, conifer and bush models stay inside their triangle budget', { skip: SKIP }, () => {
  const W = world('ohio'), G = W.foliageGeos();
  for (const [k, max] of [['dec', 200], ['dec2', 200], ['con', 200], ['con2', 200], ['bush', 48], ['decLo', 2], ['conLo', 2]]) {
    const t = G[k].index ? G[k].index.count / 3 : G[k].attributes.position.count / 3;
    assert.ok(t <= max, `${k} has ${t} triangles (budget ${max})`);
  }
});

for (const route of ['ohio', 'laurel']) test(`ground cover keeps clear of the track (${route})`, { skip: SKIP }, () => {
  const W = world(route), near = trackDist(W);
  let n = 0, worst = Infinity;
  const main = W.NET.edges.reduce((a, e) => (e.len > a.len ? e : a));
  const seen = new Set();
  for (let s = 0; s < main.len; s += 700) {
    main.pose(s, W.FR);
    const ci = Math.floor(W.FR.p.x / 48), cj = Math.floor(-W.FR.p.z / 48);
    for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = (ci + di) + ',' + (cj + dj); if (seen.has(key)) continue; seen.add(key);
      const c = W.coverCell(ci + di, cj + dj, W.scene);
      c.grp.traverse(o => {
        if (!o.isInstancedMesh) return;
        const a = o.instanceMatrix.array;
        for (let i = 0; i < o.count; i++) { const X = a[i * 16 + 12], N = -a[i * 16 + 14], d = near(X, N); n++; worst = Math.min(worst, d); }
      });
    }
  }
  assert.ok(n > 200, `only ${n} tufts grown near the line`);
  assert.ok(worst > 9, `a tuft stands ${worst.toFixed(1)} m from a track centre`);
});

test('the mountain forest, its boulders and ledge rock keep clear of the track', { skip: SKIP }, () => {
  const W = world('laurel'), near = trackDist(W);
  const main = W.NET.edges.reduce((a, e) => (e.len > a.len ? e : a));
  const keys = new Set();
  for (let s = 0; s < main.len; s += 3000) { main.pose(s, W.FR); keys.add(Math.floor((W.FR.p.x - W.INNER.x0) / 1500) + ',' + Math.floor((-W.FR.p.z - W.INNER.n0) / 1500)); }
  let trees = 0, rocks = 0, worstTree = Infinity, worstRock = Infinity;
  for (const key of [...keys].slice(0, 4)) {
    const tt = W.mtForestTile(key, W.scene);
    for (const m of tt.hi) {
      const a = m.instanceMatrix.array, rock = m.geometry.attributes.aLeaf === undefined;
      for (let i = 0; i < m.count; i++) {
        const X = a[i * 16 + 12], N = -a[i * 16 + 14], sc = Math.hypot(a[i * 16], a[i * 16 + 2]);
        const d = near(X, N, 4);
        if (rock) { rocks++; worstRock = Math.min(worstRock, d - sc * 1.4); } else { trees++; if (d < worstTree) { worstTree = d; W.at = [X, N]; } }
      }
    }
  }
  assert.ok(trees > 1000, `only ${trees} trees grown`);
  assert.ok(rocks > 20, `only ${rocks} boulders placed`);
  assert.ok(worstTree > 14, `a tree stands ${worstTree.toFixed(1)} m from a track centre at X ${W.at[0].toFixed(0)} N ${W.at[1].toFixed(0)}`);
  assert.ok(worstRock > 8, `a boulder reaches within ${worstRock.toFixed(1)} m of a track centre`);
});
