/* Cars shared in a multiplayer room: two games wired together the way the relay joins them, each seeing the
   other's coupling, cutting off, knuckles, kicked cars and placed cars. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* a 600 m yard track, the same in both games (so the edge ids match, as on a real route) */
function railroad(sim) {
  const net = new sim.Network();
  const yard = net.edge(new sim.PathBuilder(0, 0, 0).straight(600).pts, { kind: 'yard' });
  sim.ctx.NET = net;
  sim.ctx.ROUTE = { lines: {}, stations: [] };
  sim.CARS.geo = { tg: {}, a6: {}, a4: {} };
  return { net, yard };
}
/* a 15 m car as a game builds it from its token */
function car(sim, k = { type: 'box', num: 0, rs: 'NKP' }) {
  return { kind: k.type, len: 15, frame: [2, 13], trucks: [], mass: (k.tons || 65) * sim.STON, axles: 4, area: 105, brakeA: 0.5, root: h.Anything(),
    brake: { AR: 0, BC: 0, BP: 0, emerg: false, released: true }, kn: [0, 0], made: { type: k.type, num: k.num, rs: k.rs } };
}
/* a 765 and tender as the player's train, 30 m and 20 m */
function engine(sim) {
  const T = new sim.Consist(null);
  Object.assign(T, { update() {}, buildInstances() {}, inst: [], scene: sim.ctx.scene, tenderEmpty: 92000, locoKey: '765' });
  T.vehicles = [['loco', 30], ['tender', 20]].map(([kind, len]) => { const v = { kind, len, flip: false, mass: 200000, kn: [0, 0], brake: { AR: 90, BC: 0, BP: 90 } }; v.ptsAll = [3, len - 3].map(loc => ({ loc, a: 0, tp: null, v })); v.fp = v.ptsAll; return v; });
  T.layout();
  sim.GAME.train = T;
  return T;
}
/* two players in one room: a (lower id, made the room) and b, with the relay between them */
function room() {
  const ids = ['aaaaaa', 'bbbbbb'], wire = [];
  const games = ids.map((id, i) => {
    const sim = h.load(), y = railroad(sim);
    Object.assign(sim.ctx.MP, { on: true, id, topic: 'bdiv/v1/TEST', links: [], peers: new Map(), edges: new Map(y.net.edges.map(e => [e.id, e])), lag: () => 0, dirty: false });
    sim.MPC.makeCar = k => Object.assign(car(sim, k), { flip: k.flip });
    sim.MPC.send = o => { o.id = id; wire.push([i, JSON.stringify(o)]); };
    Object.assign(sim.GAME, { running: true });
    return { sim, y, id };
  });
  games[0].sim.ctx.MP.peers.set(ids[1], { id: ids[1], st: { cs: 0 } });
  games[1].sim.ctx.MP.peers.set(ids[0], { id: ids[0], st: { cs: 1 } });
  /* run both games for ms milliseconds of wall clock, delivering every message as it is sent */
  const run = (ms = 200, step = 50) => {
    for (let t = 0; t < ms; t += step) {
      for (const g of games) { g.sim.ctx.__now += step; g.sim.MPC.tick(); }
      while (wire.length) { const [from, txt] = wire.shift(); games[1 - from].sim.MPC.onText(txt); }
    }
  };
  return { a: games[0], b: games[1], run, wire };
}
const fronts = sim => [...sim.CARS.cuts.map(c => +c.endTP('front').s.toFixed(2))].sort((x, y) => x - y);
const cutOf = (sim, mid) => sim.CARS.cuts.find(c => c.mid === mid);

test('a car token says what the car is and reads back the same', () => {
  const sim = h.load();
  const v = Object.assign(car(sim, { type: 'tank', num: 21047, rs: 'S&S', tons: 30 }), { flip: true });
  const t = sim.carToken(v);
  assert.equal(t, '~tank.21047.S&S.0..30');
  const k = sim.carTokenIn(t);
  assert.deepEqual({ ...k }, { flip: true, type: 'tank', num: 21047, rs: 'S&S', flag: false, tr: '', rk: '', tons: 30 });
  assert.equal(sim.carTokenIn('coach.3010.PM.1p.1225.82').tr, 'polar');   // a coach in the holiday trim
  assert.equal(sim.carTokenIn('coach.3010.PM.1x.1225.82'), null);
  for (const bad of ['locomotive.1.NKP.0..60', 'box.1.<b>.0..60', 'box.x.NKP.0..60', 'box.1.NKP.0', 'box.1.NKP.0..9999']) assert.equal(sim.carTokenIn(bad), null, bad);
});

