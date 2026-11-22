/* The guided first run (src/11n_tutor.js): the lesson has the right steps for steam and diesel, each step sees
   the control it teaches, the card moves on by itself once a step is done, the fire goes back to how the player
   had it, and the three cars it couples to stand clear of the switches on Yard 2.
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('./harness');

/* a sim with the bits of the page the lesson touches */
function lesson(diesel) {
  const sim = h.load();
  sim.ctx.document.querySelectorAll = () => [];
  sim.GAME.isDiesel = () => !!diesel;
  sim.GAME.notches = () => 8;
  sim.GAME.settings = { fire: 'easy', job: '', loco: '765', consist: 'passenger' };
  sim.ctx.carPanelToggle = () => {};
  sim.ctx.PLAY_LAYOUT = null;
  sim.applyFireSetting('easy');
  return sim;
}
const power = () => ({ kind: 'loco', brake: { AR: 90 } });
const car = AR => ({ kind: 'box', brake: { AR } });
function fakeTrain(sim, cars, onMain) {
  const main = {}, yard = {};
  sim.ctx.ROUTE = { main: { edges: [main] } };
  return { diesel: false, vehicles: [power(), { kind: 'tender', brake: { AR: 90 } }, ...cars], frontTP: () => ({ e: onMain ? main : yard }) };
}
const step = (sim, id) => sim.TUT_STEPS.find(s => s.id === id);

test('steam gets the fire and the water, a diesel gets notches and the dynamic brake, and the rest is shared', () => {
  const sim = lesson();
  const steam = Array.from(sim.TUT.steps('steam'), s => s.id), diesel = Array.from(sim.TUT.steps('diesel'), s => s.id);
  for (const id of ['boiler', 'fire', 'inject', 'fireBack']) { assert.ok(steam.includes(id), id); assert.ok(!diesel.includes(id), id); }
  for (const id of ['notch', 'dyn']) { assert.ok(diesel.includes(id), id); assert.ok(!steam.includes(id), id); }
  for (const id of ['indep', 'revBack', 'couple', 'air', 'out', 'speed', 'service', 'release']) { assert.ok(steam.includes(id) && diesel.includes(id), id); }
  assert.equal(new Set(sim.TUT_STEPS.map(s => s.id)).size, sim.TUT_STEPS.length, 'step ids are unique');
  // the order a train is really worked in: couple before charging the air, air before heading out, brake before release
  for (const [a, b] of [['revBack', 'couple'], ['couple', 'air'], ['air', 'out'], ['speed', 'service'], ['service', 'release']]) assert.ok(steam.indexOf(a) < steam.indexOf(b), `${a} before ${b}`);
});

test('every step reads properly for both kinds of engine', () => {
  for (const diesel of [false, true]) {
    const sim = lesson(diesel), T = fakeTrain(sim, [car(90)]);
    for (const st of sim.TUT.steps(diesel ? 'diesel' : 'steam')) {
      assert.ok(st.title && st.title.length < 40, `${st.id}: short title`);
      const body = st.body(T, {});
      assert.ok(body.length > 40 && !/undefined|NaN/.test(body), `${st.id}: body reads`);
      if (st.meter) { const m = st.meter(T, {}); assert.ok(m.max > 0 && typeof m.txt === 'string', `${st.id}: meter`); }
    }
  }
});

test('each step sees the control it teaches', () => {
  const sim = lesson(), S = sim.S, T = fakeTrain(sim, []);
  const done = (id, R = {}) => step(sim, id).done(T, R);
  S.indH = 0.6; assert.ok(!done('indep')); S.indH = 0; assert.ok(done('indep'));
  S.brakeH = 0.5; assert.ok(!done('train')); S.brakeH = 0.12; assert.ok(done('train'));
  S.reverser = 0; assert.ok(!done('revBack')); S.reverser = -0.6; assert.ok(done('revBack'));
  S.throttle = 0.1; S.v = -2; assert.ok(done('throttleBack'));
  S.v = 0; S.throttle = 0; assert.ok(done('stop1'));
  // coupled when the train has more cars than it started the step with
  const R = { cars0: 0 }; assert.ok(!done('couple', R)); T.vehicles.push(car(0)); assert.ok(done('couple', R));
  // the air: every car charged to 62 psi or more
  assert.ok(!done('air')); T.vehicles[2].brake.AR = 70; assert.ok(done('air'));
  S.reverser = 0.6; S.indH = 0; S.brakeH = 0.12; assert.ok(done('revFwd'));
  S.brakeH = 0.5; assert.ok(!done('revFwd'), 'not with the train brake set');
  const off = fakeTrain(sim, [], false), on = fakeTrain(sim, [], true);
  assert.ok(!step(sim, 'out').done(off, {})); assert.ok(step(sim, 'out').done(on, {}));
  S.v = 24 * sim.MPH; assert.ok(!done('speed')); S.v = 25.5 * sim.MPH; assert.ok(done('speed'));
  S.throttle = 0; S.brakeH = 0.5; assert.ok(done('service'));
  S.v = 0; S.brakeH = 0.12; S.indH = 0.6; assert.ok(done('release'));
  // the fire: taking the stoker hands it over (autoFire off), then the injector
  assert.ok(!done('fire')); sim.applyFireSetting('hand'); assert.ok(done('fire'));
  S.injector = false; assert.ok(!done('inject')); S.injector = true; assert.ok(done('inject'));
});

