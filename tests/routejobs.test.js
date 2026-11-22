/* Jobs on Laurel Mountain and Raven Lake, what the jobs pay and what career mode opens up.
   The route checks build each railroad with the real three.js (no page or GPU), like mountain.test.js;
   the step and pay checks run in the physics harness. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('./harness');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

const built = {};
function railroad(key) {
  if (built[key]) return built[key];
  const files = ['01_util.js', '02_track.js', '03_route.js', '03c_mountain.js', '03d_frost.js', '04_world.js', '04b_mountain.js', '11d_jobs.js'];
  const ctx = { console, Math, URLSearchParams, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=' + key },
    document: { createElement: () => ({ getContext: () => null }), getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const build = { ohio: 'buildRoute()', laurel: 'buildMountainRoute()', frost: 'buildFrostRoute()' }[key];
  const code = 'var FOUL_LEN = 38, PLAY_LAYOUT = null;\n' + files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    WORLD.roadsX = []; WORLD.roadN = 1e7; ${build};
    const jFR = { p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3() };
    try { for (const st of ROUTE.stations) { st.edge.pose(st.s, jFR); st.p = jFR.p.clone(); } } catch (e) { for (const st of ROUTE.stations) { const [X, N] = st.edge.xz(st.s); st.p = new THREE.Vector3(X, 0, -N); } }
    ({ ROUTE, NET, JOB, JOBS, JOB_SPAWNS, JOB_MARKS, ROUTE_KEY, THREE })`;
  return (built[key] = vm.runInContext(code, ctx, { filename: key + '-jobs.js' }));
}

test('Laurel Mountain and Raven Lake each have their own jobs, and the Ohio jobs stay on the Berkshire Division', { skip: SKIP }, () => {
  const ids = k => Array.from(railroad(k).JOB.list(), j => j.id);
  assert.deepEqual(ids('laurel'), ['pusher', 'no21']);
  assert.deepEqual(ids('frost'), ['lakemail', 'icefreight']);
  assert.ok(!ids('laurel').includes('no7') && railroad('laurel').JOB.def('no7') === null, 'an Ohio job cannot be started on the mountain');
});

test('every job on the new routes spawns on real track and names stations, places and tracks that exist', { skip: SKIP }, () => {
  for (const key of ['laurel', 'frost']) {
    const W = railroad(key);
    for (const j of W.JOB.list()) {
      const sp = W.JOB_SPAWNS[j.spawn]; assert.ok(sp, `${j.id}: spawn ${j.spawn}`);
      const line = W.ROUTE.lines[sp.line]; assert.ok(line, `${j.id}: line ${sp.line}`);
      assert.ok(sp.s > 0 && sp.s < line.len, `${j.id}: spawn inside ${sp.line}`);
      for (const n of sp.lined) assert.ok(W.NET.switches.some(s => s.name === n), `${j.id}: switch ${n}`);
      if (sp.cabAt) assert.ok(W.ROUTE.stations.some(s => s.name === sp.cabAt), `${j.id}: platform ${sp.cabAt}`);
      for (const st of j.steps) {
        if (st.at) assert.ok(W.JOB.where(st.at), `${j.id}: ${st.type} at ${st.at}`);
        if (st.miss) assert.ok(W.JOB.where(st.miss), `${j.id}: ${st.miss}`);
        if (st.type === 'track') assert.ok(W.ROUTE.lines[st.to], `${j.id}: track ${st.to}`);
      }
      // the timetable runs forward
      const times = j.steps.map(st => st.dep || st.arr || st.by).filter(Boolean);
      assert.ok(times[0] >= j.start, `${j.id}: first time after going on duty`);
      for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], `${j.id}: step ${i} later than the one before`);
      assert.ok(j.pay > 0, `${j.id}: pays`);
    }
  }
});

test('a named place on the main sits on the track, and a station still answers by its platform', { skip: SKIP }, () => {
  const L = railroad('laurel'), F = railroad('frost');
  for (const [W, name, s] of [[L, 'Horseshoe Curve', 20950], [F, 'the far shore', null]]) {
    const p = W.JOB.where(name), sm = s == null ? W.JOB_MARKS[name]() : s, loc = W.ROUTE.main.locate(sm), [X, N] = loc.edge.xz(loc.s);
    assert.ok(Math.hypot(p.x - X, p.z + N) < 0.01, `${name} on the main`);
  }
  assert.equal(L.JOB.where('Summit'), L.ROUTE.stations.find(s => s.name === 'Summit').p);
});

test('the mine run and its pusher fit on track 1 below the climb, clear of every switch', { skip: SKIP }, () => {
  const W = railroad('laurel'), j = W.JOB.def('pusher'), sp = W.JOB_SPAWNS[j.spawn];
  // a 765, 14 loaded hoppers and a caboose run about 300 m; the pusher stands j.helper m behind and is about 35 m long
  const back = sp.s - 300 - j.helper - 40, main = W.ROUTE.lines.Main;
  assert.ok(back > 0 && sp.s < 11500, 'all on the level, short of the 1.9 per cent');
  const pts = [];
  for (let s = back - 50; s <= sp.s + 50; s += 10) { const loc = main.locate(s), [X, N] = loc.edge.xz(loc.s); pts.push([X, N]); }
  for (const sw of W.NET.switches) {
    const e = sw.legs[0].edge, at = sw.node === e.a ? 0 : e.len, [X, N] = e.xz(at);
    const d = Math.min(...pts.map(([x, n]) => Math.hypot(x - X, n - N)));
    assert.ok(d > 40, `${sw.name} is ${d.toFixed(0)} m from the train`);
  }
});

test('Raven Lake jobs start on the Hollow Pine siding with room for the train behind them', { skip: SKIP }, () => {
  const W = railroad('frost');
  for (const id of ['lakemail', 'icefreight']) {
    const sp = W.JOB_SPAWNS[W.JOB.def(id).spawn], line = W.ROUTE.lines[sp.line];
    assert.equal(sp.line, 'Hollow Pine Siding');
    assert.ok(sp.s - 260 > 45, `${id}: the train's rear clears the west switch`);
    assert.ok(line.len - sp.s > 45, `${id}: the front stops short of the east switch`);
  }
});

/* ---------------- pay and career ---------------- */
function career(mode, cash = 0) {
  const sim = h.load();
  sim.GAME.settings = { career: mode, loco: '765' };
  sim.IND.career = { cash, cars: 0 };
  sim.ctx.setTimeout = () => 0;
  return sim;
}

