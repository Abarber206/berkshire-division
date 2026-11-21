/* Raven Lake: the winter night loop, its cliff grade down to the frozen lake, the track across the ice and
   the ground under it. Builds the route and terrain with the real three.js (no page or GPU).
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '03c_mountain.js', '03d_frost.js', '04_world.js', '04b_mountain.js', '04d_frost.js', '10n_ice.js'];
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

let W = null;
function frost() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=frost' },
    document: { createElement: () => ({ getContext: () => null }), getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    WORLD.roadsX = []; WORLD.roadN = 1e7; buildFrostRoute(); frPrepare(); buildLattice(); prepareSwitchData();
    var S = { v: 0, vw: 0, throttle: 0, reverser: 0, derailed: false }, GAME = { derail(why) { S.derailed = why; } }, AU = { on: false };
    var toast = () => {}, sndClunk = () => {}, camera = { position: new THREE.Vector3() };
    iceStar = () => {}; iceSkateHud = () => {}; iceSkatePads = () => {};
    ({ ROUTE, ROUTES, ROUTE_KEY, NET, FROST, WORLD, MILE, ICE_RAIL, groundH, latticeAt, naturalH, frInPoly, THREE, TrackPos, S,
       skate: { ICE, iceSkateEdge, iceSkate, iceSkateAim } })`;
  return (W = vm.runInContext(code, ctx, { filename: 'frost.js' }));
}
const y = (m, s) => { const l = m.locate(s); return l.edge.elev(l.s); };

test('Raven Lake is a closed loop of about ten miles that joins up smoothly', { skip: SKIP }, () => {
  const { ROUTE, ROUTES, ROUTE_KEY, WORLD, MILE } = frost(), m = ROUTE.main;
  assert.ok(ROUTES.frost && WORLD.frost && WORLD.mtn);
  assert.ok(m.loop, 'the main line is a loop');
  assert.ok(m.len / MILE > 9 && m.len / MILE < 11, `${(m.len / MILE).toFixed(2)} mi`);
  // a metre short of the end is a metre short of the start
  const a = m.poseAt(0), b = m.poseAt(m.len - 1), gap = Math.hypot(a.X - b.X, a.N - b.N);
  assert.ok(Math.abs(gap - 1) < 0.05, `the last metre is ${gap.toFixed(3)} m long`);
  const dh = Math.abs(((b.h - a.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  assert.ok(dh < 0.01, `closes with a ${(dh * 180 / Math.PI).toFixed(2)} degree kink`);
  assert.ok(Math.abs(y(m, 0) - y(m, m.len - 1)) < 0.3, 'and at the same height');
});

test('the cliff grade is a real 4 per cent drop, and the climb back out is gentle', { skip: SKIP }, () => {
  const { ROUTE, FROST } = frost(), m = ROUTE.main;
  const g = (s0, s1) => { let worst = 0; for (let s = s0; s + 100 <= s1; s += 20) worst = Math.max(worst, Math.abs(y(m, s + 100) - y(m, s)) / 100); return worst; };
  const dn = g(FROST.cliff[0], FROST.cliff[1]), up = g(FROST.climb[0], FROST.climb[1]);
  assert.ok(dn > 0.036 && dn <= 0.0412, `descent ${(dn * 100).toFixed(2)}%`);
  assert.ok(up <= 0.0152, `climb ${(up * 100).toFixed(2)}%`);
  const drop = y(m, 0) - y(m, FROST.sIce[0]);
  assert.ok(drop > 80, `the plateau stands ${drop.toFixed(0)} m over the lake`);
  assert.ok(g(0, m.len) <= 0.0412, 'nothing on the loop is steeper than the cliff');
});

test('the track crosses the lake on the ice: inside the shore, flat, and with no superelevation', { skip: SKIP }, () => {
  const { ROUTE, FROST, ICE_RAIL, frInPoly } = frost(), m = ROUTE.main, [s0, s1] = FROST.sIce;
  assert.ok(s1 - s0 > 1500, `${(s1 - s0).toFixed(0)} m on the ice`);
  for (let s = s0; s <= s1; s += 20) {
    const l = m.locate(s), [X, N] = l.edge.xz(l.s);
    assert.ok(frInPoly(FROST.lake, X, N) || FROST.river, `out on the lake at ${s.toFixed(0)} m`);
    assert.ok(Math.abs(l.edge.elev(l.s) - (FROST.iceY + ICE_RAIL)) < 0.02, `rail sits on the ice at ${s.toFixed(0)} m`);
    assert.ok(l.edge.isIce(l.s), 'the edge knows it is on ice');
    assert.ok(Math.abs(l.edge.cant(l.s)) < 1e-3, `no cant at ${s.toFixed(0)} m`);
  }
});

test('the ground carries the track off the ice, the cliff stands over the shelf and falls to the lake', { skip: SKIP }, () => {
  const { ROUTE, NET, FROST, groundH, latticeAt, naturalH } = frost(), bad = [];
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 25) {
    if (e.isBridge(s) || e.isIce(s)) continue;
    const [X, N] = e.xz(s), d = groundH(X, N, latticeAt(X, N)) - (e.elev(s) - 0.95);
    if (Math.abs(d) > 0.3) bad.push(`${e.line ? e.line.name : '?'} ${Math.round((e.lineS0 || 0) + s)} m: ground ${d.toFixed(2)} m off subgrade`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
  // halfway down the cliff: rock rising steeply on the uphill side, a sheer fall on the lake side
  const m = ROUTE.main, s = (FROST.cliff[0] + FROST.cliff[1]) / 2, p = m.poseAt(s), ty = y(m, s);
  const off = d => { const X = p.X - Math.sin(p.h) * 0 + Math.cos(p.h) * 0, lx = -Math.sin(p.h), ln = Math.cos(p.h); return naturalH(X + lx * d, p.N + ln * d); };
  const hi = Math.max(off(60), off(-60)), lo = Math.min(off(150), off(-150));
  assert.ok(hi - ty > 25, `cliff stands ${(hi - ty).toFixed(0)} m over the shelf`);
  assert.ok(ty - lo > 15, `the lake side falls ${(ty - lo).toFixed(0)} m below the shelf`);
});

test('no rails on the lake, and a skating train follows the path its engine made', { skip: SKIP }, () => {
  const W = frost(), ctx = W.ctx || null;
  const { NET, FROST } = W;
  const E = NET.edges.find(e => e.ice && e.ice.length), [a, b] = E.ice[0];
  assert.ok(E.trim[0].some(r => r[0] <= a + 0.01 && r[1] >= b - 0.01) && E.trim[1].some(r => r[0] <= a + 0.01 && r[1] >= b - 0.01), 'both rails stop at the shore');
  assert.ok(E.noTie.some(r => r[0] <= a + 0.01 && r[1] >= b - 0.01), 'and so do the ties');
  // a skated path swinging off at 45 degrees: trucks along it stay their proper distance apart (no stretching)
  const sk = W.skate; sk.iceSkateEdge(); const K = sk.ICE.sk, Z = 6000;
  const F = { p: new W.THREE.Vector3(), f: new W.THREE.Vector3(), u: new W.THREE.Vector3(), r: new W.THREE.Vector3() };
  const s0 = a + 50; E.pose(s0, F);
  K.o = s0; K.lo = 0; K.hi = 0; K.openLo = false; K.openHi = true; K.live = true;
  K.PX[Z] = F.p.x; K.PN[Z] = -F.p.z; K.PH[Z] = Math.atan2(-F.f.z, F.f.x);
  for (let q = 1; q <= 600; q++) { const H = K.PH[Z] + Math.min(q, 300) / 300 * Math.PI / 4; K.PX[Z + q] = K.PX[Z + q - 1] + Math.cos(H); K.PN[Z + q] = K.PN[Z + q - 1] + Math.sin(H); K.PH[Z + q] = H; K.hi = q; }
  const at = s => { E.pose(s, F); return F.p.clone(); };
  for (const s of [s0 + 100, s0 + 350, s0 + 590, s0 + 700]) assert.ok(Math.abs(at(s).distanceTo(at(s + 15)) - 15) < 0.05, `15 m of path at ${(s - s0).toFixed(0)} m is ${at(s).distanceTo(at(s + 15)).toFixed(2)} m`);
  E.pose(s0 + 500, F); assert.ok(Math.abs(Math.atan2(-F.f.z, F.f.x) - K.PH[Z + 500]) < 1e-6, 'and she points along it');
  K.live = false; const r0 = at(s0 - 20); K.live = true;
  assert.ok(at(s0 - 20).distanceTo(r0) < 1e-6, 'behind where she left the rails, the rails');
  K.live = false;
});

/* Austin, 2026-11-21: "the train still falls apart once you go onto the ice". Drive a seven-car train off the rail
   end at normal speed, steering about, with the real skate code moving its trucks, and check it holds together:
   neighbours' trucks keep their spacing, the slide starts once and stays on, and cars not yet off the rails stay
   on them. */
