/* Boiler, air brake, train dynamics and coupling checks. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

const between = (x, lo, hi, what) => assert.ok(x >= lo && x <= hi, `${what}: ${x.toFixed(2)} not in [${lo}, ${hi}]`);

/* ---------------------------------------------------------------- boiler */
test('starting tractive effort is close to the 765\'s rated 64,135 lbf, without slipping on dry rail', () => {
  const sim = h.load(), T = h.train(sim, 36), S = sim.S;
  Object.assign(S, { cocks: false, throttle: 1, reverser: 1 });
  for (let i = 0; i < 90; i++) { S.v = 0; S.vw = 0; sim.physicsStep(1 / 30, T); }
  between(S.TE / sim.LBF, 0.9 * 64135, 1.05 * 64135, 'starting TE (lbf)');
  assert.equal(S.slip, false);
});

test('full throttle on wet rail slips the drivers, and sand stops it', () => {
  const sim = h.load(), T = h.train(sim, 36), S = sim.S;
  sim.ENV.mu = 0.16;
  Object.assign(S, { cocks: false, throttle: 1, reverser: 1, indH: 0 });
  h.run(sim, T, 3);
  assert.ok(S.slip, 'should slip');
  assert.ok(sim.log.events.includes('slip'));
  S.throttle = 0.55; S.sander = true;
  h.run(sim, T, 10);
  assert.equal(S.slip, false, 'sand and an eased throttle should catch the slip');
});

for (const [reverser, floor, how] of [[0.3, 220, 'notched up'], [0.4, 180, 'flat out']]) {
  test(`the automatic fireman keeps steam and half a glass of water for 10 minutes ${how} with 36 cars`, () => {
    const sim = h.load(), T = h.train(sim, 36), S = sim.S;
    Object.assign(S, { cocks: false, throttle: 1, reverser, indH: 0, brakeH: 0.12, v: 30 * sim.MPH });
    let minP = Infinity, minW = Infinity, maxW = -Infinity;
    h.run(sim, T, 600, () => { minP = Math.min(minP, S.P); minW = Math.min(minW, S.W); maxW = Math.max(maxW, S.W); });
    assert.ok(S.use > 4, `engine should be using steam (${S.use.toFixed(2)})`);
    between(minP, floor, 250, 'lowest boiler pressure (psi)');
    between(minW, 0.3, 1, 'lowest water level (glass)');
    between(maxW, 0.3, 1, 'highest water level (glass)');
    assert.deepEqual(sim.log.fails, []);
  });
}

test('working without the injector drops the fusible plug and kills the fire', () => {
  const sim = h.load(), T = h.train(sim, 36), S = sim.S;
  Object.assign(S, { cocks: false, throttle: 0.8, reverser: 0.35, indH: 0, autoFire: false, injector: false, stoker: 0.8 });
  let lowWarned = false;
  const t = h.run(sim, T, 3600, () => { lowWarned = lowWarned || S.lowWater; return S.dead; });
  assert.ok(S.dead, 'fusible plug should drop');
  assert.ok(lowWarned, 'the low water warning comes first');
  assert.deepEqual(sim.log.fails, ['Fusible plug dropped']);
  assert.equal(S.fire, 0);
  between(t, 120, 3600, 'time to drop the plug (s)');
});

test('safety valves lift at about 245 psi and pressure never passes 250', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  Object.assign(S, { autoFire: false, stoker: 1, blower: 1, fire: 1, P: 240 });
  let lift = null, maxP = 0, seated = false;
  h.run(sim, T, 300, () => { maxP = Math.max(maxP, S.P); if (S.safety && lift === null) lift = S.P; });
  between(lift, 245, 247, 'lifting pressure (psi)');
  assert.ok(maxP <= 250);
  // bank the fire and the valves seat again below 241
  Object.assign(S, { stoker: 0, blower: 0, fire: 0 });
  h.run(sim, T, 300, () => { if (!S.safety) { seated = S.P < 241; return true; } });
  assert.ok(seated, 'valves should seat below 241 psi');
});