test('a job pays its rate at 100 points, less for a lower score, nothing for no rate', () => {
  const { CAREER } = career('free');
  assert.equal(CAREER.jobPay({ pay: 6000 }, 100), 6000);
  assert.equal(CAREER.jobPay({ pay: 6000 }, 75), 4500);
  assert.equal(CAREER.jobPay({ pay: 2500 }, 83), 2080);
  assert.equal(CAREER.jobPay({ pay: 2500 }, -5), 0);
  assert.equal(CAREER.jobPay({}, 100), 0);
});

test('free play has everything open; career opens engines and routes as earnings pass their price', () => {
  const free = career('free');
  for (const k of ['4014', 'e5', '18', '1308']) assert.ok(free.CAREER.open('loco', k));
  assert.ok(free.CAREER.open('route', 'frost'));
  const c = career('career');
  for (const k of ['765', '1225', 'diesel']) assert.ok(c.CAREER.open('loco', k), `${k} is open from the start`);
  assert.ok(c.CAREER.open('route', 'ohio'));
  assert.ok(!c.CAREER.open('loco', '4014') && !c.CAREER.open('route', 'laurel'));
  c.IND.career.cash = 4000; assert.ok(c.CAREER.open('route', 'laurel') && !c.CAREER.open('loco', '1308'));
  c.IND.career.cash = 1e6; for (const kind in c.CAREER_PRICE) for (const k in c.CAREER_PRICE[kind]) assert.ok(c.CAREER.open(kind, k));
});

