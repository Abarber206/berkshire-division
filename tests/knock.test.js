/* Trains knocking each other about (WreckSim.stepAll in src/07d_wreck.js, glue in src/07e_knock.js), on the wreck
   rig (tests/wreckrig.js): a train that runs into another hands it momentum through the cars that meet, those cars
   are knocked off their rails and thrown about, the train behind them is shoved along its track, and nothing is
   flung, sunk or left twitching. A gentle bump just shares the speed, the way a buff does. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadWreck, makeTrain, runKnock, PASSENGER, FREIGHT, THREE_JS } = require('./wreckrig.js');
const MPH = 0.44704;
const LOCO = [['loco', 30, 200000], ['tender', 30, 170000]];
const CUT = Array.from({ length: 6 }, (_, i) => ['car', 17, i % 2 ? 30000 : 60000]);
const len = kinds => kinds.reduce((a, k) => a + k[1], 0);

/* train A at mph runs into B (standing at its rear, or head on at vB mph) */
function knock(A, mph, B, vB = 0, headOn = false) {
  const W = loadWreck();
  const P = makeTrain(W, A, 0, { x: 0 });
  const Q = headOn ? makeTrain(W, B, 0, { x: 0.05, dir: -1 }) : makeTrain(W, B, 0, { x: 0.05 + len(B) });
  const L = [{ T: P, v: mph * MPH }, { T: Q, v: vB * MPH }];
  let maxSp = 0, maxLift = 0, minLo = 0;
  const r = runKnock(W, L, 40, () => {
    for (const o of L) for (const b of o.R.bodies) {
      maxSp = Math.max(maxSp, b.lv.length());
      let lo = Infinity;
      for (const s of b.pts) { const p = s.clone().applyQuaternion(b.q).add(b.p); lo = Math.min(lo, p.y - o.R.ground(b, p)); }
      maxLift = Math.max(maxLift, lo); minLo = Math.min(minLo, lo);
    }
  });
  const off = o => o.R.bodies.filter(b => !b.truck);
  return { W, L, t: r.t, maxSp, maxLift, minLo, P: L[0], Q: L[1], offP: off(L[0]), offQ: off(L[1]), settled: L.every(o => o.R.asleep) };
}
const skip = t => !fs.existsSync(THREE_JS) && (t.skip('tests/vendor/three.min.js missing'), true);
const sane = (r, v) => {
  assert.ok(r.maxSp < v + 6, `fastest body ${r.maxSp.toFixed(1)} m/s from a ${v.toFixed(1)} m/s closing speed`);
  assert.ok(r.maxLift < 3, `a car's lowest point rose ${r.maxLift.toFixed(1)} m off the ground`);
  assert.ok(r.minLo > -0.3, `a car sank ${(-r.minLo).toFixed(2)} m into the ground`);
  assert.ok(r.settled, `still moving after ${r.t.toFixed(0)} s`);
  assert.ok(r.t < 30, `took ${r.t.toFixed(0)} s to settle`);
};

test('a passenger train at 40 mph into a standing freight knocks its rear cars off and shoves it along', (t) => {
  if (skip(t)) return;
  const r = knock(PASSENGER, 40, FREIGHT);
  sane(r, 40 * MPH);
  assert.ok(r.offQ.length >= 2, `${r.offQ.length} of the freight's cars came off`);
  assert.ok(r.offQ.some(b => b.i === FREIGHT.length - 1), 'the car that was hit is one of them');
  assert.ok(r.Q.T.x - r.Q.x0 > 2, `the freight was shoved only ${(r.Q.T.x - r.Q.x0).toFixed(1)} m`);
  assert.ok(r.offP.length >= 1, 'the train that hit it comes off too');
  // the cars knocked off go where the hit sent them: ahead, not back through the train that hit them
  const rearMost = Math.min(...r.offQ.map(b => b.p.x));
  assert.ok(rearMost > -10, `a freight car ended up ${(-rearMost).toFixed(0)} m back inside the passenger train`);
});

