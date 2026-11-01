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

test('a train you leave keeps its controls as you had them, its boiler and supplies', () => {
  const sim = h.load(), y = railroad(sim), S = sim.S;
  const A = train(sim, y.yard, 300); sim.GAME.train = A;
  Object.assign(S, { throttle: 0.6, reverser: 0.5, P: 201, W: 0.7, water: 50000, coal: 9000, fuel: 777, brakeH: 0.12, indH: 0, v: 0, time: 1234, bell: true, light: 2 });
  const st = sim.fleetPark(A);
  assert.ok(sim.CARS.cuts.includes(A), 'it stands among the consists on the rails');
  assert.equal(st.throttle, 0.6, 'throttle as you left it'); assert.equal(st.bell, false);
  assert.equal(st.brakeH, 0.12, 'brakes not applied'); assert.equal(st.indH, 0);
  assert.ok(A.crew && A.crew.keep, 'its engineer keeps hands off');
  assert.equal(st.P, 201); assert.equal(st.water, 50000); assert.equal(st.reverser, 0.5); assert.equal(st.light, 2);
  for (const k of sim.FLEET_WORLD) assert.ok(!(k in st), `${k} belongs to the railroad, not the engine`);
  assert.ok(A.vehicles.every(v => !v.hb), 'no handbrakes');
  // meanwhile another train is driven
  const B = train(sim, y.yard, 500); sim.GAME.train = B;
  Object.assign(S, { P: 150, water: 1, throttle: 0.9, time: 2000, light: 0 });
  assert.ok(sim.fleetResume(A));
  assert.equal(sim.GAME.train, A);
  assert.equal(S.P, 201); assert.equal(S.water, 50000); assert.equal(S.throttle, 0.6); assert.equal(S.light, 2);
  assert.equal(A.crew, null);
  assert.equal(S.time, 2000, 'the clock runs on');
  assert.ok(!sim.CARS.cuts.includes(A)); assert.equal(A.parkS, null);
  assert.ok(A.vehicles.every(v => !v.hb), 'handbrakes off for the train being driven');
  assert.ok(!('dist0' in S));
});

test('two trains with both knuckles closed buff and are shoved along', () => {
  const sim = h.load(), y = railroad(sim), { A, B } = twoTrains(sim, y);
  sim.S.v = 1.2;   // easing ahead into B's rear
  sim.CARS.contact(A, 1, { c: B, end: 'rear', facing: true });
  assert.equal(A.vehicles.length, 4); assert.equal(B.vehicles.length, 2);
  assert.ok(sim.CARS.cuts.includes(B));
  assert.ok(B.v > 0 && B.rolling, 'B is shoved ahead');
  assert.ok(sim.S.v < 1.2);
});

