/* More than one train (src/11l_fleet.js): a train left standing keeps its engine's state and stands with the
   brakes set; trains buff but never couple to each other; cars still couple onto a standing train and can be cut
   off it. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* one 600 m yard track, and a turnout off a 200 m trunk as in place.test.js */
function railroad(sim) {
  const net = new sim.Network();
  const yard = net.edge(new sim.PathBuilder(0, 500, 0).straight(600).pts, { kind: 'yard' });
  sim.ctx.NET = net;
  sim.CARS.geo = { tg: {}, a6: {}, a4: {} };
  return { yard };
}
function vehicle(sim, kind, len) {
  const v = { kind, len, flip: false, mass: kind === 'tender' ? 0 : kind === 'loco' ? 200000 : h.FREIGHT_CAR, axles: kind === 'loco' ? 10 : 4, area: 100, brakeA: 0.5,
    kn: [0, 0], trucks: [], root: h.Anything(), brake: { AR: 90, BC: 0, BP: 90, emerg: false, released: true } };
  v.ptsAll = [3, len - 3].map(loc => ({ loc, a: 0, tp: null, F: { p: new h.Vector3(), f: new h.Vector3(), u: new h.Vector3(), r: new h.Vector3() }, v })); v.fp = v.ptsAll;
  return v;
}
/* a steam engine and tender (and any cars: 'car' ahead or behind) as a train, front coupler at s */
function train(sim, e, s, kinds = ['loco', 'tender']) {
  const T = new sim.Consist(null);
  Object.assign(T, { update() {}, buildInstances() {}, inst: [], scene: sim.ctx.scene, tenderEmpty: 92000, locoKey: '765', diesel: false, v: 0, rolling: false, stopT: 0 });
  T.vehicles = kinds.map(k => vehicle(sim, k, k === 'loco' ? 30 : k === 'tender' ? 20 : 15));
  T.layout();
  T.place(new sim.TrackPos(e, s, 1));
  return T;
}
/* a cut of n box cars, front coupler at s */
function cut(sim, e, s, n) {
  const c = new sim.Cut(sim.ctx.scene, [...Array(n)].map(() => vehicle(sim, 'box', 15)));
  c.place(new sim.TrackPos(e, s, 1));
  sim.CARS.cuts.push(c);
  return c;
}
/* drive A, then leave it standing and take over a second train B */
function twoTrains(sim, y) {
  const A = train(sim, y.yard, 300, ['loco', 'tender', 'box', 'box']);
  sim.GAME.train = A;
  const B = train(sim, y.yard, 500);
  sim.CARS.cuts.push(B); B.parkS = { theta: 0, dist0: 0, water: 30000, coal: 5000, P: 230, throttle: 0, brakeH: 0.5, indH: 1 };
  return { A, B };
}

test('a train left standing keeps its controls, boiler and supplies, with the throttle shut and the brakes set', () => {
  const sim = h.load(), y = railroad(sim), S = sim.S;
  const A = train(sim, y.yard, 300); sim.GAME.train = A;
  Object.assign(S, { throttle: 0.6, reverser: 0.5, P: 201, W: 0.7, water: 50000, coal: 9000, fuel: 777, brakeH: 0.12, indH: 0, v: 0, time: 1234, bell: true, light: 2 });
  const st = sim.fleetPark(A);
  assert.ok(sim.CARS.cuts.includes(A), 'it stands among the consists on the rails');
  assert.equal(st.throttle, 0); assert.equal(st.bell, false); assert.equal(st.indH, 1);
  assert.ok(st.brakeH >= 0.5, 'train brake in service');
  assert.equal(st.P, 201); assert.equal(st.water, 50000); assert.equal(st.reverser, 0.5); assert.equal(st.light, 2);
  for (const k of sim.FLEET_WORLD) assert.ok(!(k in st), `${k} belongs to the railroad, not the engine`);
  assert.ok(A.vehicles.every(v => v.hb), 'tied down');
  assert.equal(A.rolling, false);
  // meanwhile another train is driven
  const B = train(sim, y.yard, 500); sim.GAME.train = B;
  Object.assign(S, { P: 150, water: 1, throttle: 0.9, time: 2000, light: 0 });
  assert.ok(sim.fleetResume(A));
  assert.equal(sim.GAME.train, A);
  assert.equal(S.P, 201); assert.equal(S.water, 50000); assert.equal(S.throttle, 0); assert.equal(S.light, 2);
  assert.equal(S.time, 2000, 'the clock runs on');
  assert.ok(!sim.CARS.cuts.includes(A)); assert.equal(A.parkS, null);
  assert.ok(A.vehicles.every(v => !v.hb), 'handbrakes off for the train being driven');
  assert.ok(!('dist0' in S));
});