test('a diesel step sees the notches and the dynamic brake', () => {
  const sim = lesson(true), S = sim.S, T = fakeTrain(sim, []);
  S.reverser = -1; assert.ok(step(sim, 'revBack').done(T, {}));
  S.reverser = 1; S.indH = 0; S.brakeH = 0.12; assert.ok(step(sim, 'revFwd').done(T, {}));
  S.throttle = 3 / 8; assert.ok(!step(sim, 'notch').done(T, {})); S.throttle = 4 / 8; assert.ok(step(sim, 'notch').done(T, {}));
  S.throttle = 0; S.dyn = 0.3; assert.ok(step(sim, 'dyn').done(T, {}));
});

test('the card moves on by itself a moment after a step is done, and Next ends the lesson at the last step', () => {
  const sim = lesson(), S = sim.S, TUT = sim.TUT;
  sim.GAME.train = fakeTrain(sim, []);
  TUT.run = { i: 0, steps: TUT.steps('steam'), fire0: 'easy', cars0: 0, okT: 0, blew: false };
  TUT.enter();
  // 'hello' is read and dismissed: it never moves on by itself
  for (let k = 0; k < 30; k++) TUT.tick(0.1);
  assert.equal(TUT.step().id, 'hello');
  TUT.next(); assert.equal(TUT.step().id, 'indep');
  S.indH = 0.6; for (let k = 0; k < 10; k++) TUT.tick(0.1);
  assert.equal(TUT.step().id, 'indep', 'not done yet');
  S.indH = 0; for (let k = 0; k < 4; k++) TUT.tick(0.1);
  assert.equal(TUT.step().id, 'indep', 'holds the tick a moment so you see it');
  for (let k = 0; k < 10; k++) TUT.tick(0.1);
  assert.equal(TUT.step().id, 'train');
  // a tap on the whistle shorter than a check still counts
  TUT.run.i = TUT.run.steps.findIndex(s => s.id === 'bell'); TUT.enter();
  S.bell = true; S.whistle = 0.7; TUT.tick(0.02); S.whistle = 0;
  for (let k = 0; k < 15; k++) TUT.tick(0.1);
  assert.equal(TUT.step().id, 'revBack');
  // to the end
  TUT.run.i = TUT.run.steps.length - 1; TUT.next();
  assert.ok(TUT.run.over, 'lesson complete');
});

test('the fire goes back to how the player had it once the fire steps are over', () => {
  const sim = lesson(), TUT = sim.TUT;
  sim.ctx.document.getElementById = () => null;   // no menu buttons to click: the setting is put back directly
  sim.GAME.train = fakeTrain(sim, []);
  sim.GAME.settings.fire = 'easy';
  TUT.run = { i: 0, steps: TUT.steps('steam'), fire0: 'easy', cars0: 0, okT: 0 };
  // pressing F mid-lesson hands the player the fire (GAME.manualFire) ...
  sim.GAME.settings.fire = 'hand'; sim.applyFireSetting('hand');
  assert.equal(sim.S.autoFire, false);
  // ... and the step after the fire steps gives it back
  TUT.run.i = TUT.run.steps.findIndex(s => s.id === 'fireBack'); TUT.enter();
  assert.equal(sim.GAME.settings.fire, 'easy');
  assert.equal(sim.S.autoFire, true);
  // ending the lesson early gives it back too, and the next lesson-free run is untouched
  sim.GAME.settings.fire = 'hand'; sim.applyFireSetting('hand');
  TUT.end(true);
  assert.equal(sim.GAME.settings.fire, 'easy');
  assert.equal(TUT.run, null); assert.equal(TUT.want, false);
});

test('the lesson keeps the timetable trains off the road and asks for a light engine, and nothing else changes', () => {
  const sim = lesson();
  sim.GAME.settings.consist = 'freight';
  assert.equal(sim.JOB.consist(), 'freight');
  sim.TUT.want = true;
  assert.equal(sim.JOB.consist(), 'light');
  sim.TUT.want = false;
  assert.equal(sim.JOB.consist(), 'freight');
});

/* ------- the cars on Yard 2, on the real Berkshire Division ------- */
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';
test('the three cars wait behind the engine on Yard 2, clear of both ladder switches, with room to back down onto them', { skip: SKIP }, () => {
  const SRC = path.join(__dirname, '..', 'src');
  const files = ['01_util.js', '02_track.js', '03_route.js', '03c_mountain.js', '03d_frost.js', '04_world.js', '04b_mountain.js', '11n_tutor.js'];
  const ctx = { console, Math, URLSearchParams, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=ohio' },
    document: { createElement: () => ({ getContext: () => null }), getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const W = vm.runInContext('var FOUL_LEN = 38, PLAY_LAYOUT = null;\n' + files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n')
    + '\nWORLD.roadsX = []; WORLD.roadN = 1e7; buildRoute(); ({ ROUTE, TUT_GAP, TUT_CARS })', ctx, { filename: 'tutor-route.js' });
  const line = W.ROUTE.startLine;
  assert.equal(line.name, 'Yard 2');
  // the longest engine that can take the lesson (the Big Boy and tender, about 41 m) and 17 m a car
  for (const engine of [26, 41]) {
    const front = line.len - 175, sF = front - engine - W.TUT_GAP, sR = sF - W.TUT_CARS.length * 17;
    assert.ok(W.TUT_GAP >= 25 && W.TUT_GAP <= 60, 'a few car lengths to back down');
    for (const c of line.cuts) assert.ok(c.s < sR - 45 || c.s > front + 45, `switch at ${Math.round(c.s)} m is clear of the cars and the engine`);
  }
});
