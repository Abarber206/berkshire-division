/* High-speed trainset checks: traction, top speed, braking, regeneration and line speeds. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

const between = (x, lo, hi, what) => assert.ok(x >= lo && x <= hi, `${what}: ${x.toFixed(2)} not in [${lo}, ${hi}]`);
const KMH = 1 / 3.6;

/* run with full power from a stand, recording when each speed (km/h) is first reached */
function accel(key, seconds, marks = []) {
  const sim = h.load(), T = h.trainset(sim, key), S = sim.S;
  Object.assign(S, { throttle: 1, reverser: 1 });
  const at = {}; let vmax = 0;
  h.run(sim, T, seconds, () => { const k = S.v / KMH; vmax = Math.max(vmax, k); for (const m of marks) if (at[m] === undefined && k >= m) at[m] = S.time; });
  return { sim, T, S, at, vmax };
}
/* distance to stop from v0 km/h with the given brake handle and regen lever */
function stop(key, v0, brakeH, dyn = 0) {
  const sim = h.load(), T = h.trainset(sim, key), S = sim.S;
  Object.assign(S, { throttle: 0, reverser: 1, v: v0 * KMH, brakeH, dyn });
  let d = 0, minKW = 0;
  for (let t = 0; S.v > 0.3 && t < 600; t += 1 / 30) { S.time += 1 / 30; d += sim.physicsStep(1 / 30, T); minKW = Math.min(minKW, S.kW); }
  return { d, S, minKW };
}

test('the E5 starts at about 1.7 km/h/s, like the real Hayabusa', () => {
  const { at } = accel('e5', 120, [100]);
  between(at[100], 45, 70, 'seconds to 100 km/h');
});

test('the E5 runs up to 320 km/h and its governor holds it there', () => {
  const { at, vmax } = accel('e5', 900, [300]);
  assert.ok(at[300] < 360, `300 km/h should come within 6 minutes (took ${at[300]})`);
  between(vmax, 310, 321, 'top speed (km/h)');
});

test('the Acela reaches its 150 mph service speed and no more', () => {
  const { sim, vmax } = accel('acela', 900);
  between(vmax * KMH / sim.MPH, 145, 150.5, 'top speed (mph)');
});

test('an emergency application stops either trainset from 200 km/h inside 2 km', () => {
  for (const key of ['e5', 'acela']) between(stop(key, 200, 1).d, 1200, 2000, `${key} emergency stop (m)`);
});

test('regenerative braking alone slows the E5 and feeds power back to the line', () => {
  const { S, minKW } = stop('e5', 200, 0.12, 1);
  assert.ok(S.v < 1, 'regen should bring the train nearly to a stand');
  assert.ok(minKW < -1000, `the motors should return well over a megawatt (${minKW.toFixed(0)} kW)`);
});

test('with the pantograph down there is no traction', () => {
  const sim = h.load(), T = h.trainset(sim, 'e5'), S = sim.S;
  Object.assign(S, { throttle: 1, reverser: 1, panUp: false });
  h.run(sim, T, 20);
  assert.ok(S.v < 0.2, `train should not move without the wire (${S.v.toFixed(2)} m/s)`);
});

test('line speed: own top speed on main tangents, 1.5 m/s² lateral on curves, posted limits elsewhere', () => {
  const sim = h.load(), e5 = sim.LOCO_SPEC.e5, acela = sim.LOCO_SPEC.acela;
  const tp = (kind, limit, k) => ({ e: { kind, limit, curv: () => k }, s: 0 });
  assert.equal(sim.hsLimit(tp('main', 70, 0), e5), 195);
  assert.equal(sim.hsLimit(tp('main', 70, 0), acela), 150);
  assert.equal(sim.hsLimit(tp('main', 70, 1 / 1200), e5), 90);    // sqrt(1.5 x 1200) = 42.4 m/s = 94.9 mph
  assert.equal(sim.hsLimit(tp('main', 30, 0), e5), 30);           // crossovers keep their own limit
  assert.equal(sim.hsLimit(tp('yard', 15, 0), e5), 15);
});