test('an engine at 20 mph into a cut of cars knocks the cars about and shoves the rest along', (t) => {
  if (skip(t)) return;
  const r = knock(LOCO, 20, CUT);
  sane(r, 20 * MPH);
  assert.ok(r.offQ.length >= 2, `${r.offQ.length} cars came off`);
  assert.ok(r.Q.T.x - r.Q.x0 > 1, `the cut was shoved only ${(r.Q.T.x - r.Q.x0).toFixed(1)} m`);
});

test('head on, 40 mph into 20 mph: both trains come off and pile up, nothing flung', (t) => {
  if (skip(t)) return;
  const r = knock(PASSENGER, 40, FREIGHT, 20, true);
  sane(r, 60 * MPH);
  assert.ok(r.offP.length >= 3 && r.offQ.length >= 3, `${r.offP.length} and ${r.offQ.length} cars came off`);
});

test('a gentle bump (4 mph) puts nothing on the ground and shares the speed, momentum kept', (t) => {
  if (skip(t)) return;
  const W = loadWreck();
  const P = makeTrain(W, LOCO, 0, { x: 0 }), Q = makeTrain(W, CUT, 0, { x: 0.05 + len(CUT) });
  const L = [{ T: P, v: 4 * MPH }, { T: Q, v: 0 }];
  let first = null;
  runKnock(W, L, 0.25, (tt, L) => { if (!first && L[1].kin.v > 0.1) first = { p: L[0].kin.v * L[0].kin.mass + L[1].kin.v * L[1].kin.mass, t: tt }; });
  assert.equal(L[0].R.bodies.length + L[1].R.bodies.length, 0, 'nothing came off');
  assert.ok(first, 'the cut was set moving');
  const m0 = 370000 * 4 * MPH, lost = (370000 + 270000) * 1.3 * first.t;   // less what the emergency brakes took meanwhile
  assert.ok(Math.abs(first.p - m0) < lost + 0.02 * m0, `momentum ${first.p.toFixed(0)} from ${m0.toFixed(0)}`);
  assert.ok(L[1].kin.v > L[0].kin.v - 0.05, 'the cut ends up going at least as fast as the engine behind it');
});

test('a pile at rest is woken when another train runs into it', (t) => {
  if (skip(t)) return;
  const W = loadWreck();
  const P = makeTrain(W, LOCO, 0, { x: 0 }), Q = makeTrain(W, CUT, 0, { x: 30 + len(CUT) });
  const L = [{ T: P, v: 25 * MPH }, { T: Q, v: 0 }];
  let wokeQ = false, wasAsleep = false;
  runKnock(W, L, 30, (tt, L) => { if (L[1].R.asleep) wasAsleep = true; else if (wasAsleep) wokeQ = true; });
  assert.ok(wasAsleep, 'the standing cut was asleep before the engine got there');
  assert.ok(wokeQ, 'and woke when it was hit');
  assert.ok(L[1].R.bodies.length >= 1, 'its cars came off');
});

test("another player's train (fixed) is not shoved from here, but its cars still come off where rammed", (t) => {
  if (skip(t)) return;
  const W = loadWreck();
  const P = makeTrain(W, LOCO, 0, { x: 0 }), Q = makeTrain(W, CUT, 0, { x: 0.05 + len(CUT) });
  const L = [{ T: P, v: 20 * MPH }, { T: Q, v: 0 }];
  const step = W.WreckSim.stepAll;
  W.WreckSim.stepAll = function (sims, dt, clk) { L[1].R.fixed = true; L[1].kin.mass = 0; return step.call(this, sims, dt, clk); };
  runKnock(W, L, 10);
  assert.ok(Math.abs(L[1].T.x - L[1].x0) < 1e-6, 'their train stays where they say it is');
  assert.ok(L[1].R.bodies.length >= 1, 'the car that was hit comes off on our screen');
});