/* ------------------------------------------------------------- air brake */
test('a train of empty reservoirs charges from the front back, drawing on the main reservoir', () => {
  const sim = h.load(), T = h.train(sim, 36, { brake: { AR: 0, BP: 0 } }), S = sim.S;
  S.brakeH = 0; S.MR = 140;
  const V = T.vehicles, at = {};
  h.run(sim, T, 1200, (s, t) => {
    V.forEach((v, i) => { if (at[i] === undefined && v.brake.AR > 85) at[i] = t; });
    return at[V.length - 1] !== undefined;
  });
  assert.ok(at[V.length - 1] !== undefined, 'the rear car should charge within 20 minutes');
  assert.ok(at[2] <= at[20] && at[20] <= at[V.length - 1], 'cars charge in order from the engine');
  assert.ok(S.MR < 130, 'charging should draw the main reservoir down');
  assert.ok(S.pumping, 'and start the air pump');
});

test('a full service reduction travels down the train and applies every car without going into emergency', () => {
  const sim = h.load(), T = h.train(sim, 36), S = sim.S;
  h.run(sim, T, 30);
  S.brakeH = 0.89;
  assert.equal(sim.brakeZone(S.brakeH), 'SRV');
  const V = T.vehicles, at = {};
  h.run(sim, T, 60, (s, t) => V.forEach((v, i) => { if (at[i] === undefined && v.brake.BC > 5) at[i] = t; }));
  const rear = V.length - 1;
  assert.ok(at[2] < at[20] && at[20] < at[rear], 'cars apply in order from the engine');
  between(at[rear] - at[2], 2, 20, 'propagation time front to rear (s)');
  between(S.ER, 63, 65, 'equalizing reservoir after a 26 psi reduction (psi)');
  for (const v of V.slice(2)) between(v.brake.BC, 50, 70, 'full service cylinder pressure (psi)');
  assert.ok(!V.some(v => v.brake.emerg), 'a service application must not trip emergency');
  // release: freight cars release directly
  S.brakeH = 0;
  h.run(sim, T, 120);
  for (const v of V.slice(2)) assert.equal(v.brake.BC, 0);
});

test('emergency puts every car into emergency within 3 seconds', () => {
  const sim = h.load(), T = h.train(sim, 36), S = sim.S;
  h.run(sim, T, 10);
  S.brakeH = 1;
  assert.equal(sim.brakeLabel(S.brakeH), 'EMERG');
  h.run(sim, T, 3);
  assert.ok(T.vehicles.every(v => v.brake.emerg));
  for (const v of T.vehicles.slice(2)) between(v.brake.BC, 70, 78, 'emergency cylinder pressure (psi)');
});

test('stopping 36 cars from 40 mph: emergency stops in about half the distance of full service', () => {
  const stop = brakeH => {
    const sim = h.load(), T = h.train(sim, 36), S = sim.S;
    S.indH = 0; S.v = 40 * sim.MPH;
    h.run(sim, T, 5);
    let d = 0; S.brakeH = brakeH;
    h.run(sim, T, 600, () => { d += S.v / 30; return S.v <= 0; });
    assert.equal(S.v, 0, 'train should stop');
    return d;
  };
  const service = stop(0.89), emergency = stop(1);
  between(service, 300, 700, 'full service stopping distance (m)');
  between(emergency, 150, 400, 'emergency stopping distance (m)');
  assert.ok(emergency < service * 0.7);
});