test('the train as a list: the engine by its own vehicles, the cars by what they are', () => {
  const sim = h.load(), y = railroad(sim), T = engine(sim);
  const a = car(sim, { type: 'box', num: 1, rs: 'NKP' }), b = Object.assign(car(sim, { type: 'hopper', num: 2, rs: 'PM' }), { flip: true });
  T.track(a); T.track(b);
  T.vehicles = [a, ...T.vehicles, b]; T.layout();
  assert.equal(sim.trainCode(T), 'box.1.NKP.0..65,#0,#1,~hopper.2.PM.0..65');
  void y;
});

test('a newcomer sees the cars standing where the room has them, knuckles and all', () => {
  const r = room(), { a, b } = r;
  // a has been switching on their own: two cars on the yard track, one knuckle open
  const c = new a.sim.Cut(a.sim.ctx.scene, [car(a.sim, { type: 'box', num: 11, rs: 'NKP' }), car(a.sim, { type: 'gon', num: 12, rs: 'NKP' })]);
  c.place(new a.sim.TrackPos(a.y.yard, 300, 1)); c.vehicles[0].kn = [a.sim.KN_OPEN, 0]; c.vehicles[1].hb = true;
  a.sim.CARS.cuts.push(c);
  a.sim.MPC.join(true);
  b.sim.MPC.join(false);
  r.run(2000);
  assert.equal(b.sim.MPC.synced, true);
  assert.equal(b.sim.CARS.cuts.length, 1);
  const bc = b.sim.CARS.cuts[0];
  assert.equal(bc.mid, c.mid);
  assert.equal(bc.vehicles.map(v => v.made.type).join(), 'box,gon');
  assert.deepEqual(fronts(b.sim), [300]);
  assert.deepEqual([...bc.vehicles[0].kn], [a.sim.KN_OPEN, 0]);
  assert.equal(bc.vehicles[1].hb, true);
});