test('a train rolling onto the ice stays coupled, the cars behind stay on the rails, and it eases back onto the far rails without a jump', { skip: SKIP }, () => {
  const W = frost(), { NET, THREE, TrackPos, S } = W, sk = W.skate, K = sk.ICE.sk;
  const E = sk.iceSkateEdge(), [a] = E.ice[0];
  // seven 20 m cars, trucks 14 m apart (3 m overhang), the engine's front end 10 m short of the rail end
  const pts = [], vehicles = [], n = 7, L = 20 * n;
  for (let j = 0; j < n; j++) {
    const v = { brake: { BC: 0 }, len: 20 };
    for (const off of [3, 17]) { const tp = new TrackPos(E, a - 13 - (j * 20 + off - 3), 1); const P = { tp, a: j * 20 + off, F: null, s0: tp.s }; pts.push(P); }
    vehicles.push(v);
  }
  // the edge has to carry the whole train behind the rail end for this to test anything
  assert.ok(pts[pts.length - 1].tp.s > 0, 'train fits on the ice edge');
  const T = { pts, vehicles, lead: vehicles[0], length: L,
    endTP(end) { if (end === 'front') { const p = pts[0], t = p.tp.clone(); t.advance(p.a, null); return t; } const p = pts[pts.length - 1], t = p.tp.clone(); t.advance(-(L - p.a), null); return t; } };
  const F = { p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() };
  const pos = tp => { tp.pose(F); return F.p.clone(); };
  const railPos = tp => { const l = K.live; K.live = false; tp.pose(F); K.live = l; return F.p.clone(); };
  Object.assign(S, { v: 20, throttle: 0, reverser: 0, derailed: false });
  K.on = false; K.live = false;
  const gap0 = pos(pts[1].tp).distanceTo(pos(pts[2].tp));
  let onIce = 0, went = 0, caught = false, back = false, last = pts.map(p => pos(p.tp));
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 200 && !S.derailed && !back; i++) {
    // weave about with the sanders, swinging out and back toward the line of the far rails
    if (K.on) { const A = sk.iceSkateAim(T), want = Math.atan2(A.off, Math.max(A.dist * 0.5, 80)) + 0.06 * Math.sin(i * dt * 0.8), e = want - A.ang - K.w * 3; K.steer = e > 0.003 ? 1 : e < -0.003 ? -1 : 0; }
    const d = S.v * dt, lead = pts[0].tp, left = lead.advance(d, { commit: true }), act = d - left;
    for (let q = 1; q < pts.length; q++) pts[q].tp.advance(act, { commit: true });
    went += act;
    sk.iceSkate(dt, T);
    if (K.on) onIce++;
    if (K.cap) caught = true;
    if (caught && !K.on) back = true;
    // every truck moves just as far as the train did: nothing is picked up and put down somewhere else
    pts.forEach((p, q) => { const P = pos(p.tp), m = P.distanceTo(last[q]); assert.ok(Math.abs(m - act) < 0.05, `truck ${q} jumped ${(m - act).toFixed(2)} m at ${(i * dt).toFixed(1)} s${K.cap ? ' (back on the rails)' : ''}`); last[q] = P; });
    // once her front end is past the rail end she is skating, every frame, not starting over each one
    if (!caught && pts[0].s0 + 3 + went > a + 0.5) assert.ok(K.on, `the slide was off again at ${(i * dt).toFixed(1)} s, ${(pts[0].s0 + 3 + went - a).toFixed(1)} m past the rail end`);
    for (let j = 0; j + 1 < n; j++) {
      const g = pos(pts[2 * j + 1].tp).distanceTo(pos(pts[2 * j + 2].tp));
      assert.ok(Math.abs(g - gap0) < 0.15, `cars ${j} and ${j + 1} pulled ${(g - gap0).toFixed(2)} m apart at ${(i * dt).toFixed(1)} s`);
    }
    // a truck still short of the rail end is on the rails, wherever the skate has moved its numbers to
    if (!caught) for (const p of pts) { const sr = p.s0 + went; if (sr < a - 1) assert.ok(pos(p.tp).distanceTo(railPos(new TrackPos(E, sr, 1))) < 0.02, `a truck ${(a - sr).toFixed(0)} m behind the rail end left the rails by ${pos(p.tp).distanceTo(railPos(new TrackPos(E, sr, 1))).toFixed(2)} m at ${(i * dt).toFixed(1)} s`); }
  }
  assert.ok(!S.derailed, `derailed: ${S.derailed}`);
  assert.ok(onIce > 30 * 20, 'and she skated a good way across');
  assert.ok(caught && back, 'and got back on the far rails');
  for (const p of pts) assert.ok(pos(p.tp).distanceTo(railPos(p.tp)) < 0.02, 'every truck on the far rails');
  K.on = false; K.live = false; K.steer = 0;
});
