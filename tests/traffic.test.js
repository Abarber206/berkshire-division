/* Interlocking for AI traffic: signal routes and aspects, route locking. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');

/* 600 m of main into a turnout: the straight leg runs on 600 m, the reverse leg jogs 4.5 m aside into a siding */
function layout(sim) {
  const net = new sim.Network();
  const a = net.edge(new sim.PathBuilder(0, 0, 0).straight(600).pts, { kind: 'main', limit: 60 });
  const b = net.edge(new sim.PathBuilder(600, 0, 0).straight(600).pts, { kind: 'main', limit: 60 });
  const pb = new sim.PathBuilder(600, 0, 0); pb.jog(-4.5, 180); pb.straight(300);
  const c = net.edge(pb.pts, { kind: 'siding', limit: 15 });
  const node = net.node();
  net.attach(a, 1, node); net.attach(b, 0, node); net.attach(c, 0, node);
  const sw = net.addSwitch(node, node.att[0], node.att[1], node.att[2], 'Test East');
  // block signals for eastward moves at a@100 and b@500, one for westward moves on b at 300
  const sig = (e, s, dir) => ({ sg: { dir, kind: 'mast' }, loc: { edge: e, s }, aspect: '' });
  const S1 = sig(a, 100, 1), S2 = sig(b, 500, 1), S3 = sig(b, 300, -1);
  sim.ctx.SCN.signals = [S1, S2, S3];
  return { a, b, c, sw, S1, S2, S3 };
}
function engine(sim) {
  const C = new sim.Consist(null);
  C.update = () => {};
  C.vehicles = [30, 20].map(len => { const v = { len, flip: false, kind: len === 30 ? 'loco' : 'tender' }; v.ptsAll = [3, len - 3].map(loc => ({ loc, a: 0, tp: null, v })); return v; });
  C.layout();
  return C;
}
const aspects = (sim, ...sigs) => sigs.map(s => (s.aspect = sim.signalAspect(s)));

test('a signal governs the track up to the next signal facing the same way', () => {
  const sim = h.load(), L = layout(sim);
  const r = sim.signalRoute(L.S1);
  assert.equal(r.next, L.S2);
  assert.equal(Math.round(r.pieces.reduce((d, p) => d + Math.abs(p.b - p.a), 0)), 500 + 500);
  assert.equal(r.switches.length, 1); assert.equal(r.switches[0], L.sw);
  // the last signal before the end of track has nowhere to go: Approach, so the one behind it shows Clear
  assert.deepEqual(aspects(sim, L.S2, L.S1), ['Approach', 'Clear']);
});

test('a train in the block holds the signal behind it at Stop and the one before that at Approach', () => {
  const sim = h.load(), L = layout(sim), T = engine(sim);
  sim.GAME.train = T;
  T.place(new sim.TrackPos(L.b, 200, 1));
  assert.deepEqual(aspects(sim, L.S1), ['Stop']);
  assert.equal(L.S1.why, 'your train is in the block');
  T.place(new sim.TrackPos(L.b, 560, 1)); sim.IX.idx = null;   // now past S2
  assert.deepEqual(aspects(sim, L.S2, L.S1), ['Stop', 'Approach']);
});

test('a switch reversed for the siding gives a diverging aspect, and holds the trailing move at Stop', () => {
  const sim = h.load(), L = layout(sim);
  L.sw.state = L.sw.anim = 1;
  const r = sim.signalRoute(L.S1);
  assert.equal(r.diverging, true);
  assert.equal(r.pieces[r.pieces.length - 1].e, L.c);
  assert.deepEqual(aspects(sim, L.S1), ['Diverging Approach']);
  // westward on the main, the points are lined for the siding: against the move
  assert.deepEqual(aspects(sim, L.S3), ['Stop']);
  assert.equal(L.S3.why, 'switch not lined');
});

