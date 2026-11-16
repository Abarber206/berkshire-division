/* A train on straight, level track for the wreck physics (src/07d_wreck.js), with the real three.js r128
   (tests/vendor): boxes the size of an engine, tender and cars, run off the rails at a given speed the way
   GAME.derail and GAME.wreckStep do it, with the cars still on the rails carried along the track. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');

function loadWreck(extra = '') {
  const ctx = { console, Math, navigator: { userAgent: 'node' } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = fs.readFileSync(path.join(SRC, '01_util.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SRC, '07d_wreck.js'), 'utf8') + `
    var WORLD = {}, AU = { on: false };
    function sndClunk() {}
    function groundAt(X, N) { return -0.9; }   // the fields either side, a little below the roadbed
    function mtInBore() { return null; }
    function newFrame() { return {}; }
    function frameMatrix(F, m) { m.makeBasis(F.f, F.u, F.r); m.setPosition(F.p); return m; }
    ${extra}
    ({ THREE, WreckSim, WK })`;
  return vm.runInContext(code, ctx, { filename: 'wreck.js' });
}

/* Each car's box takes in its couplers, so coupled boxes overlap a little at the ends, as in the game.
   kinds: list of [kind, length m, mass kg]; the train runs toward +x with its front coupler at x = 0. gap: metres the
   coupler faces stand apart (as the track can leave them in the game) */
function makeTrain(W, kinds, gap = 0, opt = {}) {
  const { THREE } = W;
  // dir -1: the train faces -x (front coupler at x, the rest of it toward +x)
  const dir = opt.dir || 1, rot = new THREE.Matrix4().makeRotationY(dir > 0 ? 0 : Math.PI);
  const T = { vehicles: [], loco: {}, x: opt.x || 0, dir };
  let a = 0;
  for (const [kind, len, mass] of kinds) {
    const root = new THREE.Group(); root.matrixAutoUpdate = false;
    const box = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 3.4, 3.1), new THREE.MeshBasicMaterial());
    box.position.y = 2.6; root.add(box); box.updateMatrix();
    const v = { kind, len, mass, a0: a, root, ptsAll: [], model: {}, trucks: kind === 'loco' ? [] : [{ type: 'four' }, { type: 'four' }], tp: [], flip: false };
    v._cf = new THREE.Vector3(len / 2 - gap / 2, 0.88, 0); v._cr = new THREE.Vector3(-len / 2 + gap / 2, 0.88, 0); v._sF = 1;
    T.vehicles.push(v); a += len;
  }
  T.length = a;
  T.place = () => {
    for (const v of T.vehicles) {
      if (v.rb) continue;
      const x = T.x - dir * (v.a0 + v.len / 2);
      v.root.matrix.makeTranslation(x, 0, 0).multiply(rot); v.root.updateMatrixWorld(true);
      v.pos = (v.pos || new THREE.Vector3()).set(x, 0, 0); v.fwd = (v.fwd || new THREE.Vector3()).set(dir, 0, 0);
      v.tp = [-1, 1].map(k => ({ F: { p: new THREE.Vector3(x + k * (v.len / 2 - 2), 0, 0), f: new THREE.Vector3(dir, 0, 0), u: new THREE.Vector3(0, 1, 0), r: new THREE.Vector3(0, 0, dir) } }));
    }
  };
  T.place();
  return T;
}

/* derail at v0 m/s (spec as GAME.derail), then step at 60 Hz for secs; returns per-frame stats */
function runWreck(W, T, v0, secs, spec = {}, onFrame) {
  const mph = v0 / 0.44704;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const R = new W.WreckSim(T, Object.assign({ a: 0, side: 1, k: clamp((mph - 4) / 40, 0.15, 1), v0, vs: v0, seed: 7 }, spec));
  const kin = { v: v0, mass: 0, force: 0 };
  const dt = 1 / 60, out = [];
  for (let f = 0; f < secs * 60; f++) {
    kin.mass = 0; for (const v of T.vehicles) if (!v.rb) kin.mass += v.mass;
    kin.dx = undefined;
    if (!R.asleep) R.step(dt, kin);
    if (kin.mass <= 0) kin.v = 0;
    T.x += kin.dx !== undefined ? kin.dx : kin.v * dt; T.place();
    const st = { t: (f + 1) * dt, kv: kin.v, bodies: R.bodies.map(b => {
      let lo = Infinity; for (const s of b.pts) { const P = s.clone().applyQuaternion(b.q).add(b.p); lo = Math.min(lo, P.y - R.ground(b, P)); }
      return { i: b.i, truck: !!b.truck, sp: b.lv.length(), y: b.p.y, lo, up: b.ax[1].y, sleep: !!b.sleep };
    }), broken: R.broken.size, asleep: R.asleep };
    out.push(st); if (onFrame) onFrame(st, R);
    if (R.asleep && Math.abs(kin.v) < 0.05) break;
  }
  return { R, out };
}

/* Trains that meet (as KNOCK does it in the game): each { T, v: m/s toward its front, spec }; every one starts with
   nothing off the rails (spec.none) unless its spec says otherwise, and they are stepped together at 60 Hz */
function runKnock(W, list, secs, onFrame) {
  const clk = {}, dt = 1 / 60;
  for (const o of list) {
    o.R = new W.WreckSim(o.T, Object.assign({ a: 0, side: 1, k: 0.5, none: true, v0: Math.abs(o.v), vs: o.v, seed: 7 }, o.spec || {}));
    o.kin = { v: o.v, mass: 0, force: 0 }; o.x0 = o.T.x;
  }
  let f = 0;
  for (; f < secs * 60; f++) {
    for (const o of list) { o.kin.mass = 0; for (const v of o.T.vehicles) if (!v.rb) o.kin.mass += v.mass; o.R.kin = o.kin; }
    W.WreckSim.stepAll(list.map(o => o.R), dt, clk);
    for (const o of list) { if (o.kin.mass <= 0) o.kin.v = 0; o.T.x += o.T.dir * o.kin.dx; o.T.place(); }
    if (onFrame) onFrame((f + 1) * dt, list);
    if (list.every(o => o.R.asleep && Math.abs(o.kin.v) < 0.05)) break;
  }
  return { t: (f + 1) * dt };
}

const PASSENGER = [['loco', 30, 200000], ['tender', 30, 170000], ...Array.from({ length: 8 }, () => ['coach', 25, 60000])];
const FREIGHT = [['loco', 30, 200000], ['tender', 30, 170000], ...Array.from({ length: 20 }, (_, i) => ['car', 17, i % 2 ? 30000 : 120000])];
module.exports = { loadWreck, makeTrain, runWreck, runKnock, PASSENGER, FREIGHT, THREE_JS };
