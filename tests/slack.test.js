/* Slack action (src/08b_slack.js): the slack runs out car by car when a train starts and in when the head end
   brakes first, the forces stay what a real train sees, and a knuckle pulled past its strength parts the train
   and puts both halves into emergency. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness.js');
const KLBF = 4448.2;

function freight(n, loco = '765', st = {}) {
  const sim = H.load(), T = H.train(sim, n, { loco }), S = sim.S;
  Object.assign(S, { cocks: false, reverser: 1, brakeH: 0.12, indH: 0, throttle: 0 }, st);
  return { sim, T, S };
}
function watch(sim, T, secs) {
  let maxT = 0, minT = 0, maxX = 0;
  H.run(sim, T, secs, () => { const s = T.slk; maxT = Math.max(maxT, s.maxT); minT = Math.min(minT, s.minT); for (const x of s.x) maxX = Math.max(maxX, Math.abs(x)); return false; });
  return { maxT, minT, maxX };
}
const clunks = sim => sim.log.sounds.filter(s => s[0] === 'clunk').length;

test('starting a freight takes the slack out one car at a time, with a bang at each', () => {
  const { sim, T, S } = freight(25);
  S.throttle = 1;
  const r = watch(sim, T, 10);
  assert.ok(S.v > 0.1, 'the train never moved');
  assert.ok(clunks(sim) >= 20, `only ${clunks(sim)} bangs for 25 joints`);
  assert.ok(r.maxT > 30 * KLBF && r.maxT < 200 * KLBF, `drawbar pull ${(r.maxT / KLBF).toFixed(0)} klbf`);
  assert.equal(T.vehicles.length, 27);
});

test('a service application from the head end runs the slack in, and nothing breaks', () => {
  const { sim, T, S } = freight(60, '765', { v: 20 });
  H.run(sim, T, 1);
  S.brakeH = 0.5;
  const r = watch(sim, T, 20);
  assert.ok(r.minT < -40 * KLBF, `buff force only ${(r.minT / KLBF).toFixed(0)} klbf`);
  assert.ok(r.maxT < 200 * KLBF, `pulled ${(r.maxT / KLBF).toFixed(0)} klbf while braking`);
  assert.ok(r.maxX < 60 * 0.04, `a car ran ${r.maxX.toFixed(2)} m from its place, more than all the slack there is`);
  assert.equal(T.vehicles.length, 62);
});

test('a hundred-car drag bunched up and then given full throttle pulls hard but holds together', () => {
  const { sim, T, S } = freight(100, '4014', { v: 6 });
  S.indH = 1; H.run(sim, T, 10);
  S.indH = 0; S.throttle = 1;
  const r = watch(sim, T, 20);
  assert.ok(r.maxT > 150 * KLBF, `only ${(r.maxT / KLBF).toFixed(0)} klbf from a slack run-out`);
  assert.equal(T.vehicles.length, 102, 'a knuckle broke');
});

test('passenger cars on tight-lock couplers barely move against each other', () => {
  const { sim, T, S } = freight(12, '765', { v: 30 });
  for (let i = 2; i < T.vehicles.length; i++) T.vehicles[i].kind = 'coach';
  H.run(sim, T, 1);
  S.brakeH = 0.95;
  const r = watch(sim, T, 15);
  assert.ok(r.maxX < 0.2, `a coach moved ${r.maxX.toFixed(2)} m`);
});

test('a knuckle pulled past its strength breaks: the train parts and both halves go into emergency', () => {
  const { sim, T, S } = freight(25);
  const brk = sim.SLK.BREAK;
  sim.SLK.BREAK = 40 * KLBF;
  try {
    S.throttle = 1;
    H.run(sim, T, 10, () => T.vehicles.length < 27);
  } finally { sim.SLK.BREAK = brk; }
  assert.ok(T.vehicles.length < 27, 'the train held together');
  assert.ok(S.brakeH >= 0.95, 'the train did not go into emergency');
  assert.ok(T.vehicles.every(v => v.brake.emerg), 'a car on the engine side kept its brakes off');
  const cut = sim.CARS.cuts[sim.CARS.cuts.length - 1];
  assert.ok(cut && cut.vehicles.every(v => v.brake.emerg), 'the cars that came loose kept their brakes off');
  assert.equal(T.vehicles.length + cut.vehicles.length, 27);
  assert.ok(sim.log.toasts.some(t => /knuckle broke/.test(t.msg)));
});