test('getting paid adds to the run and to all-time earnings, and announces what it opened', () => {
  const sim = career('career', 3000);
  const paid = sim.CAREER.payJob({ pay: 6000 }, 100);
  assert.equal(paid, 6000);
  assert.equal(sim.IND.career.cash, 9000);
  assert.equal(sim.IND.cash, 6000);
  assert.equal(sim.CAREER.between(3000, 9000).map(u => u.k).join(), 'laurel,1308');
  assert.equal(sim.CAREER.next().k, '18');
  assert.equal(sim.CAREER.payJob({ pay: 6000 }, 0), 0);
  assert.equal(sim.IND.career.cash, 9000);
});

/* ---------------- the new steps ---------------- */
function stepRig(step) {
  const sim = h.load(), V3 = h.Vector3;
  const summit = new V3(1000, 0, 0);
  sim.ctx.ROUTE = { stations: [{ name: 'Summit', p: summit }], lines: {} };
  sim.ctx.MAP = { lines: [] };
  sim.ctx.carPanelState = {};
  sim.ctx.$ = () => null;
  sim.ctx.setTimeout = () => 0;
  const T = { vehicles: [{ kind: 'loco' }, { kind: 'tender' }, { kind: 'hopper' }, { kind: 'caboose' }], lead: { pos: new V3(0, 0, 0), fwd: new V3(1, 0, 0) }, loco: { cabEye: { x: 0 } },
    worldOf() { return this.lead.pos.clone(); }, pts: [], fouls: () => false };
  const def = { id: 't', name: 'Test job', start: 0, steps: [step, { type: 'pass', at: 'Summit', by: 99999 }] };
  const R = { def, t0: 0, steps: def.steps.map(s => ({ ...s, state: 'todo' })), i: 0, items: [], over: false, cars: [], ep: {}, lastStop: 0, score: 100 };
  sim.JOB.run = R;
  sim.JOB.ui = () => {};
  return { sim, T, R, summit };
}

test('the pusher step finishes once the pusher is coupled on', () => {
  const { sim, T, R } = stepRig({ type: 'helper', text: 'Couple the pusher' });
  sim.JOB.steps(R, T, 10); assert.equal(R.i, 0);
  T.vehicles.push({ kind: 'loco', helper: { g: '1' } });
  sim.JOB.steps(R, T, 20); assert.equal(R.i, 1); assert.equal(R.steps[0].state, 'done');
});

test('running past the foot of the climb without the pusher costs points and moves on', () => {
  const { sim, T, R, summit } = stepRig({ type: 'helper', miss: 'Summit', text: 'Couple the pusher' });
  T.lead.pos.copy(summit);
  sim.JOB.steps(R, T, 10);
  assert.equal(R.i, 1); assert.equal(R.steps[0].state, 'missed');
  assert.ok(R.items.some(i => i.label === 'Left the pusher behind'));
});

test('the cut-off step wants the train stopped at the station with the pusher off', () => {
  const { sim, T, R, summit } = stepRig({ type: 'cutoff', at: 'Summit', by: 100, text: 'Cut the pusher off' });
  T.vehicles.push({ kind: 'loco', helper: { g: '1' } });
  sim.JOB.steps(R, T, 10); assert.equal(R.i, 0, 'not there yet');
  T.lead.pos.copy(summit).add(new h.Vector3(120, 0, 0)); R.lastStop = 5;
  sim.JOB.steps(R, T, 50); assert.equal(R.i, 0); assert.match(R.steps[0].why, /pull the pin/i);
  T.vehicles.pop(); R.lastStop = 0.2;
  sim.JOB.steps(R, T, 60); assert.equal(R.i, 0); assert.match(R.steps[0].why, /stand/);
  R.lastStop = 3;
  sim.JOB.steps(R, T, 160); assert.equal(R.i, 1);
  assert.ok(R.items.some(i => i.label === 'Late into Summit'), 'a minute late costs time points');
});
