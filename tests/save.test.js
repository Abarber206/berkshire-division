/* Save and resume: a run written out and read back puts every car where it stood, with its knuckles, brakes
   and handbrakes; the job sheet and the train's state come back; saves are kept per slot. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* a 400 m yard track and a 600 m main, end to end through a switch with a spur off it, as in place.test.js */
function railroad(sim) {
  const net = new sim.Network();
  const yard = net.edge(new sim.PathBuilder(0, 0, 0).straight(400).pts, { kind: 'yard' });
  const main = net.edge(new sim.PathBuilder(400, 0, 0).straight(600).pts, { kind: 'main' });
  const b = new sim.PathBuilder(400, 0, 0); b.jog(-4.5, 180); b.straight(140);
  const spur = net.edge(b.pts, { kind: 'yard' });
  const node = net.node();
  net.attach(yard, 1, node); net.attach(main, 0, node); net.attach(spur, 0, node);
  const sw = net.addSwitch(node, node.att[0], node.att[1], node.att[2], 'Yard East');
  sim.ctx.NET = net;
  sim.CARS.geo = { tg: {}, a6: {}, a4: {} };
  // the yard and the main as named lines, for finding a train again after the track has been rebuilt
  const line = (name, e) => { e.line = { name }; e.lineS0 = 0; return { name, len: e.len, locate: s => ({ edge: e, s }) }; };
  sim.ctx.ROUTE = { lines: { Yard: line('Yard', yard), Main: line('Main', main) }, stations: [] };
  return { net, yard, main, spur, sw };
}
function car(sim, len = 15) {
  return { kind: 'box', len, frame: [2, len - 2], trucks: [], mass: h.FREIGHT_CAR, axles: 4, area: 105, brakeA: 0.5, root: h.Anything(),
    brake: { AR: 0, BC: 0, BP: 0, emerg: false, released: true }, kn: [0, 0] };
}
/* a consist of n cars, its front coupler at s on edge e */
function cutAt(sim, e, s, n, o = 1) {
  const c = new sim.Cut(sim.ctx.scene, [...Array(n)].map(() => car(sim)));
  c.place(new sim.TrackPos(e, s, o));
  return c;
}
/* the same shape of consist, not yet on the rails */
const blank = (sim, n) => new sim.Cut(sim.ctx.scene, [...Array(n)].map(() => car(sim)));
const where = c => c.vehicles.map(v => v.ptsAll.map(p => [p.tp.e.id, +p.tp.s.toFixed(3), p.tp.o]));

test('a cut standing across the switch comes back with every truck where it was', () => {
  const sim = h.load(), y = railroad(sim);
  y.sw.state = 1;   // lined for the spur
  const c = cutAt(sim, y.spur, 30, 4);   // front on the spur, rear back on the yard track
  assert.ok(c.vehicles.some(v => v.ptsAll.some(p => p.tp.e === y.yard)) && c.vehicles.some(v => v.ptsAll.some(p => p.tp.e === y.spur)));
  c.vehicles[1].flip = true; c.vehicles[2].hb = true; c.vehicles[0].kn = [sim.KN_OPEN, sim.KN_CLOSED];
  c.vehicles[3].brake = { AR: 70, BC: 20, BP: 70, emerg: false, released: false };
  const saved = JSON.parse(JSON.stringify(sim.consistOut(c)));
  // the switch has been thrown back since: the save does not care, every point goes back on its own edge
  y.sw.state = 0;
  const back = blank(sim, 4);
  back.vehicles.forEach((v, i) => sim.vehicleIn(v, saved.v[i]));
  assert.ok(sim.seatConsist(back, saved, new Map(y.net.edges.map(e => [e.id, e]))));
  assert.deepEqual(where(back), where(c));
  assert.equal(back.vehicles[1].flip, true);
  assert.equal(back.vehicles[2].hb, true);
  assert.deepEqual([...back.vehicles[0].kn], [sim.KN_OPEN, sim.KN_CLOSED]);
  assert.equal(JSON.stringify(back.vehicles[3].brake), JSON.stringify({ AR: 70, BC: 20, BP: 70, emerg: false, released: false }));
});

test('when the track has been rebuilt, a consist is found again by line and distance', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.main, 250, 3);
  const saved = JSON.parse(JSON.stringify(sim.consistOut(c)));
  assert.deepEqual(saved.front, ['Main', 250, 1]);
  const back = blank(sim, 3);
  assert.ok(sim.seatConsist(back, saved, null));
  assert.deepEqual(where(back), where(c));
  // a line that no longer exists cannot be found
  saved.front[0] = 'Gone';
  assert.equal(sim.seatConsist(blank(sim, 3), saved, null), false);
});