test('points still moving hold the signal at Stop', () => {
  const sim = h.load(), L = layout(sim);
  L.sw.state = 1; L.sw.anim = 0.4;
  assert.deepEqual(aspects(sim, L.S1), ['Stop']);
  L.sw.anim = 1;   // home
  assert.deepEqual(aspects(sim, L.S1), ['Diverging Approach']);
});

test('a route locked for one train holds the signal at Stop for everyone else', () => {
  const sim = h.load(), L = layout(sim);
  const other = { name: 'No. 9', signalsAhead: [] };
  const r = sim.IX.reserve(other, L.b, 0, 300);
  assert.deepEqual(aspects(sim, L.S1), ['Stop']);
  assert.equal(L.S1.why, 'route locked for No. 9');
  sim.IX.unreserve(r);
  // locked for the player's train, which is running up to S1: S1 clears for it
  sim.IX.reserve(sim.IX.PLAYER, L.b, 0, 300);
  sim.IX.PLAYER.signalsAhead = [L.S1];
  assert.notEqual(aspects(sim, L.S1)[0], 'Stop');
  assert.equal(sim.IX.reserved(L.b, 100, 200, null), sim.IX.PLAYER);
  assert.equal(sim.IX.reserved(L.b, 301, 400, null), null, 'only the locked stretch is held');
});

test('the two switches of a crossover lock and unlock together', () => {
  const sim = h.load(), A = layout(sim).sw, B = layout(sim).sw, owner = { name: 'Extra 2210 East' };
  A.mate = B; B.mate = A;
  assert.deepEqual([...sim.swPair(A)], [A, B]);
  sim.IX.take(owner, A); sim.IX.take(owner, B);
  assert.equal(sim.IX.lockedBy(B), owner);
  sim.IX.drop(owner, A);
  assert.equal(sim.IX.lockedBy(A), owner, 'still held through its mate');
  sim.IX.drop(owner, B);
  assert.equal(sim.IX.lockedBy(A), null);
  assert.equal(sim.IX.lockedBy(B), null);
});

test('a route walk follows the switches as they lie to the end of track', () => {
  const sim = h.load(), L = layout(sim);
  const seen = [];
  let w = sim.routeWalk(L.a, 0, 1, 5000, e => { seen.push(e); }, () => {});
  assert.equal(w.why, 'end'); assert.equal(Math.round(w.d), 1200); assert.deepEqual(seen, [L.a, L.b]);
  L.sw.state = 1; seen.length = 0;
  w = sim.routeWalk(L.a, 0, 1, 5000, e => { seen.push(e); }, () => {});
  assert.deepEqual(seen, [L.a, L.c]);
  assert.equal(Math.round(w.d), Math.round(600 + L.c.len));
});

test('each AI train gets an engine from its roster, and about one free-running crew in four is reckless', () => {
  const sim = h.load(), { AI, TRAFFIC, LOCO_SPEC } = sim;
  const seen = new Set(); let reckless = 0, n = 0;
  for (let i = 0; i < 400; i++) for (const id of ['no12', 'x2210']) {
    const base = TRAFFIC[id], d = AI.vary(base, null, false); n++;
    assert.ok(LOCO_SPEC[d.loco], `${d.loco} is an engine`);
    seen.add(d.loco);
    assert.notEqual(base, d, 'the timetable entry itself is left alone');
    if (d.reckless) {
      reckless++;
      assert.ok(d.vmax > base.vmax && d.lim > 1 && d.accel > base.accel, 'a reckless crew runs faster than the track speed and pulls harder');
    } else assert.ok(!d.lim, 'a careful crew keeps to the track speed');
    if (d.loco === '1308') assert.ok(d.vmax <= 45 + (d.reckless ? 25 : 0));
  }
  assert.ok(seen.size >= 5, `only ${[...seen]} turned up`);
  assert.ok(reckless > n * 0.15 && reckless < n * 0.35, `${reckless} of ${n} reckless`);
  for (let i = 0; i < 200; i++) assert.ok(!AI.vary(TRAFFIC.no5, null, true).reckless, 'a job keeps to its timetable: no reckless crews');
  // a save brings back the same engine and crew
  const d = AI.vary(TRAFFIC.x2210, { loco: 'diesel', units: 3, livery: 'prr', reckless: 1 });
  assert.equal(d.loco, 'diesel'); assert.equal(d.units, 3); assert.equal(d.livery, 'prr'); assert.ok(d.reckless);
});

