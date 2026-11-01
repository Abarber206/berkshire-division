/* Birds: the ones on the pole line sit on the wires (nothing floating), the ones in the grass stand on the
   ground clear of the track, a train coming flushes them, the flocks stay well over the ground, and they all
   go at night. Builds the Ohio route, its pole line and the birds with the real three.js r128 (tests/vendor). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '04_world.js', '05_scenery.js', '05b_detail.js', '05c_wire.js', '10g_birds.js'];

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}

let W = null;
function world() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=ohio' },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    const scene = new THREE.Group();
    WORLD.custom = false; buildRoute(); buildLattice();
    buildStations(); buildBridge(scene); buildRoads(scene); buildSignals(scene); buildSigns(); buildPoleLine(scene);
    buildTrackHash(); sceneryBoxes(); buildBirds(scene);
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 5000);
    var GAME = { train: null }, SKY = { dark: 0 }, WX = { P: { rain: 0 } };
    const wires = [];
    scene.traverse(o => { if (o.isLineSegments) { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 6) wires.push(a.slice(i, i + 6)); } });
    const run = (sec, step = 1 / 30, each) => { for (let t = 0; t < sec; t += step) { if (each) each(t); birdsFrame(step, cam); } };
    ({ THREE, BIRDS, NET, FR, cam, run, wires, groundAt, distToTrack, riverDist, BIRD_SIT, setTrain: t => { GAME.train = t; }, setDark: d => { SKY.dark = d; } })`;
  return (W = vm.runInContext(code, ctx, { filename: 'berkshire-birds.js' }));
}

/* point the camera at the line from a spot beside a pole span */
function lookAtSpan(w, k) {
  const sp = w.BIRDS.spans[k], m = sp.a.p.clone().lerp(sp.b.p, 0.5);
  w.cam.position.set(m.x + 25, m.y + 6, m.z + 25); w.cam.lookAt(m); w.cam.updateMatrixWorld();
}
function segDist(w, p) {
  let best = Infinity;
  const A = new w.THREE.Vector3(), B = new w.THREE.Vector3(), L = new w.THREE.Line3(), q = new w.THREE.Vector3();
  for (const s of w.wires) {
    if (Math.abs(s[0] - p.x) > 30 || Math.abs(s[2] - p.z) > 30) continue;
    A.set(s[0], s[1], s[2]); B.set(s[3], s[4], s[5]); L.set(A, B); L.closestPointToPoint(p, true, q);
    best = Math.min(best, q.distanceTo(p));
  }
  return best;
}

test('birds perch on the pole line wires, touching them', () => {
  const w = world();
  assert.ok(w.BIRDS.spans.length > 500, 'pole spans recorded: ' + w.BIRDS.spans.length);
  let checked = 0;
  for (const k of [40, 300, 800, 1400]) {
    if (k >= w.BIRDS.spans.length) continue;
    lookAtSpan(w, k); w.run(3);
    for (const b of w.BIRDS.list) if (b.mode === 'perch') {
      const belly = b.p.clone(); belly.y -= w.BIRD_SIT * b.sc;
      const d = segDist(w, belly);
      assert.ok(d < 0.012, `perched bird ${d.toFixed(3)} m off the wire at ${belly.x.toFixed(1)}, ${belly.z.toFixed(1)}`);
      checked++;
    }
  }
  assert.ok(checked > 10, 'perched birds checked: ' + checked);
});

test('ground birds stand on the ground, clear of the track and out of the water', () => {
  const w = world();
  const spots = w.BIRDS.spots;
  assert.ok(spots && spots.length > 100, 'trackside spots: ' + (spots && spots.length));
  let n = 0;
  for (const sp of spots.slice(0, 400)) {
    assert.ok(w.distToTrack(sp.X, sp.N) >= 3.5);
    assert.ok(w.riverDist(sp.X, sp.N) >= 12);
  }
  for (const k of [100, 600, 1100]) {
    const sp = spots[k % spots.length];
    w.cam.position.set(sp.p.x + 200, sp.p.y + 40, sp.p.z); w.cam.lookAt(sp.p.x + 400, sp.p.y, sp.p.z);   // looking away, so they can come in
    w.run(2);
    for (const b of w.BIRDS.list) if (b.mode === 'ground') {
      const g = w.groundAt(b.p.x, -b.p.z);
      assert.ok(Math.abs(b.p.y - w.BIRD_SIT * b.sc - g) < 0.07, 'ground bird height off the ground by ' + (b.p.y - g).toFixed(3));
      assert.ok(w.distToTrack(b.p.x, -b.p.z) > 1.5, 'ground bird on the track');
      n++;
    }
  }
  assert.ok(n > 5, 'ground birds checked: ' + n);
});

test('a train coming flushes the birds by the track', () => {
  const w = world();
  // a spot with birds on it, and a one-car "train" running down the nearest edge toward it
  w.cam.position.set(0, 0, 0);
  let sp = null;
  for (const s of w.BIRDS.spots) {
    w.cam.position.set(s.p.x + 150, s.p.y + 40, s.p.z); w.cam.lookAt(s.p.x + 300, s.p.y, s.p.z);
    w.run(1.2);
    if (s.birds.length) { sp = s; break; }
  }
  assert.ok(sp, 'found a spot with birds');
  const birds = [...sp.birds];
  let edge = null, es = 0, bd = Infinity;
  for (const e of w.NET.edges) for (let s = 0; s <= e.len; s += 2) { const [X, N] = e.xz(s); const d = Math.hypot(X - sp.X, N - sp.N); if (d < bd) { bd = d; edge = e; es = s; } }
  const v = { pos: new w.THREE.Vector3() }, T = { vehicles: [v], length: 20 }; T.lead = v;
  const put = s => { edge.pose(Math.max(0, Math.min(edge.len, s)), w.FR); v.pos.copy(w.FR.p); };
  const dir = es > 150 ? -1 : 1;
  put(es - dir * 150); w.setTrain(T);
  let s = es - dir * 150;
  w.run(5, 1 / 30, () => { s += dir * 20 / 30; put(s); });
  for (const b of birds) assert.notEqual(b.mode, 'ground', 'a bird stayed on the ground with the train past');
  assert.equal(sp.birds.length, 0);
  assert.ok(birds.every(b => b.p.y > w.groundAt(b.p.x, -b.p.z) + 0.3 || b.mode === 'free' || b.mode === 'perch'), 'flushed birds took off');
  w.setTrain(null);
});

test('flocks stay well over the ground, and everyone goes at night', () => {
  const w = world();
  const sp = w.BIRDS.spans[500];
  w.cam.position.copy(sp.a.p).add(new w.THREE.Vector3(0, 3, 0)); w.cam.lookAt(sp.b.p);
  for (let k = 0; k < 6; k++) {
    w.run(5, 1 / 20);
    for (const b of w.BIRDS.list) if (b.mode === 'flock' && b.p.y > -1000) {
      const g = w.groundAt(b.p.x, -b.p.z);
      assert.ok(b.p.y > g + 18, 'flock bird only ' + (b.p.y - g).toFixed(1) + ' m up');
    }
  }
  w.setDark(1); w.run(35, 1 / 10);
  assert.equal(w.BIRDS.mesh.visible, false);
  assert.ok(w.BIRDS.list.every(b => b.mode === 'free' || b.mode === 'flock'));
  w.setDark(0); w.run(1);
  assert.equal(w.BIRDS.mesh.visible, true);
});
