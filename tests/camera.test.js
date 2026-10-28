/* Cameras: the outside views stay out of the ground, buildings and trains, and the trackside and
   cinematic shots only ever stand somewhere a person with a camera could.
   Builds the route and lineside scenery with the real three.js, as the clearance test does.
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '04_world.js', '05_scenery.js'];

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}

function world() {
  // the shots pick their spots at random: seed it so a failure can be reproduced
  let seed = 12345;
  const SeededMath = Object.create(Math, { random: { value: () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) } });
  const ctx = { console, Math: SeededMath, performance: { now: () => 0 }, self: {}, window: {},
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    const CAM = { modes: [], names: {} }, GAME = { train: null }, S = { v: 0 };
    ` + fs.readFileSync(path.join(SRC, '11a_camera.js'), 'utf8') + `
    const scene = new THREE.Group();
    WORLD.custom = false; buildRoute(); buildLattice();
    buildStations(); buildBridge(scene); buildRoads(scene); buildSignals(scene); buildSigns(); buildPoleLine(scene);
    /* a stand-in train: one 30 m engine standing at s on edge e, facing +s */
    function fakeTrain(e, s) {
      const tp = new TrackPos(e, s, 1), F = tp.pose(newFrame());
      const lead = { pos: F.p.clone(), fwd: F.f.clone(), len: 30, kind: 'loco' };
      return { lead, vehicles: [lead], first: lead, last: lead, li: 0, frontTP: () => tp, rearTP: () => tp };
    }
    ({ THREE, NET, ROUTE, SCN, CAM, GAME, SHOTS, groundAt, trackGap, inFoot, camSolid, camClear, footTop, fakeTrain })`;
  return vm.runInContext(code, ctx, { filename: 'berkshire-camera.js' });
}

const W = world();
const { THREE } = W;
/* places along the main, every 700 m */
const spots = [];
for (const e of W.NET.edges) if (e.len > 600) for (let s = 150; s < e.len - 150; s += 700) spots.push([e, s]);
/* the distance from p to the nearest track that isn't the one the spot was measured from */
const otherGap = (p, own) => {
  let d = Infinity;
  for (const e of W.NET.edges) for (let i = 0; i < e.n; i++) {
    const g = Math.hypot(e.X[i] - p.x, e.N[i] + p.z);
    if (g < d && Math.hypot(e.X[i] - own.x, e.N[i] + own.z) > g + 1.5) d = g;
  }
  return d;
};

test('a camera pushed into a train comes out clear of it', () => {
  const T = W.fakeTrain(...spots[0]); W.GAME.train = T;
  const L = T.lead, rx = L.fwd.z, rz = -L.fwd.x, rl = Math.hypot(rx, rz);
  for (const [a, lat, h] of [[0, 0, 2], [10, 0.8, 4.5], [-14, -1.5, 1], [5, 1.9, 0.5], [-3, 0.2, 5]]) {
    const p = L.pos.clone().addScaledVector(L.fwd, a); p.x += rx / rl * lat; p.z += rz / rl * lat; p.y += h;
    W.camSolid(p, 0.9);
    const d = p.clone().sub(L.pos), along = Math.abs(d.dot(L.fwd)), side = Math.abs((d.x * rx + d.z * rz) / rl);
    assert.ok(along > L.len / 2 + 0.4 || side > 1.9 || d.y > 5.2, `still inside the engine at ${a}, ${lat}, ${h}: ${along.toFixed(2)} ${side.toFixed(2)} ${d.y.toFixed(2)}`);
  }
  W.GAME.train = null;
});

test('the chase camera never ends up under the ground or inside a building', () => {
  let n = 0;
  for (const [e, s] of spots) {
    const T = W.fakeTrain(e, s), tgt = T.lead.pos.clone(); tgt.y += 2.6;
    for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 6) for (const pitch of [-0.16, 0.05, 0.4, 1.0]) for (const dist of [12, 40, 140]) {
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const p = tgt.clone().addScaledVector(dir, W.camClear(tgt, dir, dist, 4));
      W.camSolid(p, 0.9);
      assert.ok(p.y >= W.groundAt(p.x, -p.z) + 0.85, `under the ground at ${e.id}/${s}`);
      for (const f of W.SCN.foot) {
        const dx = p.x - f[0], dz = p.z - f[1];
        if (Math.abs(dx * f[2] + dz * f[3]) < f[6] && Math.abs(dx * f[4] + dz * f[5]) < f[7]) assert.ok(p.y > W.footTop(f), `inside a building at ${e.id}/${s}`);
      }
      n++;
    }
  }
  assert.ok(n > 500);
});

test('trackside, rail-level and long-lens shots stand clear of every track and building', () => {
  W.CAM.vs = 20;
  const found = { trackside: 0, rail: 0, longlens: 0 };
  for (const [e, s] of spots) {
    const T = W.fakeTrain(e, s);
    for (const name of Object.keys(found)) for (let k = 0; k < 3; k++) {
      const st = W.SHOTS[name].pick(T);
      if (!st) continue;
      found[name]++;
      const p = st.p, g = W.groundAt(p.x, -p.z), gap = W.trackGap(p.x, -p.z);
      assert.ok(p.y > g, `${name} camera underground at ${e.id}/${s}`);
      assert.ok(!W.inFoot(p.x, -p.z, 0.5), `${name} camera inside a building at ${e.id}/${s}`);
      if (name === 'trackside') assert.ok(gap >= 6, `trackside camera ${gap.toFixed(1)} m from a track at ${e.id}/${s}`);
      else assert.ok(gap >= 2.95, `${name} camera ${gap.toFixed(1)} m from a track at ${e.id}/${s}`);
    }
  }
  for (const [name, n] of Object.entries(found)) assert.ok(n >= spots.length / 2, `${name} found a spot only ${n} times in ${spots.length * 3} tries`);
});

test('rail-level and long-lens cameras are not standing on another track', () => {
  W.CAM.vs = 20;
  for (const [e, s] of spots) {
    const T = W.fakeTrain(e, s);
    for (const name of ['rail', 'longlens']) {
      const st = W.SHOTS[name].pick(T); if (!st) continue;
      // the shot's own track is the nearest; any other must be farther off than a car is wide
      assert.ok(otherGap(st.p, nearestOn(st.p)) >= 3.2, `${name} camera next to another track at ${e.id}/${s}`);
    }
  }
});
/* the nearest track sample to p, taken as the shot's own track */
function nearestOn(p) {
  let best = null, d = Infinity;
  for (const e of W.NET.edges) for (let i = 0; i < e.n; i++) { const g = Math.hypot(e.X[i] - p.x, e.N[i] + p.z); if (g < d) { d = g; best = { x: e.X[i], z: -e.N[i] }; } }
  return best;
}