test('free running fills every route but Raven Lake, and a phone runs the lighter timetable', () => {
  const sim = h.load(), { AI, TRAFFIC, MTN_TRAFFIC, FREE_TRAFFIC } = sim, W = sim.ctx.WORLD;
  for (const [id] of [...FREE_TRAFFIC, ...MTN_TRAFFIC]) assert.ok(TRAFFIC[id], `${id} is in the timetable`);
  assert.equal(AI.list(false).length, 7); assert.equal(AI.list(true).length, 4);
  W.mtn = true;
  assert.equal(AI.list(false).length, 5); assert.equal(AI.list(true).length, 3);
  for (const [id] of AI.list(false)) assert.ok(TRAFFIC[id].mtn, `${id} runs over the mountain`);
  W.frost = true;
  assert.equal(AI.list(false).length, 0, 'Raven Lake is yours alone');
  W.mtn = W.frost = false;
  // each way on both routes
  for (const L of [FREE_TRAFFIC, MTN_TRAFFIC]) for (const dir of [1, -1]) assert.ok(L.filter(([id]) => TRAFFIC[id].dir === dir).length >= 2);
});

test('the loaded coal over the mountain gets a pusher, and it comes back the same from a save', () => {
  const sim = h.load(), { AI, TRAFFIC, LOCO_SPEC } = sim, seen = new Set();
  for (let i = 0; i < 200; i++) {
    const d = AI.vary(TRAFFIC.m92, null, false);
    assert.ok(d.push && LOCO_SPEC[d.push.loco], 'a pusher on the rear'); seen.add(d.push.loco);
    if (d.push.loco === 'diesel') assert.equal(d.push.units, 2);
    assert.ok(LOCO_SPEC[d.loco]);
    assert.ok(!AI.vary(TRAFFIC.m90, null, false).push, 'the empties go up without one');
  }
  assert.ok(seen.size >= 2, `pushers seen: ${[...seen]}`);
  const d = AI.vary(TRAFFIC.m92, { loco: 'diesel', units: 3, livery: 'nw', push: { loco: '1308', units: 1 } });
  assert.equal(d.push.loco, '1308');
});

test('up a heavy grade a freight slows to its climbing speed (faster with a pusher), and holds back going down', () => {
  const sim = h.load(), { AITrain, TRAFFIC } = sim;
  const cap = (def, grade) => AITrain.prototype.gradeCap.call({ def, grade });
  const fr = TRAFFIC.m93, coal = Object.assign({}, TRAFFIC.m92, { push: { loco: 'diesel', units: 2 } }), pass = TRAFFIC.m21;
  assert.ok(cap(fr, 0) > 100, 'level track: no grade limit');
  assert.ok(cap(fr, 0.019) < 25 && cap(fr, 0.019) >= 10, `merchandise up 1.9%: ${cap(fr, 0.019)}`);
  assert.ok(cap(fr, 0.01) > cap(fr, 0.019), 'an easier grade, a faster climb');
  assert.ok(cap(coal, 0.019) > cap(Object.assign({}, coal, { push: null }), 0.019), 'the pusher helps');
  assert.ok(cap(pass, 0.019) > cap(fr, 0.019), 'a passenger train climbs faster than a freight');
  assert.ok(cap(fr, -0.019) < 30 && cap(pass, -0.019) > cap(fr, -0.019), 'held back downhill');
});