/* ---------------------------------------------------------- dynamics */
test('released on a 0.9% descending grade the train starts to roll, and coasting on the level it slows', () => {
  const sim = h.load(), T = h.train(sim, 10, { grade: -0.009 }), S = sim.S;
  Object.assign(S, { indH: 0, brakeH: 0 });
  h.run(sim, T, 60); const v1 = S.v;
  h.run(sim, T, 60);
  assert.ok(v1 > 0 && S.v > v1, `should pick up speed downhill (${(v1 / sim.MPH).toFixed(1)} -> ${(S.v / sim.MPH).toFixed(1)} mph)`);

  const flat = h.load(), F = h.train(flat, 10);
  Object.assign(flat.S, { indH: 0, brakeH: 0, v: 20 * flat.MPH });
  h.run(flat, F, 60);
  between(flat.S.v / flat.MPH, 10, 19.5, 'speed after coasting a minute from 20 mph');
});

test('the independent brake alone holds a light engine on the grade', () => {
  const sim = h.load(), T = h.train(sim, 0, { grade: -0.009 }), S = sim.S;
  Object.assign(S, { indH: 1, brakeH: 0 });
  h.run(sim, T, 60);
  assert.equal(S.v, 0);
});

/* ------------------------------------------------------------ coupling */
/* a tied-down cut standing in the yard; its end knuckles are open unless closed is set */
function cut(sim, n, kind = 'hopper', closed = false) {
  const X = h.stubConsist(Array.from({ length: n }, () => h.vehicle(kind, h.FREIGHT_CAR, 4, { brake: { AR: 0, BP: 0 } })));
  X.vehicles.forEach(v => { v.hb = true; });
  if (!closed) { X.vehicles[0].kn[0] = sim.KN_OPEN; X.vehicles[n - 1].kn[1] = sim.KN_OPEN; }
  sim.CARS.cuts.push(X);
  return X;
}

for (const [mph, kind, pattern] of [[3, 'good', /^Coupled to 4 cars\./], [6, 'warn', /a bit hard/], [9, 'bad', /Hard coupling at 9 mph/]]) {
  test(`coupling at ${mph} mph joins the cut, conserves momentum and reports "${kind}"`, () => {
    const sim = h.load(), T = h.train(sim, 0), S = sim.S;
    S.v = mph * sim.MPH;
    const X = cut(sim, 4);
    const mT = sim.consistMass(T), mX = sim.consistMass(X);
    sim.CARS.contact(T, 1, { c: X, end: 'rear', facing: true });
    assert.equal(T.vehicles.length, 6);
    assert.equal(sim.CARS.cuts.length, 0);
    assert.equal(T.vehicles[T.li].kind, 'loco', 'li should follow the engine when cars couple ahead of it');
    assert.equal(T.li, 4);
    assert.ok(Math.abs(S.v - mph * sim.MPH * mT / (mT + mX)) < 1e-9, 'momentum is conserved');
    assert.ok(T.vehicles.slice(0, 4).every(v => v.hb === false), 'handbrakes are released on cars we couple to');
    assert.equal(sim.log.toasts.length, 1);
    assert.equal(sim.log.toasts[0].kind, kind);
    assert.match(sim.log.toasts[0].msg, pattern);
    assert.deepEqual(sim.log.derails, []);
  });
}

test('slamming a cut at 12 mph still couples, with a damage warning and no derailment', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = 12 * sim.MPH;
  sim.CARS.contact(T, 1, { c: cut(sim, 4), end: 'rear', facing: true });
  assert.deepEqual(sim.log.derails, []);
  assert.equal(T.vehicles.length, 6);
  assert.match(sim.log.toasts.at(-1).msg, /Slammed into 4 cars at 12 mph/);
});

test('only a real wreck, above 25 mph, derails', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = 26 * sim.MPH;
  sim.CARS.contact(T, 1, { c: cut(sim, 4), end: 'rear', facing: true });
  assert.equal(sim.log.derails.length, 1);
  assert.match(sim.log.derails[0], /26 mph/);
  assert.equal(T.vehicles.length, 2, 'cars stay uncoupled');
});

