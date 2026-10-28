/* Placing the train and single cars on the track by hand. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* a 400 m yard track with a bumper at each end, and a turnout: a 200 m trunk into points with a straight
   normal leg and a leg that jogs 4.5 m aside (radius 180 m), as on the yard ladders */
function railroad(sim) {
  const net = new sim.Network();
  const yard = net.edge(new sim.PathBuilder(0, 500, 0).straight(400).pts, { kind: 'yard' });
  const trunk = net.edge(new sim.PathBuilder(0, 0, 0).straight(200).pts, { kind: 'yard' });
  const normal = net.edge(new sim.PathBuilder(200, 0, 0).straight(200).pts, { kind: 'yard' });
  const b = new sim.PathBuilder(200, 0, 0); b.jog(-4.5, 180); b.straight(140);
  const reverse = net.edge(b.pts, { kind: 'yard' });
  const node = net.node();
  net.attach(trunk, 1, node); net.attach(normal, 0, node); net.attach(reverse, 0, node);
  const sw = net.addSwitch(node, node.att[0], node.att[1], node.att[2], 'Yard ladder E3');
  sim.ctx.NET = net;
  sim.CARS.geo = { tg: {}, a6: {}, a4: {} };
  return { yard, trunk, normal, reverse, sw };
}
/* a 15 m box car with its trucks 2 m in from each end */
function car(sim, kind = 'box', len = 15) {
  return { kind, len, frame: [2, len - 2], trucks: [], mass: h.FREIGHT_CAR, axles: 4, area: 105, brakeA: 0.5, root: h.Anything(),
    brake: { AR: 0, BC: 0, BP: 0, emerg: false, released: true }, kn: [0, 0] };
}
const cut = (sim, n, len) => new sim.Cut(sim.ctx.scene, [...Array(n)].map(() => car(sim, 'box', len)));
/* stand a cut with its front coupler at s on edge e facing +s, the way the yard is made up */
function spot(sim, c, e, s) {
  const f = sim.PLACE.fit(c, new sim.TrackPos(e, s, 1));
  assert.ok(f.ok, 'spotted: ' + f.why);
  return sim.PLACE.commit(c, f);
}
/* a 765 and tender as the player's train, 30 m and 20 m, a pivot 3 m in from each end */
function engine(sim) {
  const T = new sim.Consist(null);
  Object.assign(T, { update() {}, buildInstances() {}, inst: [], scene: sim.ctx.scene, tenderEmpty: 92000, locoKey: '765' });
  T.vehicles = [['loco', 30], ['tender', 20]].map(([kind, len]) => { const v = { kind, len, flip: false, mass: 200000, kn: [0, 0], brake: { AR: 90, BC: 0, BP: 90 } }; v.ptsAll = [3, len - 3].map(loc => ({ loc, a: 0, tp: null, v })); v.fp = v.ptsAll; return v; });
  T.layout();
  sim.GAME.train = T;
  return T;
}

test('a car set down on open track stands there tied down, with both knuckles open', () => {
  const sim = h.load(), y = railroad(sim), c = cut(sim, 1);
  const got = spot(sim, c, y.yard, 200);
  assert.equal(got, c);
  assert.equal(sim.CARS.cuts.length, 1);
  assert.equal(Math.round(c.endTP('front').s), 200);
  assert.equal(Math.round(c.endTP('rear').s), 185);
  assert.equal(c.vehicles[0].hb, true, 'handbrake tied');
  assert.deepEqual(c.vehicles[0].kn, [sim.KN_OPEN, sim.KN_OPEN]);
});

