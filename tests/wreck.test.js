/* Wreck physics (src/07d_wreck.js) on a test train (tests/wreckrig.js): nothing is ever thrown faster than the
   train was going or up into the air, nothing sinks into the ground, the pile comes to rest, couplers hold in a
   slow derailment, and a fast freight wreck folds up the way real ones do (cars across the track, some on their side). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadWreck, makeTrain, runWreck, PASSENGER, FREIGHT, THREE_JS } = require('./wreckrig.js');
const MPH = 0.44704;

function wreck(kinds, mph, spec, gap) {
  const W = loadWreck(), T = makeTrain(W, kinds, gap);
  let maxSp = 0, maxLift = 0, minLo = 0;
  const { R, out } = runWreck(W, T, mph * MPH, 40, spec, st => {
    for (const b of st.bodies) { maxSp = Math.max(maxSp, b.sp); maxLift = Math.max(maxLift, b.lo); minLo = Math.min(minLo, b.lo); }
  });
  const last = out[out.length - 1];
  const yaw = R.bodies.map(b => { const a = Math.abs(Math.atan2(-b.ax[0].z, b.ax[0].x)) * 180 / Math.PI; return Math.min(a, 180 - a); });
  return { R, T, last, maxSp, maxLift, minLo, yaw, onSide: R.bodies.filter(b => b.ax[1].y < 0.5).length };
}

for (const [name, kinds] of [['passenger', PASSENGER], ['freight', FREIGHT]]) for (const mph of [25, 45, 70]) for (const hit of [false, true]) {
  test(`${name} ${mph} mph ${hit ? 'collision' : 'derailment'}: no launch, no sinking, comes to rest`, (t) => {
    if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
    const r = wreck(kinds, mph, { hit });
    // the throw off the rails adds a few m/s sideways at most; nothing gains speed from the contacts
    assert.ok(r.maxSp < mph * MPH + 5, `fastest body ${r.maxSp.toFixed(1)} m/s from ${(mph * MPH).toFixed(1)}`);
    assert.ok(r.maxLift < 3, `a car's lowest point rose ${r.maxLift.toFixed(1)} m off the ground`);
    assert.ok(r.minLo > -0.3, `a car sank ${(-r.minLo).toFixed(2)} m into the ground`);
    assert.ok(r.last.asleep, `still moving after ${r.last.t.toFixed(0)} s`);
    assert.ok(r.last.t < 30, `took ${r.last.t.toFixed(0)} s to settle`);
  });
}

test('a 25 mph passenger derailment keeps its couplers and stays near the track', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  const r = wreck(PASSENGER, 25, {});
  assert.equal(r.R.broken.size, 0);
  for (const b of r.R.bodies) assert.ok(Math.abs(b.p.z) < 4, `car ${b.i} ended ${b.p.z.toFixed(1)} m off the line`);
});

test('the engine coming off pulls its tender off with it instead of snapping the drawbar', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  for (const mph of [25, 45]) {
    const r = wreck(PASSENGER, mph, {});
    assert.ok(!r.R.broken.has(0), `${mph} mph: engine-tender coupler broke`);
    assert.ok(r.T.vehicles[1].rb, `${mph} mph: tender stayed on the rails`);
  }
});

test('a 70 mph freight wreck folds up: cars across the track, couplers torn, some on their side', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  const r = wreck(FREIGHT, 70, {});
  assert.ok(r.yaw.filter(a => a > 45).length >= 4, `only ${r.yaw.filter(a => a > 45).length} cars turned across: ${r.yaw.map(a => a.toFixed(0))}`);
  assert.ok(r.R.broken.size >= 3, `${r.R.broken.size} couplers broke`);
  assert.ok(r.onSide >= 1, 'no car rolled over');
});

test('coupler faces left a little apart or overlapping on the track do not fling the cars apart', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  for (const gap of [0.12, -0.12]) {
    const r = wreck(PASSENGER, 25, {}, gap);
    assert.equal(r.R.broken.size, 0, `gap ${gap}: ${r.R.broken.size} couplers broke`);
    assert.ok(r.maxSp < 25 * MPH + 2, `gap ${gap}: a car reached ${r.maxSp.toFixed(1)} m/s`);
  }
});

test('trucks: stay under a slow derailment, get knocked loose in a fast one, and never sink into the ground', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  const slow = wreck(PASSENGER, 25, {});
  assert.equal(slow.R.bodies.filter(b => b.truck).length, 0, 'trucks came loose at 25 mph');
  const fast = wreck(FREIGHT, 70, {});
  const loose = fast.R.bodies.filter(b => b.truck);
  assert.ok(loose.length >= 4, `only ${loose.length} trucks came loose at 70 mph`);
  for (const b of loose) {
    let lo = Infinity; for (const s of b.pts) { const P = s.clone().applyQuaternion(b.q).add(b.p); lo = Math.min(lo, P.y - fast.R.ground(b, P)); }
    assert.ok(lo > -0.15 && lo < 1.5, `a loose truck ended ${lo.toFixed(2)} m from the ground`);
  }
  assert.ok(fast.minLo > -0.3, `something sank ${(-fast.minLo).toFixed(2)} m`);
});

test('a fast collision dents the cars that hit, never deeper than DENT_MAX', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  const r = wreck(FREIGHT, 70, { hit: true });
  const dents = r.R.bodies.flatMap(b => b.dents || []);
  assert.ok(dents.length >= 5, `${dents.length} dents`);
  for (const d of dents) assert.ok(d.d > 0 && d.d <= 0.4 + 1e-9, `dent ${d.d}`);
});