test('a save of a train facing backward keeps its facing', () => {
  const sim = h.load(), y = railroad(sim);
  const c = cutAt(sim, y.yard, 100, 2, -1);
  const saved = JSON.parse(JSON.stringify(sim.consistOut(c)));
  const back = blank(sim, 2);
  sim.seatConsist(back, saved, new Map(y.net.edges.map(e => [e.id, e])));
  assert.deepEqual(where(back), where(c));
  assert.ok(back.pts.every(p => p.tp.o === -1));
});

test('engine records point at the engine as built, cars carry what they are and their weight', () => {
  const sim = h.load(), y = railroad(sim);
  const T = cutAt(sim, y.main, 300, 3);
  const power = [T.vehicles[0]];
  T.vehicles[1].made = { type: 'box', num: 21007, rs: 'NKP' }; T.vehicles[1].mass = 25 * sim.STON; T.vehicles[1].job = { to: 'Yard 1', tag: 'grain' };
  const o = sim.consistOut(T, power);
  assert.equal(o.v[0].p, 0);
  assert.equal(o.v[0].m, undefined);
  assert.deepEqual(o.v[1].m, { type: 'box', num: 21007, rs: 'NKP' });
  assert.equal(o.v[1].w, Math.round(25 * sim.STON));
  assert.deepEqual(o.v[1].j, { to: 'Yard 1', tag: 'grain' });
});

test('the train state keeps the controls, boiler and clock but not the pause', () => {
  const sim = h.load();
  Object.assign(sim.S, { throttle: 0.42, reverser: 0.3, P: 231.5, W: 0.55, time: 812.25, paused: true, sander: true, notAFiniteNumber: NaN, someObject: { a: 1 } });
  const st = sim.stateOut();
  assert.equal(st.throttle, 0.42); assert.equal(st.P, 231.5); assert.equal(st.time, 812.25); assert.equal(st.sander, true);
  assert.equal('paused' in st, false);
  assert.equal('notAFiniteNumber' in st, false);
  assert.equal('someObject' in st, false);
  assert.doesNotThrow(() => JSON.stringify(st));
});

test('a job in progress comes back on the same step, with its deductions and its waybilled cars', () => {
  const sim = h.load(), y = railroad(sim);
  sim.JOB.ui = () => {}; sim.JOB.closeUI = () => {}; sim.ctx.carPanelState = { key: '' };
  const c = cutAt(sim, y.yard, 200, 4);
  const def = sim.JOB.def('no7');
  sim.JOB.run = { def, t0: 12, steps: def.steps.map((s, i) => ({ ...s, state: i < 2 ? 'done' : 'todo', t: i < 2 ? 25200 + i : undefined })), i: 2, items: [], over: false, failed: null,
    cars: [c.vehicles[1], c.vehicles[2]], ep: { emg: false }, moveAt: 30, lastStop: 4, score: 100 };
  sim.JOB.dock('handling', 3, 'Firm coupling', '5 mph', true);
  const uid = new Map(c.vehicles.map((v, i) => [v, i]));
  const saved = JSON.parse(JSON.stringify(sim.jobOut(uid)));
  assert.deepEqual(saved.cars, [1, 2]);
  sim.JOB.run = null;
  sim.jobIn(saved, c.vehicles);
  const R = sim.JOB.run;
  assert.equal(R.def, def);
  assert.equal(R.i, 2);
  assert.equal(R.t0, 12);
  assert.equal(R.steps[0].state, 'done');
  assert.equal(R.steps[2].state, 'todo');
  assert.equal(R.steps[2].type, def.steps[2].type);
  assert.deepEqual(R.cars, [c.vehicles[1], c.vehicles[2]]);
  assert.equal(R.items.length, 1);
  assert.equal(R.score, 97);
  // a finished job is not saved: the run goes on free running
  sim.JOB.run.over = true;
  assert.equal(sim.jobOut(uid), null);
});

test('saves are kept per slot and an unreadable or old one is ignored', () => {
  const sim = h.load(), store = new Map();
  sim.ctx.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const d = { ver: sim.SAVE.VER, at: 1, train: { v: [] } };
  assert.ok(sim.SAVE.write('2', d));
  assert.equal(JSON.stringify(sim.SAVE.read('2')), JSON.stringify(d));
  assert.equal(sim.SAVE.read('1'), null);
  store.set('bd_save_1', '{not json');
  assert.equal(sim.SAVE.read('1'), null);
  store.set('bd_save_3', JSON.stringify({ ver: 0, train: {} }));
  assert.equal(sim.SAVE.read('3'), null);
  sim.SAVE.remove('2');
  assert.equal(sim.SAVE.read('2'), null);
  // a full store is reported once and does not throw
  sim.ctx.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(sim.SAVE.write('auto', d), false);
  assert.equal(sim.SAVE.write('auto', d), false);
  assert.equal(sim.log.toasts.filter(t => /no room/.test(t.msg)).length, 1);
});