test('with a knuckle open two trains couple: the other engine is a helper, MU\'d to your throttle', () => {
  const sim = h.load(), y = railroad(sim), { A, B } = twoTrains(sim, y);
  const k0 = sim.helperK(A);
  sim.S.v = 1.2;
  sim.endCoupler(B, 'rear').v.kn[1] = sim.KN_OPEN;
  sim.CARS.contact(A, 1, { c: B, end: 'rear', facing: true });
  assert.equal(k0, 1);
  assert.deepEqual(A.vehicles.map(v => v.kind), ['loco', 'tender', 'loco', 'tender', 'box', 'box']);
  assert.ok(!sim.CARS.cuts.includes(B), 'B is part of your train now');
  assert.equal(B.parkS, null);
  assert.equal(A.lead, A.vehicles[2], 'you still drive your own engine');
  assert.ok(A.vehicles[0].helper && A.vehicles[1].helper && !A.vehicles[2].helper);
  assert.equal(sim.helperK(A), 2, 'two engines pulling');
  assert.ok(sim.log.toasts.some(t => /MU/.test(t.msg)));
  // cut it off again: back to one engine
  sim.CARS.uncouple(2, A);
  assert.deepEqual(A.vehicles.map(v => v.kind), ['loco', 'tender', 'box', 'box']);
  assert.equal(sim.helperK(A), 1);
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

/* the engineer on a train you are not driving: scanAhead lives in the page's main loop, so the end of track
   is found here the same way it does (routeWalk to the end) */
function engineer(sim) {
  sim.ctx.scanAhead = (T, dir, maxD) => {
    const f = T.endTP(dir > 0 ? 'front' : 'rear'), w = sim.routeWalk(f.e, f.s, f.o * dir, maxD, () => {}, () => false);
    return { sw: null, trail: null, signal: null, station: null, end: w.why === 'end' ? { d: w.d } : null };
  };
  sim.AI.trains = sim.AI.trains || [];
}
const run = (sim, T, secs) => { let top = 0; for (let i = 0; i < secs * 60; i++) { sim.S.time += 1 / 60; sim.FLEET.tick(1 / 60); top = Math.max(top, Math.abs(T.v)); } return top; };

test('a train left running keeps going with its engineer, stops short of a train ahead, and goes on when it clears', () => {
  const sim = h.load(), y = railroad(sim), S = sim.S; engineer(sim);
  const D = train(sim, y.yard, 590); sim.GAME.train = D;   // the train you drive, out of the way at the far end
  const A = train(sim, y.yard, 100, ['loco', 'tender', 'box', 'box']);
  Object.assign(S, { v: 6 * sim.MPH, vw: 6 * sim.MPH, throttle: 0.3, reverser: 0.6, brakeH: 0.12, indH: 0 });
  sim.fleetPark(A); sim.GAME.train = D;
  Object.assign(S, { v: 0, vw: 0, throttle: 0 });
  assert.ok(A.crew, 'left running, it has an engineer');
  assert.equal(A.crew.mph, 5);
  assert.ok(A.vehicles.every(v => !v.hb));
  sim.FLEET.run(A, 15);
  const B = train(sim, y.yard, 400); sim.CARS.cuts.push(B); B.parkS = { theta: 0, dist0: 0, water: 30000, coal: 5000, reverser: 0 };
  const s0 = A.endTP('front').s, top = run(sim, A, 150);
  assert.ok(top > 10 * sim.MPH, `got up to ${(top / sim.MPH).toFixed(1)} mph`);
  const gap = B.endTP('rear').s - A.endTP('front').s;
  assert.ok(Math.abs(A.v) < 0.05, 'stopped');
  assert.ok(gap > 3 && gap < 40, `stood ${gap.toFixed(1)} m short of the train ahead (moved ${(A.endTP('front').s - s0).toFixed(0)} m)`);
  assert.equal(B.v || 0, 0, 'never touched it');
  assert.ok(A.crew && /ahead/.test(A.crew.why), A.crew && A.crew.why);
  assert.equal(S.v, 0, 'the train you drive is untouched');
  assert.equal(sim.log.fails.length + sim.log.derails.length, 0);
  // the way clears: on to the end of the track (D stands at 590, so the end is the train you drive)
  sim.CARS.cuts = sim.CARS.cuts.filter(c => c !== B);
  run(sim, A, 120);
  const gap2 = D.endTP('rear').s - A.endTP('front').s;
  assert.ok(Math.abs(A.v) < 0.05 && gap2 > 3 && gap2 < 40, `stood ${gap2.toFixed(1)} m short of your train`);
  // hold: it ties down and stands as a train left standing
  sim.FLEET.run(A, 0); run(sim, A, 10);
  assert.equal(A.crew, null);
  assert.ok(A.vehicles.every(v => v.hb));
  assert.equal(A.parkS.throttle, 0);
});

test('an engineer stops short of the end of the track, and a train with one goes into the save with him', () => {
  const sim = h.load(), y = railroad(sim); engineer(sim);
  const D = train(sim, y.yard, 60); sim.GAME.train = D;
  const A = train(sim, y.yard, 300); sim.fleetPark(A); sim.GAME.train = D;
  sim.FLEET.run(A, 20);
  run(sim, A, 120);
  const left = 600 - A.endTP('front').s;
  assert.ok(Math.abs(A.v) < 0.05 && left > 3 && left < 40, `stood ${left.toFixed(1)} m short of the end`);
  Object.assign(A, { opts: {}, cfg: {}, fid: 2, nUnits: 1, consistKey: 'light' });
  const o = JSON.parse(JSON.stringify(sim.fleetOut(A)));
  assert.deepEqual(o.crew, { mph: 20, dir: 1, keep: 0 });
  sim.FLEET.reverse(A);
  assert.equal(A.crew.dir, -1);
  run(sim, A, 30);
  assert.ok(600 - A.endTP('front').s > left + 20, 'and backs away when sent the other way');
});

test('a train left with the throttle open keeps it open, and its engineer steps in only to stop short of a train ahead', () => {
  const sim = h.load(), y = railroad(sim), S = sim.S; engineer(sim);
  const D = train(sim, y.yard, 590); sim.GAME.train = D;
  const A = train(sim, y.yard, 100, ['loco', 'tender', 'box', 'box']);
  Object.assign(S, { v: 4 * sim.MPH, vw: 4 * sim.MPH, throttle: 0.5, reverser: 0.6, brakeH: 0.12, indH: 0 });
  for (const v of A.vehicles) v.brake.BC = 0;
  sim.fleetPark(A); sim.GAME.train = D;
  run(sim, A, 5);
  assert.ok(A.crew.keep && A.parkS.throttle === 0.5, 'hands off for now');
  assert.ok(A.v > 4 * sim.MPH, 'still pulling');
  run(sim, A, 200);
  const gap = D.endTP('rear').s - A.endTP('front').s;
  assert.ok(Math.abs(A.v) < 0.05 && gap > 3 && gap < 40, `stood ${gap.toFixed(1)} m short of your train`);
  assert.equal(A.crew.keep, false, 'the engineer took over');
});