/* ------------------------------------------------------------ knuckles and shoving */
test('two closed knuckles do not couple: a gentle shove moves the cars off together, momentum conserved', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = 2 * sim.MPH;
  const X = cut(sim, 4, 'hopper', true);
  const mT = sim.consistMass(T), mX = sim.consistMass(X), p0 = mT * S.v;
  sim.CARS.contact(T, 1, { c: X, end: 'rear', facing: true });
  assert.equal(T.vehicles.length, 2, 'not coupled');
  assert.equal(sim.CARS.cuts.length, 1);
  assert.ok(X.rolling, 'the cut is set rolling');
  assert.ok(Math.abs(X.v - S.v) < 1e-9, 'below a walking pace they move off together');
  assert.ok(Math.abs(mT * S.v + mX * X.v - p0) < 1e-6 * p0, 'momentum is conserved');
  assert.match(sim.log.toasts.at(-1).msg, /Both knuckles are closed/);
});

test('a hard shove bounces the cars ahead faster than the engine without making energy', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = 7 * sim.MPH;
  const X = cut(sim, 4, 'hopper', true);
  const mT = sim.consistMass(T), mX = sim.consistMass(X), v0 = S.v;
  sim.CARS.contact(T, 1, { c: X, end: 'rear', facing: true });
  assert.ok(X.v > S.v && S.v > 0, 'cars run ahead of the still-moving engine');
  assert.ok(Math.abs(mT * S.v + mX * X.v - mT * v0) < 1e-6 * mT * v0, 'momentum is conserved');
  assert.ok(mT * S.v ** 2 + mX * X.v ** 2 < mT * v0 ** 2, 'the draft gear soaks up energy');
  assert.deepEqual(sim.log.derails, []);
});

test('a cut hit from the other end is shoved the right way', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = -2 * sim.MPH;
  const X = cut(sim, 3, 'hopper', true);
  sim.CARS.contact(T, -1, { c: X, end: 'rear', facing: true });   // backing, rear to rear: the cut runs off toward its own front
  assert.ok(X.v > 0 && S.v < 0, `cut ${X.v}, train ${S.v}`);
});

test('backing into a tied-down cut with closed knuckles shoves it along the track and never couples or derails', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  const X = cut(sim, 4, 'hopper', true);
  Object.assign(S, { cocks: false, throttle: 0.8, reverser: 1, indH: 0, brakeH: 0.03, v: 3 * sim.MPH });
  let xT = 0, xC = 0.5;
  sim.CARS.limit = (k, d) => ({ d, hit: null });
  X.move = d => { xC += d; return d; };
  let touches = 0;
  h.run(sim, T, 40, () => {
    sim.CARS.step(1 / 30);
    xT += S.v / 30;
    if (xT >= xC) { xT = xC; touches++; sim.CARS.contact(T, 1, { c: X, end: 'rear', facing: true }); }
    S.throttle = Math.abs(S.v) > 4 * sim.MPH ? 0 : 0.8;
  });
  assert.ok(touches > 10, 'engine stays against the cars');
  between(xC - 0.5, 15, 400, 'the cut was shoved (m)');
  assert.equal(T.vehicles.length, 2);
  assert.deepEqual(sim.log.derails, []);
});