test('coupling up takes the cars off the railroad for everyone, and cutting them off puts them back where they stand', () => {
  const r = room(), { a, b } = r, S = a.sim;
  const c = new S.Cut(S.ctx.scene, [car(S, { type: 'box', num: 11, rs: 'NKP' }), car(S, { type: 'box', num: 12, rs: 'NKP' })]);
  c.place(new S.TrackPos(a.y.yard, 300, 1)); c.vehicles[0].kn = [S.KN_OPEN, S.KN_OPEN]; c.vehicles[1].kn = [S.KN_OPEN, S.KN_OPEN];
  S.CARS.cuts.push(c);
  S.MPC.join(true); b.sim.MPC.join(false);
  r.run(2000);
  assert.equal(b.sim.CARS.cuts.length, 1);
  // a's engine backs onto the cut at 2 mph and couples
  const T = engine(S);
  T.place(new S.TrackPos(a.y.yard, 350.5, 1));   // facing away: the tender end is toward the cars, half a metre off
  S.S.v = -2 * S.MPH;
  const lim = S.CARS.limit(T, -1);
  assert.ok(lim.hit && lim.hit.c === c, 'the cut is behind the tender');
  S.CARS.contact(T, -1, lim.hit);
  assert.equal(S.CARS.cuts.length, 0, 'coupled into a\'s train');
  assert.equal(T.vehicles.length, 4);
  r.run(300);
  assert.equal(b.sim.CARS.cuts.length, 0, 'gone from b\'s railroad too');
  assert.match(S.trainCode(T), /^#0,#1,box\.\d+\.NKP.*,box\.\d+\.NKP/);
  // a stops and pulls the pin behind the first car: the last car stands where it was cut off, for both
  S.S.v = 0;
  S.CARS.uncouple(3);
  assert.equal(S.CARS.cuts.length, 1);
  const off = S.CARS.cuts[0], at = +off.endTP('front').s.toFixed(2);
  r.run(300);
  assert.equal(b.sim.CARS.cuts.length, 1);
  assert.equal(b.sim.CARS.cuts[0].mid, off.mid);
  assert.deepEqual(fronts(b.sim), [at]);
  // the cut lever left that car's knuckle lifted, and b sees it so
  const kb = b.sim.endCoupler(b.sim.CARS.cuts[0], 'front'), ka = S.endCoupler(off, 'front');
  assert.equal(kb.v.kn[kb.k], ka.v.kn[ka.k]);
  assert.equal(ka.v.kn[ka.k], S.KN_LIFTED);
});

test('working a knuckle on someone else\'s cars makes them yours, and the change reaches the room', () => {
  const r = room(), { a, b } = r;
  const c = new a.sim.Cut(a.sim.ctx.scene, [car(a.sim)]);
  c.place(new a.sim.TrackPos(a.y.yard, 200, 1));
  a.sim.CARS.cuts.push(c);
  a.sim.MPC.join(true); b.sim.MPC.join(false);
  r.run(2000);
  const bc = b.sim.CARS.cuts[0];
  assert.equal(b.sim.CARS.driven(bc), true, 'a\'s cars: b only draws them until b does something to them');
  const before = b.sim.MPC.recs.get(bc.mid).n;
  b.sim.CARS.knuckle(bc, 'front');
  r.run(300);
  const rec = a.sim.MPC.recs.get(c.mid);
  assert.equal(rec.o, 'bbbbbb');
  assert.equal(rec.n, before + 1);
  const ea = a.sim.endCoupler(cutOf(a.sim, c.mid), 'front');
  assert.equal(ea.v.kn[ea.k], b.sim.KN_LIFTED);
});

test('a kicked cut rolls on in the other game as its owner reports it', () => {
  const r = room(), { a, b } = r;
  const c = new a.sim.Cut(a.sim.ctx.scene, [car(a.sim), car(a.sim)]);
  c.place(new a.sim.TrackPos(a.y.yard, 200, 1));
  a.sim.CARS.cuts.push(c);
  a.sim.MPC.join(true); b.sim.MPC.join(false);
  r.run(2000);
  // a lets it roll away at 3 m/s, no brakes
  c.v = 3; c.rolling = true; c.vehicles.forEach(v => { v.hb = false; });
  for (let i = 0; i < 40; i++) {
    for (let k = 0; k < 6; k++) a.sim.CARS.step(1 / 120);
    r.run(50);
  }
  const bc = cutOf(b.sim, c.mid);
  assert.equal(b.sim.CARS.driven(bc), true, 'b only draws it');
  const sa = c.endTP('front').s, sb = bc.endTP('front').s;
  assert.ok(sa > 205, 'it rolled');
  assert.ok(Math.abs(sa - sb) < 0.6, `b has it ${sb.toFixed(2)} m, a ${sa.toFixed(2)} m`);
});

test('two players coupling to the same cars at the same moment: the lower id keeps them', () => {
  const r = room(), { a, b } = r;
  const c = new a.sim.Cut(a.sim.ctx.scene, [car(a.sim)]);
  c.place(new a.sim.TrackPos(a.y.yard, 200, 1));
  a.sim.CARS.cuts.push(c);
  a.sim.MPC.join(true); b.sim.MPC.join(false);
  r.run(2000);
  // both pick the car up into their train before hearing from the other
  for (const g of [a, b]) {
    const S = g.sim, T = engine(S), k = cutOf(S, c.mid);
    T.vehicles = [...T.vehicles, ...k.vehicles]; T.layout(); T.place(new S.TrackPos(g.y.yard, 400, 1));
    S.CARS.cuts = S.CARS.cuts.filter(x => x !== k);
  }
  r.run(500);
  assert.equal(a.sim.GAME.train.vehicles.length, 3, 'a (the lower id) keeps the car');
  assert.equal(b.sim.GAME.train.vehicles.length, 2, 'b gives it up');
  assert.equal(a.sim.CARS.cuts.length + b.sim.CARS.cuts.length, 0, 'and it is not left standing anywhere');
});

test('records are ordered by version, then by owner', () => {
  const sim = h.load();
  assert.equal(sim.mpcBeats({ n: 2, o: 'b', q: 0 }, { n: 1, o: 'a', q: 9 }), true);
  assert.equal(sim.mpcBeats({ n: 1, o: 'b', q: 9 }, { n: 2, o: 'a', q: 0 }), false);
  assert.equal(sim.mpcBeats({ n: 2, o: 'a', q: 5 }, { n: 2, o: 'a', q: 4 }), true, 'the owner\'s later report');
  assert.equal(sim.mpcBeats({ n: 2, o: 'a', q: 1 }, { n: 2, o: 'b', q: 9 }), true, 'the lower id at the same version');
  assert.equal(sim.mpcBeats({ n: 2, o: 'b', q: 9 }, { n: 2, o: 'a', q: 1 }), false);
});

test('a record that does not make sense is dropped', () => {
  const r = room(), { b } = r;
  b.sim.MPC.join(false);
  const C = b.sim.MPC.clean;
  const ok = { k: 'aaaaaa.1', n: 1, o: 'aaaaaa', q: 1, c: ['box.1.NKP.0..65:000'], f: [0, 100, 1], v: 0 };
  assert.ok(C(ok));
  assert.equal(C({ ...ok, c: ['box.1.NKP.0..65'] }), null, 'no knuckles');
  assert.equal(C({ ...ok, c: ['bomb.1.NKP.0..65:000'] }), null, 'no such car');
  assert.equal(C({ ...ok, f: [99, 100, 1] }), null, 'no such track');
  assert.equal(C({ ...ok, k: '<x>' }), null);
  assert.equal(C({ ...ok, c: Array(500).fill('box.1.NKP.0..65:000') }), null, 'too many cars');
  assert.equal(C(ok).s, 100);
  assert.equal(C({ ...ok, f: [0, 9e9, 1] }).s, 600, 'clamped to the track');
});