test('a car set down close to a standing cut slides up and couples to it, from either side', () => {
  const sim = h.load(), y = railroad(sim);
  const a = cut(sim, 2); spot(sim, a, y.yard, 200);           // couplers at 200 and 170
  // 3 m short of the cut's rear coupler
  const b = cut(sim, 1), f = sim.PLACE.fit(b, new sim.TrackPos(y.yard, 167, 1));
  assert.ok(f.ok);
  assert.ok(Math.abs(f.F.s - 170) < 0.01, 'slid forward onto the coupler');
  assert.equal(f.joins.length, 1);
  sim.PLACE.commit(b, f);
  assert.equal(sim.CARS.cuts.length, 1, 'one cut of three');
  assert.equal(sim.CARS.cuts[0].vehicles.length, 3);
  // overlapping the front of the cut by 2 m: backed off onto the coupler
  const c = cut(sim, 1), g = sim.PLACE.fit(c, new sim.TrackPos(y.yard, 213, 1));
  assert.ok(g.ok);
  assert.ok(Math.abs(g.R.s - 200) < 0.01);
  sim.PLACE.commit(c, g);
  assert.equal(sim.CARS.cuts.length, 1);
  const k = sim.CARS.cuts[0];
  assert.equal(k.vehicles.length, 4);
  assert.ok(Math.abs(k.length - 60) < 1e-6);
  // the coupled joints are closed and the two ends of the cut open
  assert.equal(sim.endCoupler(k, 'front').v.kn[sim.endCoupler(k, 'front').k], sim.KN_OPEN);
  assert.equal(sim.endCoupler(k, 'rear').v.kn[sim.endCoupler(k, 'rear').k], sim.KN_OPEN);
});

test('a car set down more than a snap away stands on its own', () => {
  const sim = h.load(), y = railroad(sim);
  spot(sim, cut(sim, 2), y.yard, 200);
  const b = cut(sim, 1), f = sim.PLACE.fit(b, new sim.TrackPos(y.yard, 170 - sim.PLACE_SNAP - 1, 1));
  assert.ok(f.ok);
  assert.equal(f.joins.length, 0);
  sim.PLACE.commit(b, f);
  assert.equal(sim.CARS.cuts.length, 2);
});

test('a car cannot be set down on top of another one', () => {
  const sim = h.load(), y = railroad(sim), a = cut(sim, 3, 20);
  spot(sim, a, y.yard, 200);                                    // 140 to 200
  const b = cut(sim, 1, 12), f = sim.PLACE.fit(b, new sim.TrackPos(y.yard, 180, 1));
  assert.equal(f.ok, false);
  assert.equal(f.why, 'clash');
  assert.equal(f.hit, a);
  assert.equal(sim.PLACE.commit(b, f), null);
  assert.equal(sim.CARS.cuts.length, 1);
});

test('a car set down at the end of the track slides on to the rails, and a car longer than the track will not go', () => {
  const sim = h.load(), y = railroad(sim), c = cut(sim, 1);
  const f = sim.PLACE.fit(c, new sim.TrackPos(y.yard, 5, 1));     // rear would be 10 m past the bumper
  assert.ok(f.ok);
  assert.ok(Math.abs(f.R.s) < 1e-6 && Math.abs(f.F.s - 15) < 1e-6);
  const net = new sim.Network(), stub = net.edge(new sim.PathBuilder(0, 900, 0).straight(12).pts, { kind: 'yard' });
  const g = sim.PLACE.fit(cut(sim, 1), new sim.TrackPos(stub, 12, 1));
  assert.equal(g.ok, false);
  assert.equal(g.why, 'short');
});

test('a car over the points has to be on the route the switch is lined for, and then fouls it', () => {
  const sim = h.load(), y = railroad(sim);
  // front on the diverging leg, rear back on the trunk, switch lined straight
  const c = cut(sim, 1), f = sim.PLACE.fit(c, new sim.TrackPos(y.reverse, 6, 1));
  assert.equal(f.ok, false);
  assert.equal(f.why, 'points');
  assert.equal(f.line.length, 1);
  assert.equal(f.line[0].sw, y.sw);
  assert.equal(f.line[0].li, 1, 'needs the diverging leg');
  y.sw.state = 1;
  const g = sim.PLACE.fit(c, new sim.TrackPos(y.reverse, 6, 1));
  assert.ok(g.ok, g.why);
  assert.equal(g.fouls.length, 1);
  assert.equal(g.fouls[0], y.sw);
  sim.PLACE.commit(c, g);
  assert.equal(sim.CARS.occupied(y.sw), true, 'the placed car holds the switch');
});

test('a car pointed at on the diverging leg stays on that leg even with its front out over the points', () => {
  const sim = h.load(), y = railroad(sim), c = cut(sim, 1);
  // the middle of the car 4 m out along the diverging leg, its front toward the points; the switch lined straight
  const mid = new sim.TrackPos(y.reverse, 4, -1), via = sim.PLACE.against(mid, 7.5), front = mid.clone();
  front.advance(7.5, null);
  assert.equal(via.length, 1);
  const f = sim.PLACE.fit(c, front, c, via);
  assert.equal(f.why, 'points');
  assert.equal(f.line[0].sw, y.sw);
  assert.equal(f.line[0].li, 1);
  assert.equal(c.endTP('rear').e, y.reverse, 'laid back along the leg pointed at');
  assert.equal(y.sw.state, 0, 'the switch itself is left alone');
  y.sw.state = 1;
  assert.ok(sim.PLACE.fit(c, f.F).ok);
});

