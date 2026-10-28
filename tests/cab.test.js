/* Cab controls: the levers in the cab and on the HUD share CTL, so both land on the same notches and detents.
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
function sim(diesel) { const s = h.load(); s.GAME.isDiesel = () => diesel; s.GAME.controlTouched = () => {}; return s; }

test('every control comes back to where it was put, steam and diesel', () => {
  for (const diesel of [false, true]) {
    const s = sim(diesel);
    for (const [k, vals] of Object.entries({ throttle: [0, 0.25, 0.5, 1], reverser: [-1, 0, 1], dyn: [0, 0.5, 1], brake: [0, 0.12, 0.23, 0.6, 1], ind: [0, 0.5, 1] })) {
      const c = s.CTL[k];
      for (const v of vals) {
        c.set(v);
        for (const inv of [false, true]) {
          const p = s.ctlTravel(c, inv); s.ctlSetTravel(c, inv, p);
          near(c.get(), v, 1e-9);
        }
      }
    }
  }
});

test('the diesel throttle stops on its eight notches, the Berkshire throttle runs smooth', () => {
  const d = sim(true);
  d.ctlSetTravel(d.CTL.throttle, true, 0.43);                  // the cab lever pulled 43% of its swing
  near(d.S.throttle, 3 / 8);
  assert.equal(d.CTL.throttle.label(d.S.throttle), 'N3');
  d.ctlSetTravel(d.CTL.throttle, true, 1);
  assert.equal(d.CTL.throttle.label(d.S.throttle), 'N8');
  const st = sim(false);
  st.ctlSetTravel(st.CTL.throttle, true, 0.43);
  near(st.S.throttle, 0.43);
  assert.equal(st.CTL.throttle.label(st.S.throttle), '43%');
});

test('the reverser: diesel has three positions, the Berkshire notches in 17ths with a dead centre', () => {
  const d = sim(true);
  for (const [p, v] of [[0, 1], [0.3, 1], [0.5, 0], [0.7, -1], [1, -1]]) { d.ctlSetTravel(d.CTL.reverser, false, p); assert.equal(d.S.reverser, v); }
  const st = sim(false);
  st.ctlSetTravel(st.CTL.reverser, false, 0.49); assert.equal(st.S.reverser, 0);
  st.ctlSetTravel(st.CTL.reverser, false, 0.2); near(st.S.reverser * 17, Math.round(st.S.reverser * 17));
  assert.ok(st.S.reverser > 0.5);
  assert.equal(st.CTL.reverser.label(1), 'F 85%');
});

test('the automatic brake handle drops into running and lap', () => {
  const s = sim(false);
  s.ctlSetTravel(s.CTL.brake, false, 0.14); assert.equal(s.S.brakeH, 0.12);
  assert.equal(s.brakeZone(s.S.brakeH), 'RUN');
  s.ctlSetTravel(s.CTL.brake, false, 0.21); assert.equal(s.S.brakeH, 0.23);
  assert.equal(s.brakeZone(s.S.brakeH), 'LAP');
  s.ctlSetTravel(s.CTL.brake, false, 1); assert.equal(s.brakeZone(s.S.brakeH), 'EMG');
});

test('whistle cord and horn: a pull opens them from a gentle 25% to wide open', () => {
  const s = sim(false);
  near(s.pullToWhistle(0), 0.25); near(s.pullToWhistle(1), 1); near(s.pullToWhistle(2), 1);
  for (const w of [0.25, 0.62, 1]) near(s.pullToWhistle(s.whistleToPull(w)), w);
});

test('gauge needles sweep 270 degrees clockwise and stop at the pins', () => {
  const s = sim(false);
  const a0 = s.dialAngle(0, 300), a1 = s.dialAngle(300, 300);
  near(a0 - a1, Math.PI * 1.5);                                 // full sweep, turning clockwise (negative)
  near(s.dialAngle(-20, 300), a0); near(s.dialAngle(400, 300), a1);
  assert.ok(s.dialAngle(150, 300) < a0 && s.dialAngle(150, 300) > a1);
  // every dial's scale has a needle that can reach full scale
  for (const k in s.DIALS) assert.ok(s.DIALS[k].max > 0 && s.DIALS[k].major > 0);
});

test('the water glass shows what the HUD shows, and stays inside the glass', () => {
  const s = sim(false);
  near(s.glassLevel(-0.1), 0); near(s.glassLevel(1.1), 1); near(s.glassLevel(-1), 0); near(s.glassLevel(2), 1);
  near(s.glassLevel(0.62), 0.6);
});

test('a tap on the stoker valve steps it open a quarter at a time, then shuts it', () => {
  const s = sim(false);
  const seen = []; let v = 0;
  for (let i = 0; i < 6; i++) { v = s.stokerNext(v); seen.push(v); }
  assert.deepEqual(seen, [0.25, 0.5, 0.75, 1, 0, 0.25]);
  near(s.stokerNext(0.45), 0.75);   // the fireman left it at 45%: next stop up is 75%
});

test('pointing at a gauge reads it out', () => {
  const s = sim(false);
  Object.assign(s.S, { P: 238.4, Psc: 120.2, MR: 140, ER: 90, BCloco: 0, v: 10 * s.MPH, W: 0.62 });
  assert.equal(s.CAB_READ.boiler(), 'Boiler pressure · 238 psi');
  assert.equal(s.CAB_READ.speed(), 'Speed · 10 mph');
  assert.equal(s.CAB_READ.mreq(), 'Main reservoir 140 · equalizing 90 psi');
  assert.equal(s.CAB_READ.glass(), 'Water glass · 60%');
});
