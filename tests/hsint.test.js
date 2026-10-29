/* Inside the high-speed trainsets: the cab is closed all round (from the driver's seat you see the cab, the glass
   and the world through it, never the inside of the paint), the windows are open through the wall, and nothing
   inside reaches out through the body or hangs below the floor.
   Builds every E5 and Acela car with the real three.js (geometry only, no page or GPU) and casts rays.
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
const SKINS = new Set(['e5SkinNose', 'e5SkinMid', 'acSkinPower', 'acSkinCoach', 'hsUnder']);
const GLASS = new Set(['hsGlass', 'hsPane']);
/* every visible mesh of a car, for the raycaster */
function solids(W, m) { const out = []; m.root.traverse(o => { if (o.isMesh && o.material !== W.RMAT.hit && o.material && o.material.visible !== false) out.push(o); }); return out; }

test('from the driver’s seat the cab is closed all round: lining, desk, glass, never the inside of the paint', () => {
  const W = sets(), { THREE } = W, rc = new THREE.Raycaster();
  for (const key of ['e5', 'acela']) {
    const m = W.cars[key][0], ms = solids(W, m), eye = m.cabEye.clone().applyMatrix4(m.root.matrixWorld);
    let n = 0, glass = 0;
    for (let i = 0; i < 400; i++) {
      // directions spread evenly over the sphere
      const y = 1 - 2 * (i + 0.5) / 400, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      rc.set(eye, new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th))); rc.near = 0; rc.far = 6;
      const h = rc.intersectObjects(ms, false)[0];
      assert.ok(h, `${key}: a ray from the cab eye escapes without hitting anything (direction ${i}): a hole in the cab`);
      assert.ok(!SKINS.has(h.object.name), `${key}: from the cab eye a ray meets the inside of the body (${h.object.name}) at ${h.distance.toFixed(2)} m`);
      n++; if (GLASS.has(h.object.name)) glass++;
    }
    assert.ok(glass > 25, `${key}: only ${glass} of ${n} rays from the cab eye go out through glass`);
    // straight ahead and a little down, the road is seen through the windscreen
    for (const yaw of [-0.15, 0, 0.15]) for (const pitch of [-0.12, -0.05]) {
      rc.set(eye, new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw)).normalize()); rc.far = 6;
      const h = rc.intersectObjects(ms, false)[0];
      assert.ok(h && h.object.name === 'hsGlass', `${key}: looking ahead (yaw ${yaw}, pitch ${pitch}) the first thing is ${h ? h.object.name : 'nothing'}, not the windscreen`);
    }
  }
});

test('every window is open through the wall: from outside, the glass and then the inside of the car', () => {
  const W = sets(), { THREE } = W, rc = new THREE.Raycaster();
  for (const key of ['e5', 'acela']) for (const m of W.cars[key]) {
    const ms = solids(W, m), sh = m.shell, R = W.hsRing(sh.sect((sh.holes[0][0] + sh.holes[0][1]) / 2), sh.cut);
    const wy = (sh.sect((sh.holes[0][0] + sh.holes[0][1]) / 2).wy);
    for (const [h0, h1] of sh.holes) for (const s of [-1, 1]) {
      const y = (wy[0] + wy[1]) / 2, z = W.ringZ(R, y), p = new THREE.Vector3(m.ref - (h0 + h1) / 2, y, s * (z + 1)).applyMatrix4(m.root.matrixWorld);
      const d = new THREE.Vector3(0, 0, -s).transformDirection(m.root.matrixWorld);
      rc.set(p, d); rc.near = 0; rc.far = 6;
      const hs = rc.intersectObjects(ms, false);
      assert.ok(hs.length && hs[0].object.name === 'hsPane', `${key} car ${m.num}: the window at ${h0.toFixed(2)} m shows ${hs.length ? hs[0].object.name : 'nothing'} first, not glass`);
      const behind = hs.find(h => !GLASS.has(h.object.name));
      // the inside of the car, or straight out through the window opposite
      assert.ok(!behind || (!SKINS.has(behind.object.name) && behind.distance > 1.05), `${key} car ${m.num}: behind the window at ${h0.toFixed(2)} m is ${behind ? behind.object.name : 'nothing'}`);
    }
  }
});

test('everything inside stays inside the body and on or above the floor', () => {
  const W = sets(), { THREE } = W, v = new THREE.Vector3();
  for (const key of ['e5', 'acela']) for (const m of W.cars[key]) {
    const sh = m.shell, objs = [m.inner, ...(m.cab ? m.cab.ctls.map(c => c.outer).filter(Boolean) : [])];
    let worst = 0, where = '';
    for (const o of objs) o.traverse(mesh => {
      // the windscreen's seal runs out to the skin itself, which bulges a few mm past the ring's chords
      if (!mesh.isMesh || mesh.material === W.RMAT.hit || !mesh.material.visible || mesh.name === 'hsRubber') return;
      mesh.updateWorldMatrix(true, false);
      const P = mesh.geometry.attributes.position, inv = new THREE.Matrix4().copy(m.body.matrixWorld).invert(), mat = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mat);
        const a = m.ref - v.x, R = W.hsRing(sh.sect(a), sh.cut), zMax = W.ringZ(R, v.y), yMax = W.ringTop(R, Math.abs(v.z));
        const out = Math.max(Math.abs(v.z) - zMax, v.y - yMax, 0);
        if (out > worst) { worst = out; where = `${mesh.name} at a ${a.toFixed(2)} y ${v.y.toFixed(2)} z ${v.z.toFixed(2)}`; }
      }
    });
    assert.ok(worst < 0.003, `${key} car ${m.num}: inside part pokes ${(worst * 1000).toFixed(0)} mm out through the body (${where})`);
  }
});

test('the cabs have their controls and live screens on the lead car only', () => {
  const W = sets();
  for (const key of ['e5', 'acela']) {
    const set = W.cars[key], lead = set[0].cab, tail = set[set.length - 1].cab;
    for (const id of ['throttle', 'brake', 'dyn', 'reverser', 'horn', 'pan', 'light']) assert.ok(lead.ctls.some(c => c.id === id), `${key}: no ${id} in the cab`);
    assert.equal(lead.screens.length, 3, `${key}: lead cab screens`);
    assert.equal(tail.screens.length, 0, `${key}: the trailing cab should have dark screens`);
    assert.ok(set.slice(1, -1).every(m => !m.cab), `${key}: only the end cars have cabs`);
  }
});