test('cars on the two legs near the points touch; back of the fouling point they clear', () => {
  const sim = h.load(), y = railroad(sim);
  spot(sim, cut(sim, 1), y.normal, 30);                        // 15 to 30 m past the points
  const near = sim.PLACE.fit(cut(sim, 1), new sim.TrackPos(y.reverse, 30, 1));
  assert.equal(near.ok, false, 'side by side inside the fouling point');
  assert.equal(near.why, 'clash');
  const far = sim.PLACE.fit(cut(sim, 1), new sim.TrackPos(y.reverse, 70, 1));
  assert.ok(far.ok, far.why);
});

test('the train set down against a cut couples it on, and stands still', () => {
  const sim = h.load(), y = railroad(sim);
  spot(sim, cut(sim, 2), y.yard, 150);                          // cars 120 to 150
  const T = engine(sim); T.place(new sim.TrackPos(y.trunk, 100, 1));
  sim.S.v = 3;
  const f = sim.PLACE.fit(T, new sim.TrackPos(y.yard, 202, 1));  // tender's rear coupler 2 m clear of the cars
  assert.ok(f.ok, f.why);
  assert.ok(Math.abs(f.R.s - 150) < 0.01);
  sim.PLACE.commit(T, f);
  assert.equal(T.vehicles.length, 4);
  assert.equal(sim.CARS.cuts.length, 0);
  assert.equal(sim.S.v, 0);
  assert.equal(T.vehicles[3].hb, false, 'handbrakes released on cars coupled to the train');
});

test('lifting a car out of the middle of a cut leaves two cuts, and putting it back couples all three again', () => {
  const sim = h.load(), y = railroad(sim), a = cut(sim, 3);
  spot(sim, a, y.yard, 200);
  const mid = a.vehicles[1], back = sim.PLACE.frontOf(a, mid);
  assert.ok(Math.abs(back.s - 185) < 1e-6);
  const g = sim.PLACE.split(a, mid);
  assert.equal(sim.CARS.cuts.length, 2);
  assert.ok(!sim.CARS.cuts.includes(g), 'the lifted car is off the railroad');
  assert.ok(sim.CARS.cuts.every(c => c.vehicles.length === 1));
  const f = sim.PLACE.fit(g, back);
  assert.ok(f.ok, f.why);
  assert.equal(f.joins.length, 2);
  sim.PLACE.commit(g, f);
  assert.equal(sim.CARS.cuts.length, 1);
  assert.equal(sim.CARS.cuts[0].vehicles.length, 3);
});

test('a car turned end for end stands on the same track the other way round', () => {
  const sim = h.load(), y = railroad(sim), c = cut(sim, 1);
  spot(sim, c, y.yard, 200);
  sim.CARS.cuts = [];
  const t = sim.PLACE.turned(c), f = sim.PLACE.fit(c, t);
  assert.ok(f.ok);
  sim.PLACE.commit(c, f);
  assert.equal(c.endTP('front').o, -1);
  assert.ok(Math.abs(c.endTP('front').s - 185) < 1e-6 && Math.abs(c.endTP('rear').s - 200) < 1e-6);
});

test('AI trains are never coupled to, and a car keeps clear of them', () => {
  const sim = h.load(), y = railroad(sim), ai = cut(sim, 2);
  ai.place(new sim.TrackPos(y.yard, 300, 1)); ai.ai = { name: 'No. 5' };
  sim.AI.trains.push({ train: ai });
  const f = sim.PLACE.fit(cut(sim, 1), new sim.TrackPos(y.yard, 267, 1));   // 3 m short of it: no snap
  assert.equal(f.ok, true);
  assert.equal(f.joins.length, 0);
  assert.ok(Math.abs(f.F.s - 267) < 1e-6);
  const g = sim.PLACE.fit(cut(sim, 1), new sim.TrackPos(y.yard, 269.5, 1));
  assert.equal(g.ok, false);
  assert.equal(g.hit, ai);
});