test('pulling the pin lifts the cut car\'s knuckle; it shoves while pressed and opens once clear', () => {
  const sim = h.load(), T = h.train(sim, 5), S = sim.S;
  sim.CARS.uncouple(4);
  const c = sim.CARS.cuts[0], e = c.vehicles[0];
  assert.equal(e.kn[0], sim.KN_LIFTED);
  assert.equal(T.vehicles[3].kn[1], sim.KN_CLOSED, 'the train keeps its knuckle closed');
  S.v = 1 * sim.MPH;
  sim.CARS.contact(T, -1, { c, end: 'front', facing: true });
  assert.equal(T.vehicles.length, 4, 'a lifted pin does not couple back while shoving');
  // still touching: stays lifted; parted: swings open
  sim.ctx.carIndex = () => new Map();
  sim.ctx.carAhead = () => ({ d: 0 });
  c.endTP = T.endTP = () => ({});
  sim.CARS.settle();
  assert.equal(e.kn[0], sim.KN_LIFTED);
  sim.ctx.carAhead = () => null;
  sim.CARS.settle();
  assert.equal(e.kn[0], sim.KN_OPEN);
  S.v = -1 * sim.MPH;
  sim.CARS.contact(T, -1, { c, end: 'front', facing: true });
  assert.equal(T.vehicles.length, 7, 'backing in again couples on the open knuckle');
  assert.equal(e.kn[0], sim.KN_CLOSED);
});

test('working the coupler by hand opens a closed knuckle and closes an open one', () => {
  const sim = h.load(), T = h.train(sim, 2);
  sim.ctx.carAhead = () => null; sim.ctx.carIndex = () => new Map();
  const v = T.vehicles[3];
  sim.CARS.knuckle(T, 'rear');
  assert.equal(v.kn[1], sim.KN_OPEN);
  sim.CARS.knuckle(T, 'rear');
  assert.equal(v.kn[1], sim.KN_CLOSED);
});

test('pulling a pin inside a standing cut splits it where it stands', () => {
  const sim = h.load(); h.train(sim, 0);
  const X = cut(sim, 5);
  const [a, b, c, d, e] = X.vehicles;
  sim.CARS.uncouple(2, X);
  assert.deepEqual(X.vehicles, [a, b]);
  const Y = sim.CARS.cuts.at(-1);
  assert.deepEqual(Y.vehicles, [c, d, e]);
  assert.ok(!Y.rolling && Y.vehicles.every(v => v.hb), 'the far half stays tied down');
  assert.equal(c.kn[0], sim.KN_LIFTED);
});

test('backing onto a cut coupler-to-coupler turns its cars to face the train', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = -2 * sim.MPH;
  const X = cut(sim, 3);
  const [a, b, c] = X.vehicles;
  sim.CARS.contact(T, -1, { c: X, end: 'rear', facing: true });
  assert.deepEqual(T.vehicles.slice(2), [c, b, a], 'the cut\'s rear car is now next to the tender');
  assert.ok(T.vehicles.slice(2).every(v => v.flip), 'each car is marked turned');
  assert.ok(S.v < 0 && S.v > -2 * sim.MPH, 'the train keeps backing, slower');
});

test('cars coupled ahead of and behind the engine both pump up from the brake pipe', () => {
  const sim = h.load(), T = h.train(sim, 0), S = sim.S;
  S.v = 2 * sim.MPH;
  sim.CARS.contact(T, 1, { c: cut(sim, 3), end: 'rear', facing: true });
  S.v = -2 * sim.MPH;
  sim.CARS.contact(T, -1, { c: cut(sim, 3), end: 'front', facing: true });
  assert.equal(T.vehicles.length, 8);
  Object.assign(S, { v: 0, brakeH: 0.12, MR: 140 });
  h.run(sim, T, 300);
  for (const v of T.vehicles.filter(v => v.kind === 'hopper')) between(v.brake.AR, 85, 90.5, 'car auxiliary reservoir after 5 minutes (psi)');
});

test('the engine and tender cannot be parted, and a stopped cut is set out with its air dumped', () => {
  const sim = h.load(), T = h.train(sim, 5);
  assert.equal(sim.CARS.canCut(T, 1), false);
  assert.equal(sim.CARS.canCut(T, 2), true);
  sim.CARS.uncouple(4);
  assert.equal(T.vehicles.length, 4);
  const c = sim.CARS.cuts[0];
  assert.equal(c.vehicles.length, 3);
  assert.ok(c.vented && !c.rolling);
  assert.ok(c.vehicles.every(v => v.brake.BP === 0 && v.brake.emerg));
  assert.match(sim.log.toasts.at(-1).msg, /^Cut off 3 cars/);
});

