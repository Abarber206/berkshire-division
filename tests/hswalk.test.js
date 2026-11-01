/* Walking through the high-speed trainsets: every passenger car has seats, an aisle and vestibules laid out for
   11j_walk, and the doorways at the saloon ends, through the car ends and the gangways really are open (with the
   sliding doors drawn back), so a passenger walks from car to car without passing through anything.
   Run with: node --test tests/*.test.js. three.js r128 is read from tests/vendor/three.min.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '06_models.js', '06b_diesel.js', '06c_couplers.js', '06d_cab.js', '06e_hsr.js', '06f_hsint.js'];

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}
let built = null;
function sets() {
  if (built) return built;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {},
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = 'var SCN = { winMats: [] }, SKY = { night: false }, TEX = {}, GAME = { isDiesel: () => true, train: null }, S = { throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6, dyn: 0, whistle: 0, panUp: true, vcb: true, light: 1, bell: false, ditch: true };\n' + FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    rollingMaterials();
    const cars = { e5: HSR.e5.cars.map((d, i) => buildE5Car(d, i)), acela: HSR.acela.cars.map((d, i) => buildAcelaCar(d, i)) };
    for (const k in cars) for (const m of cars[k]) m.root.updateMatrixWorld(true);
    ({ THREE, RMAT, cars, hsRing, ringZ, ringTop })`;
  return (built = vm.runInContext(code, ctx, { filename: 'berkshire-hsr.js' }));
}
function solids(W, m) { const out = []; m.root.traverse(o => { if (o.isMesh && o.material !== W.RMAT.hit && o.material && o.material.visible !== false) out.push(o); }); return out; }
const open = (W, m, on) => m.inner.traverse(o => { if (o.isMesh && (o.name === 'hsSlide' || o.name === 'hsSlidePane')) { o.position.z = on ? 0.84 : 0; o.updateMatrixWorld(); } });
const each = (W, f) => { for (const k of ['e5', 'acela']) W.cars[k].forEach((m, i) => f(m, `${k} car ${i + 1}`, k, i)); };

test('every passenger car has a plan to walk: seats on the floor inside the walls, an aisle to walk down', () => {
  const W = sets();
  each(W, (m, n, k) => {
    if (k === 'acela' && m.nose) { assert.equal(m.walk, null, `${n}: a power car has no saloon`); return; }
    const w = m.walk, S = w.saloon;
    assert.ok(w && S.seats.length >= 15, `${n}: ${S && S.seats.length} seats`);
    assert.ok(S.aisle[1] - S.aisle[0] >= 0.38, `${n}: aisle only ${(S.aisle[1] - S.aisle[0]).toFixed(2)} m wide`);
    for (const q of S.seats) {
      assert.ok(q.x > S.x1 && q.x < S.x0, `${n}: a seat at x ${q.x.toFixed(2)} outside the saloon`);
      assert.ok(Math.abs(q.z) < S.zWall, `${n}: a seat at z ${q.z.toFixed(2)} in the wall`);
      assert.ok(q.z < S.aisle[0] || q.z > S.aisle[1], `${n}: a seat in the aisle`);
    }
    for (const v of w.vest) if (v) for (const x of v.doors) assert.ok(x > v.x0 && x < v.x1, `${n}: a side door at x ${x.toFixed(2)} outside its vestibule`);
  });
});

test('the doorways go through: down the middle of the car to each open end, closed at the nose', () => {
  const W = sets(), { THREE } = W, rc = new THREE.Raycaster();
  each(W, (m, n) => {
    if (!m.walk) return;
    open(W, m, true);
    const ms = solids(W, m), S = m.walk.saloon, y = m.walk.yF + 1.0;
    [[m.walk.vest[0], 1, S.x0], [m.walk.vest[1], -1, S.x1]].forEach(([v, e, wall]) => {
      const from = new THREE.Vector3((S.x0 + S.x1) / 2, y, 0).applyMatrix4(m.root.matrixWorld);
      rc.set(from, new THREE.Vector3(e, 0, 0).transformDirection(m.root.matrixWorld)); rc.near = 0; rc.far = 40;
      const h = rc.intersectObjects(ms, false)[0], reach = Math.abs((v ? v.xEnd : wall) - (S.x0 + S.x1) / 2);
      if (v) assert.ok(!h || h.distance > reach - 0.01, `${n}: the way to the ${e > 0 ? 'front' : 'back'} is blocked by ${h && h.object.name} ${h && (reach - h.distance).toFixed(2)} m short of the end`);
      else assert.ok(h && h.distance < reach + 0.1, `${n}: the ${e > 0 ? 'front' : 'back'} of the saloon is open with no car beyond`);
    });
    open(W, m, false);
    // with the doors shut the way is closed again at the saloon's ends
    const ms2 = solids(W, m);
    for (const [v, e, wall] of [[m.walk.vest[0], 1, S.x0], [m.walk.vest[1], -1, S.x1]]) {
      if (!v) continue;
      rc.set(new THREE.Vector3((S.x0 + S.x1) / 2, y + 0.4, 0).applyMatrix4(m.root.matrixWorld), new THREE.Vector3(e, 0, 0).transformDirection(m.root.matrixWorld));
      const h = rc.intersectObjects(ms2, false)[0];
      assert.ok(h && Math.abs(h.distance - Math.abs(wall - (S.x0 + S.x1) / 2)) < 0.1, `${n}: the sliding door is not across the doorway`);
    }
  });
});
