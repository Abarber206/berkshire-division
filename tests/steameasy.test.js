/* Easy steam: the reverser hooks up on its own, the fireman never lets the boiler go dry, and greasy rail slips the drivers. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

const between = (x, lo, hi, what) => assert.ok(x >= lo && x <= hi, `${what}: ${x.toFixed(2)} not in [${lo}, ${hi}]`);

function flatOut(mode, cars, car, seconds, opt = {}) {
  const sim = h.load(), T = h.train(sim, cars, { car, ...opt }), S = sim.S;
  sim.applyFireSetting(mode);
  Object.assign(S, { throttle: 1, reverser: 1, indH: 0, brakeH: 0.12, ...(opt.S || {}) });
  let minP = Infinity, minW = Infinity;
  h.run(sim, T, seconds, (s, t) => { if (t > 5) { minP = Math.min(minP, S.P); minW = Math.min(minW, S.W); } });
  return { sim, S, minP, minW };
}

test('Easy: reverser and throttle wide open, the passenger train keeps steam and runs up past 65 mph', () => {
  const { sim, S, minP, minW } = flatOut('easy', 8, 'coach', 600);
  between(minP, 190, 250, 'lowest boiler pressure (psi)');
  between(minW, 0.3, 1, 'lowest water');
  between(S.v / sim.MPH, 65, 90, 'speed after 10 minutes (mph)');
  between(S.cut, 0.15, 0.35, 'hooked-up cutoff');
  assert.equal(S.cocks, false, 'cylinder cocks shut once rolling');
  assert.ok(sim.log.events.includes('cocksShut'));
  assert.deepEqual(sim.log.fails, []);
});

test('Easy: 36 freight cars wide open hold over 220 psi', () => {
  const { sim, S, minP } = flatOut('easy', 36, 'box', 600);
  between(minP, 220, 250, 'lowest boiler pressure (psi)');
  between(S.v / sim.MPH, 35, 60, 'speed after 10 minutes (mph)');
});

test('Easy still lets you run a shorter cutoff than the automatic one', () => {
  const { S } = flatOut('easy', 8, 'coach', 20, { S: { reverser: 0.25 } });
  between(S.cut, 0.2, 0.22, 'cutoff follows the shorter reverser');
});

test('Fireman only: leaving the reverser down drains the pressure and says so, but the fireman never drops the plug', () => {
  const { sim, minP, minW } = flatOut('auto', 8, 'coach', 900);
  assert.ok(minP < 120, `pressure should sag with full cutoff (${minP.toFixed(0)})`);
  assert.ok(sim.log.events.includes('lowSteam'), 'a hint to hook up');
  between(minW, 0.2, 1, 'lowest water');
  assert.deepEqual(sim.log.fails, []);
});

test('the rail has greasy patches, clean at the start of the line', () => {
  const sim = h.load();
  assert.equal(sim.railPatch(0), 0);
  let on = 0, max = 0;
  for (let x = 0; x < 20000; x++) { const p = sim.railPatch(x); if (p > 0.3) on++; max = Math.max(max, p); }
  between(on / 20000, 0.1, 0.35, 'share of the line greasy');
  assert.ok(max > 0.95);
});

test('starting a heavy train on a greasy patch slips the drivers, and the sander holds them', () => {
  const sim = h.load();
  let x = 0; while (sim.railPatch(x) < 0.99) x++;
  const a = flatOut('easy', 36, 'box', 6, { S: { odo: x } });
  assert.ok(a.sim.log.events.includes('slip'), 'should slip without sand');
  const b = flatOut('easy', 36, 'box', 6, { S: { odo: x, sander: true } });
  assert.ok(!b.sim.log.events.includes('slip'), 'sand should hold the drivers');
});
