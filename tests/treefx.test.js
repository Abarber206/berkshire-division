/* Tree shadows and drifting leaves (src/10g_treefx.js): every near tree patch says which model it is, the
   shadow set is the nearest trees within reach (capped, nearest first), and the leaf count follows the trees,
   the wind, the weather and the hour. Builds the Ohio woodlots with the real three.js, no page or GPU.
   Run with: node --test tests/*.test.js (needs tests/vendor/three.min.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '04_world.js', '04c_foliage.js', '05_scenery.js', '05b_detail.js', '10g_treefx.js'];
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}
let W = null;
function world() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '' },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    const scene = new THREE.Group(); var SKY = { snow: false };
    WORLD.custom = false; 
    const G = foliageGeos(), r = rng(3), L = { dec: [], con: [] };
    for (let i = 0; i < 400; i++) L[r() < 0.7 ? 'dec' : 'con'].push([r() * 600 - 300, 0, r() * 600 - 300, 1, 1, [0.4, 0.5, 0.2]]);
    treeMeshes(L, scene);
    ({ WORLD, tfxTreesNear, leafAmount, scene })`;
  return (W = vm.runInContext(code, ctx, { filename: 'berkshire-treefx.js' }));
}

test('every near tree patch names its model, so its shadow can be drawn', { skip: SKIP }, () => {
  const { WORLD } = world();
  const hi = WORLD.treeMeshes.filter(m => m.material && m.userData.sph);
  assert.ok(hi.length > 10, 'built some near tree patches');
  for (const m of hi) assert.ok(['dec', 'dec2', 'con', 'con2'].includes(m.userData.fk), `patch has fk ${m.userData.fk}`);
});

test('the shadow set is the nearest trees within reach, nearest first and capped', { skip: SKIP }, () => {
  const { WORLD, tfxTreesNear } = world();
  const m = WORLD.treeMeshes.find(q => q.userData.fk && q.count > 20), a = m.instanceMatrix.array;
  const X = a[12] + 7, Z = a[14] - 4;
  const all = tfxTreesNear(WORLD.treeMeshes, X, Z, 64, 1e6);
  assert.ok(all.length > 0);
  for (let i = 1; i < all.length; i++) assert.ok(all[i][0] >= all[i - 1][0], 'sorted by distance');
  assert.ok(all.every(q => q[0] < 64 * 64), 'all within reach');
  // brute force: nothing within reach was missed
  let n = 0; for (const q of WORLD.treeMeshes) { if (!q.userData.fk) continue; const b = q.instanceMatrix.array; for (let i = 0; i < q.count; i++) if ((b[i * 16 + 12] - X) ** 2 + (b[i * 16 + 14] - Z) ** 2 < 64 * 64) n++; }
  assert.equal(all.length, n);
  const capped = tfxTreesNear(WORLD.treeMeshes, X, Z, 64, 5);
  assert.equal(capped.length, Math.min(5, n));
  assert.deepEqual(capped.map(q => q[0]), all.slice(0, capped.length).map(q => q[0]));
});

test('leaves: more under trees and in a breeze, almost none in rain, snow, at night or in a tunnel', { skip: SKIP }, () => {
  const { leafAmount } = world();
  const dry = { rain: 0, snow: 0 };
  const woods = leafAmount(40, 2, dry, 0, false, 0), open = leafAmount(0, 2, dry, 0, false, 0);
  assert.ok(woods > 0.8 && open < 0.2 && open > 0, `woods ${woods}, open ${open}`);
  assert.ok(leafAmount(40, 5, dry, 0, false, 0) >= woods);
  assert.ok(leafAmount(40, 2, { rain: 1, snow: 0 }, 0, false, 0) < 0.15 * woods);
  assert.equal(leafAmount(40, 2, { rain: 0, snow: 0.8 }, 0, true, 0), 0);
  assert.ok(leafAmount(40, 2, dry, 1, false, 0) < 0.25 * woods);
  assert.ok(leafAmount(40, 2, dry, 0, true, 0) < 0.4 * woods);
  assert.equal(leafAmount(40, 2, dry, 0, false, 1), 0);
});