test('pulling the pin on the move kicks the cut free, and it rolls to a stop and is tied down', () => {
  const sim = h.load(), T = h.train(sim, 5), S = sim.S;
  S.v = 6 * sim.MPH;
  sim.CARS.uncouple(4);
  const c = sim.CARS.cuts[0];
  assert.ok(c.rolling && !c.vented, 'a kicked cut rolls with its air');
  assert.equal(c.v, S.v);
  assert.match(sim.log.toasts.at(-1).msg, /rolling free at 6 mph/);
  sim.CARS.limit = (k, d) => ({ d, hit: null });   // open track ahead
  c.move = d => d;
  sim.ctx.carAhead = () => null; sim.ctx.carIndex = () => new Map();   // nothing against the lifted knuckle
  let t = 0, dist = 0;
  for (; t < 600 && c.rolling; t += 1 / 30) { const v = c.v; sim.CARS.step(1 / 30); dist += v / 30; }
  assert.equal(c.v, 0);
  assert.ok(!c.rolling, 'the cut should come to rest');
  assert.ok(c.vehicles.every(v => v.hb), 'and get its handbrakes tied down');
  between(dist, 20, 2000, 'distance the kicked cut rolled (m)');
});

/* ------------------------------------------------------------ changing the engine or train from the menu */
const veh = (kind, len, yard) => Object.assign(h.vehicle(kind, h.FREIGHT_CAR, 4, { len }), yard ? { yard: true } : {});
const lens = V => V.reduce((s, v) => s + v.len, 0);

test('a new engine takes the old one\'s place and every car stays coupled behind it', () => {
  const sim = h.load();
  const old = [veh('loco', 30), veh('tender', 20), veh('box', 15), veh('box', 15), veh('hopper', 11, true)];
  const power = [veh('loco', 22), veh('loco2', 22)];
  const p = sim.CARS.swapPlan(old, power, null);
  assert.deepEqual([...p.vehicles], [...power, ...old.slice(2)]);
  assert.deepEqual([...p.dropped], old.slice(0, 2));
  assert.equal(p.a0, 50, 'the joint behind the tender stays put');
  assert.equal(p.a1, 44, 'and becomes the joint behind the second unit');
  assert.equal(p.length, 44 + 41);
});

test('a new train replaces the cars it came with but keeps the cars picked up in the yard', () => {
  const sim = h.load();
  const ahead = veh('gon', 12, true), own = [veh('coach', 25), veh('coach', 25)], picked = veh('box', 15, true);
  const old = [ahead, veh('loco', 30), veh('tender', 20), ...own, picked];
  const power = [veh('loco', 30), veh('tender', 20)], cars = [veh('box', 15), veh('caboose', 10)];
  const p = sim.CARS.swapPlan(old, power, cars);
  assert.deepEqual([...p.vehicles], [ahead, ...power, ...cars, picked]);
  assert.ok(own.every(v => p.dropped.includes(v)));
  assert.equal(p.a0, 62); assert.equal(p.a1, 62);
  assert.equal(p.length, lens(p.vehicles));
});

test('shoving cars with nothing behind, the engine\'s front coupler is the joint that stays put', () => {
  const sim = h.load();
  const ahead = [veh('box', 15, true), veh('box', 15, true)];
  const p = sim.CARS.swapPlan([...ahead, veh('loco', 30), veh('tender', 20)], [veh('loco', 22)], null);
  assert.equal(p.a0, 30); assert.equal(p.a1, 30);
  const light = sim.CARS.swapPlan([veh('loco', 30), veh('tender', 20)], [veh('loco', 22)], [veh('coach', 25)]);
  assert.equal(light.a0, 50, 'a light engine keeps its rear coupler where it was');
  assert.equal(light.a1, 22);
});
