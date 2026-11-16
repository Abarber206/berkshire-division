/* Light out of the coach windows (src/10m_winlight.js): the panes land on the ground beside a lit car, a few
   metres out, both sides, following the car; only at night; the nearest cars only; the rear marker glows red
   behind the train. Run with: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
function load() {
  const ctx = { Math, console, LAMPS: { lights: [], tmp: [] }, LAMP_KINDS: {}, LAMP_MAX: 16 };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', 'three.min.js'), 'utf8'), ctx, { filename: 'three.min.js' });
  vm.runInContext(fs.readFileSync(path.join(SRC, '01_util.js'), 'utf8') + '\nconst _lc = new THREE.Color();\n' + fs.readFileSync(path.join(SRC, '10m_winlight.js'), 'utf8') +
    '\nthis.X = { wlAt, wlCars, wlMarker, WLIT, WL_MAX, THREE };', ctx);
  return ctx;
}
// the coach's windows as coachModel describes them (13 pairs, 1.58 m apart, glass 1.47 m out, band 2.2-3.0 m)
const COACH = { x0: -9.5, pitch: 1.58, n: 13, so: 0.33, hw: 0.28, side: 1.47, sill: 2.2, head: 3.0, yL: 3.83, half: 11, col: 0xffc47c, I: 4.4, lit: 'coach' };
function car(c, at = [0, 0, 0], yaw = 0, w = COACH) {
  const T = c.X.THREE, scene = new T.Scene(), root = new T.Group();
  root.position.set(...at); root.rotation.y = yaw; root.userData.winLight = w; scene.add(root); scene.updateMatrixWorld(true);
  return { root, kind: 'coach' };
}
const at = (c, x, y, z) => new c.X.THREE.Vector3(x, y, z);
function one(c, v) { const p = v.root.position; return c.X.wlCars([{ vehicles: [v] }], at(c, p.x, p.y + 5, p.z + 20), 1)[0]; }

test('the panes land on the ground a few metres out from the car, on both sides', () => {
  const c = load(), e = one(c, car(c)), x = -9.5 + 6 * 1.58 + 0.33;   // the middle of a pane
  const prof = []; for (let z = 1.6; z < 15; z += 0.2) prof.push([z, c.X.wlAt(e, at(c, x, 0, z))]);
  const lit = prof.filter(([, v]) => v > 0.05 * Math.max(...prof.map(p => p[1])));
  const near = lit[0][0], far = lit[lit.length - 1][0];
  assert.ok(near > 2.6 && near < 4.6, `near edge ${near.toFixed(1)} m from the centre line`);
  assert.ok(far > 6 && far < 11, `far edge ${far.toFixed(1)} m`);
  assert.strictEqual(c.X.wlAt(e, at(c, x, 0, 1.0)), 0, 'nothing under the car');
  const L = c.X.wlAt(e, at(c, x, 0, 5)), R = c.X.wlAt(e, at(c, x, 0, -5));
  assert.ok(L > 0.15 && Math.abs(L - R) < 1e-9, `both sides alike (${L.toFixed(3)})`);
  assert.strictEqual(c.X.wlAt(e, at(c, x, 6, 5)), 0, 'nothing above the line through the window head');
});

test('close to the car each pane shows, with dark piers between; further out they blur into a band', () => {
  const c = load(), e = one(c, car(c)), x0 = -9.5 + 6 * 1.58;
  const pane = c.X.wlAt(e, at(c, x0 + 0.33, 1.8, 2.0)), pier = c.X.wlAt(e, at(c, x0 + 0.79, 1.8, 2.0)), mull = c.X.wlAt(e, at(c, x0, 1.8, 2.0));
  assert.ok(pier < pane * 0.3 && mull < pane * 0.6, `pane ${pane.toFixed(3)}, pier ${pier.toFixed(3)}, between the pair ${mull.toFixed(3)}`);
  const fp = c.X.wlAt(e, at(c, x0 + 0.33, 0, 8.5)), fq = c.X.wlAt(e, at(c, x0 + 0.79, 0, 8.5));
  assert.ok(fq > fp * 0.3, `far out it is one soft band (${fp.toFixed(3)} / ${fq.toFixed(3)})`);
  assert.ok(c.X.wlAt(e, at(c, 14, 0, 5)) < 0.02, 'nothing past the ends of the window run');
  // a wall beside the train (facing the car) catches it too
  assert.ok(c.X.wlAt(e, at(c, x0 + 0.33, 1.5, 4), at(c, 0, 0, -1)) > 0.1, 'lights a wall facing the car');
});

test('the light moves and turns with the car', () => {
  const c = load(), e = one(c, car(c, [500, 20, -300], Math.PI / 2));   // turned: its length now runs along z
  const x = -9.5 + 6 * 1.58 + 0.33;   // car-local x -> world -z
  assert.ok(c.X.wlAt(e, at(c, 500 + 5, 20, -300 - x)) > 0.15, 'beside the turned car');
  assert.strictEqual(c.X.wlAt(e, at(c, 500 - x, 20, -300 + 5)), 0, 'not where the car used to point');
});

test('only after dark, only the nearest cars, and hidden cars are skipped', () => {
  const c = load(), cars = []; for (let i = 0; i < 30; i++) cars.push(car(c, [i * 15, 0, 0]));
  const C = [{ vehicles: cars }];
  assert.strictEqual(c.X.wlCars(C, at(c, 0, 5, 0), 0).length, 0); assert.strictEqual(c.X.WLIT.info[0], 0, 'none by day');
  const n = c.X.wlCars(C, at(c, 0, 5, 0), 1);
  assert.strictEqual(n.length, c.X.WL_MAX); assert.strictEqual(c.X.WLIT.info[0], c.X.WL_MAX);
  assert.ok(n.every(e => e.root.position.x <= (c.X.WL_MAX - 1) * 15), 'the nearest ones');
  const full = n[1].I;
  cars[0].root.visible = false; assert.ok(!c.X.wlCars(C, at(c, 0, 5, 0), 1).some(e => e.root === cars[0].root), 'a hidden car throws no light');
  assert.ok(c.X.wlCars(C, at(c, 0, 5, 0), 0.2)[1].I < full, 'dimmer in the dusk');
});

test('the rear marker glows red on the rails behind the car', () => {
  const c = load(), v = car(c, [100, 0, 0]), list = [];
  v.markers = [at(c, -12.1, 4.2, 0)]; v.root.userData.markerSets = { roof: v.markers, side: [] };
  c.X.wlMarker(v, 1, list);
  assert.strictEqual(list.length, 1); const l = list[0];
  assert.strictEqual(l.kind, 'markBig'); assert.ok(c.LAMP_KINDS.markBig.col > 0xff0000);
  assert.ok(l.p.x < 100 - 12.1 && l.dir.x < -0.9 && l.dir.y < 0, 'out of the lens, back and down');
  c.X.wlMarker(v, 1, list); assert.strictEqual(list.length, 2); assert.strictEqual(list[0], list[1], 'reuses its lamp');
});

test('a train car placed by its matrix (as 07_train.js does) is found there and left where it is', () => {
  const c = load(), v = car(c), T = c.X.THREE;
  v.root.matrixAutoUpdate = false; v.root.matrix.makeRotationY(Math.PI / 2).setPosition(300, 10, 40);
  const before = v.root.matrix.clone();
  const e = c.X.wlCars([{ vehicles: [v] }], at(c, 300, 15, 60), 1)[0];
  assert.ok(e && Math.abs(e.o.x - 300) < 1e-9 && Math.abs(e.o.z - 40) < 1e-9, 'lit where the car really is');
  v.markers = [at(c, -12, 3, 0)]; c.X.wlMarker(v, 1, []);
  assert.ok(v.root.matrix.equals(before), 'its matrix untouched');
  assert.ok(v.root.position.length() === 0 && T);
});