test('two trains meeting buff and are shoved along, but never couple, even with a knuckle open', () => {
  const sim = h.load(), y = railroad(sim), { A, B } = twoTrains(sim, y);
  sim.S.v = 1.2;   // easing ahead into B's rear
  sim.endCoupler(B, 'rear').v.kn[1] = sim.KN_OPEN;
  sim.CARS.contact(A, 1, { c: B, end: 'rear', facing: true });
  assert.equal(A.vehicles.length, 4); assert.equal(B.vehicles.length, 2);
  assert.ok(sim.CARS.cuts.includes(B));
  assert.ok(B.v > 0 && B.rolling, 'B is shoved ahead');
  assert.ok(sim.S.v < 1.2);
  assert.ok(sim.log.toasts.some(t => /do not couple/.test(t.msg)));
});

test('a rolling cut couples onto a standing train, and the train keeps its engine at the head', () => {
  const sim = h.load(), y = railroad(sim), { B } = twoTrains(sim, y);
  const c = cut(sim, y.yard, 440, 2);   // 2 cars, front coupler 10 m short of B's rear (450)
  c.vehicles[0].kn = [sim.KN_OPEN, sim.KN_OPEN]; c.v = 1; c.rolling = true;
  sim.CARS.contact(c, 1, { c: B, end: 'rear', facing: true });
  assert.ok(!sim.CARS.cuts.includes(c), 'the cut went into the train');
  assert.ok(sim.CARS.cuts.includes(B));
  assert.deepEqual(B.vehicles.map(v => v.kind), ['loco', 'tender', 'box', 'box']);
  assert.equal(B.lead.kind, 'loco');
});

test('pulling the pin on a standing train cuts off the cars, never its engine, from either end', () => {
  const sim = h.load(), y = railroad(sim), { B } = twoTrains(sim, y);
  // a car ahead of the engine and one behind the tender
  const P = train(sim, y.yard, 150, ['box', 'loco', 'tender', 'box']);
  P.parkS = { theta: 0, dist0: 0, water: 1, coal: 1 }; sim.CARS.cuts.push(P);
  sim.CARS.uncouple(1, P);   // between the front car and the engine
  assert.deepEqual(P.vehicles.map(v => v.kind), ['loco', 'tender', 'box']);
  const front = sim.CARS.cuts.find(c => c !== P && c !== B && c.vehicles.length === 1);
  assert.ok(front && front.vehicles[0].kind === 'box', 'the front car is a cut of its own');
  sim.CARS.uncouple(2, P);   // behind the tender
  assert.deepEqual(P.vehicles.map(v => v.kind), ['loco', 'tender']);
});

test('placing: a car set against a standing train joins it, the train you drive never joins another', () => {
  const sim = h.load(), y = railroad(sim), { A, B } = twoTrains(sim, y);
  const c = new sim.Cut(sim.ctx.scene, [vehicle(sim, 'box', 15)]);
  const f = sim.PLACE.fit(c, new sim.TrackPos(y.yard, 449, 1));   // up against B's rear coupler
  assert.ok(f.ok, f.why);
  assert.equal(f.joins.length, 1); assert.equal(f.joins[0].c, B);
  sim.PLACE.commit(c, f);
  assert.deepEqual(B.vehicles.map(v => v.kind), ['loco', 'tender', 'box']);
  // your train set down nose to B's new rear: it stands there, uncoupled
  const g = sim.PLACE.fit(A, new sim.TrackPos(y.yard, 434, 1));
  assert.ok(g.ok, g.why);
  assert.equal(g.joins.length, 0);
});

test('a standing train shoved along brakes to a stop on its own and is tied down', () => {
  const sim = h.load(), y = railroad(sim), { B } = twoTrains(sim, y);
  for (const v of B.vehicles) v.brake.BC = 50;
  B.v = 2; B.rolling = true;
  const s0 = B.endTP('front').s;
  for (let i = 0; i < 120 * 12; i++) sim.CARS.step(1 / 120);
  assert.equal(B.v, 0);
  assert.equal(B.rolling, false);
  assert.ok(B.vehicles.every(v => v.hb), 'tied down once stopped');
  const moved = B.endTP('front').s - s0;
  assert.ok(moved > 0.5 && moved < 8, `rolled ${moved.toFixed(2)} m against its brakes`);
  // its tender weighs what it had in it when it was left, not what the train being driven has
  sim.S.water = 0; sim.S.coal = 0;
  assert.equal(sim.consistMass(B), 200000 + 92000 + 30000 + 5000);
});

test('a standing train goes into the save with its engine state, and the cars list leaves it out', () => {
  const sim = h.load(), y = railroad(sim), { B } = twoTrains(sim, y);
  Object.assign(B, { opts: { units: 1, livery: 'ss' }, cfg: { loco: '765', consist: 'light' }, fid: 3, nUnits: 1, consistKey: 'light' });
  const o = JSON.parse(JSON.stringify(sim.fleetOut(B)));
  assert.equal(o.loco, '765'); assert.equal(o.fid, 3);
  assert.equal(o.ps.P, 230); assert.equal(o.cfg.consist, 'light'); assert.equal(o.opts.livery, 'ss');
  assert.deepEqual(o.v.map(x => x.p), [0, 1], 'engine and tender saved as the engine\'s own');
  assert.equal(sim.CARS.cuts.filter(c => !c.parkS).length, 0);
});
