/* Layout editor placement: snapping onto ends, lining up beside track, the grid, and moving joined
   track as one rigid piece. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('./harness');

function load() {
  const ctx = { THREE: h.THREE, console, Math, location: { search: '' }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  const code = ['01_util.js', '02_track.js', '03b_layout.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n')
    + '\n({ SNAP, LAYOUT, pieceGeom, attachPiece, layoutGraph, movePiece, layoutGroup, rigidAbout, rigidAt, snapFree, snapGroup, wrapPi, DOUBLE });';
  return vm.runInContext(code, ctx, { filename: 'layout.js' });
}
const L = load();
const S = (id, len, X = 0, N = 0, h = 0) => ({ id, t: 'straight', L: len, X, N, h });
/* a run of joined track: straight, curve, turnout, and straights off both legs */
function chain() {
  const ps = [S(1, 100)];
  const add = (spec, from, j = 1, by = 0) => { const p = L.attachPiece({ ...spec, id: ps.length + 1 }, by, L.pieceGeom(from).ports[j]); ps.push(p); return p; };
  const c = add({ t: 'curve', R: 300, deg: 15, dir: 1 }, ps[0]);
  const t = add({ t: 'turnout', k: 'main', dir: -1 }, c);
  add({ t: 'straight', L: 50 }, t, 1); add({ t: 'straight', L: 50 }, t, 2);
  return ps;
}
const joints = G => G.ports.filter(q => q.mate >= 0).length / 2;

test('moving and turning joined track keeps every joint flush', () => {
  const ps = chain(), G0 = L.layoutGraph({ pieces: ps });
  assert.equal(joints(G0), 4); assert.equal(G0.issues.length, 0);
  assert.equal(L.layoutGroup(G0, 0).size, 5);
  for (const a of [0.3, -2.1, Math.PI / 12, 1e-3]) {
    const T = L.rigidAbout(a, 123.4, -55.5, 812.7, 431.9);
    const G = L.layoutGraph({ pieces: ps.map(p => L.movePiece(p, T)) });
    assert.equal(joints(G), 4, 'joints after a turn of ' + a); assert.equal(G.issues.length, 0);
  }
});

test('a free piece near an open end, facing it, snaps flush onto it', () => {
  const G = L.layoutGraph({ pieces: [S(1, 100)] });
  // A end 3 m short of the open end at (100, 0), 20° off its heading
  const r = L.snapFree({ t: 'straight', L: 50, id: 2 }, 97, 2, 0.35, G, { r: 8 });
  assert.equal(r.how, 'end');
  const G2 = L.layoutGraph({ pieces: [S(1, 100), r.p] });
  assert.equal(joints(G2), 1); assert.equal(G2.issues.length, 0);
  // too far round to be meant for it: 120° off does not snap
  assert.notEqual(L.snapFree({ t: 'straight', L: 50, id: 2 }, 100, 0, 2.1, G, { r: 8, parallel: false }).how, 'end');
});

test('the far end of a piece snaps onto an open end too', () => {
  const G = L.layoutGraph({ pieces: [S(1, 100)] });
  // a 50 m straight from the west whose B end lands near the A end at (0, 0)
  const r = L.snapFree({ t: 'straight', L: 50, id: 2 }, -52, 1, 0.05, G, { r: 8 });
  assert.equal(r.how, 'end'); assert.equal(r.j, 1);
  const G2 = L.layoutGraph({ pieces: [S(1, 100), r.p] });
  assert.equal(joints(G2), 1); assert.equal(G2.issues.length, 0);
});

test('near laid track a free piece lines up parallel at whole track spacings', () => {
  const G = L.layoutGraph({ pieces: [S(1, 200, 0, 0, 0.4)] });
  const at = (s, lat) => [Math.cos(0.4) * s - Math.sin(0.4) * lat, Math.sin(0.4) * s + Math.cos(0.4) * lat];
  for (const [lat, want] of [[3.6, 4.5], [-5.2, -4.5], [8, 9], [12.1, 13.5], [0.5, 4.5]]) {
    const [X, N] = at(80, lat), r = L.snapFree({ t: 'straight', L: 50, id: 2 }, X, N, 0, G, { alignAny: true });
    assert.equal(r.how, 'parallel'); assert.ok(Math.abs(r.lat - want) < 1e-9, `lat ${lat} -> ${r.lat}`);
    assert.ok(Math.abs(L.wrapPi(r.p.h - 0.4)) < 1e-9);
    const off = -Math.sin(0.4) * r.p.X + Math.cos(0.4) * r.p.N;
    assert.ok(Math.abs(off - want) < 1e-6, 'sits ' + want + ' m off the track centre');
  }
  // pointing the other way it lines up facing back along the track
  const [X, N] = at(80, 4), r = L.snapFree({ t: 'straight', L: 50, id: 2 }, X, N, 3.3, G, { alignAny: true });
  assert.ok(Math.abs(L.wrapPi(r.p.h - 0.4 - Math.PI)) < 1e-9);
  // turned by hand well away from the track's heading, it stays where it is put
  assert.equal(L.snapFree({ t: 'straight', L: 50, id: 2 }, X, N, 1.4, G, { step: 5 }).how, 'grid');
});

test('away from track a free piece sits on the grid', () => {
  const G = L.layoutGraph({ pieces: [S(1, 100)] });
  const r = L.snapFree({ t: 'straight', L: 50, id: 2 }, 512.6, 2047.4, 0.5, G, { step: 5 });
  assert.deepEqual([r.how, r.p.X, r.p.N, r.p.h], ['grid', 515, 2045, 0.5]);
});

test('dragging joined track near an open end pulls the whole group flush onto it', () => {
  const ps = [S(1, 100), ...chain().map(p => ({ ...p, id: p.id + 10, X: p.X + 300, N: p.N + 80 }))];
  const G = L.layoutGraph({ pieces: ps });
  assert.equal(joints(G), 4);
  const grp = L.layoutGroup(G, 1);
  // the dragged run starts at (300, 80); bring it to about (103, 2) and turned a little
  const T = L.rigidAbout(0.2, 300, 80, -197, -78);
  const r = L.snapGroup(G, grp, T, 8);
  assert.ok(r.E, 'found the end');
  const moved = ps.map((p, i) => grp.has(i) ? L.movePiece(p, r.T) : p);
  const G2 = L.layoutGraph({ pieces: moved });
  assert.equal(joints(G2), 5); assert.equal(G2.issues.length, 0);
  // nothing near: the move is left as it was
  const far = L.snapGroup(G, grp, { a: 0, tx: 0, tn: 0 }, 8);
  assert.equal(far.E, undefined);
});

test('double track pieces chain flush on both tracks, round curves too', () => {
  for (const sd of [1, -1]) {
    const ps = [{ ...S(1, 100), dbl: sd }];
    let last = ps[0];
    for (const spec of [{ t: 'curve', R: 500, deg: 15, dir: 1 }, { t: 'curve', R: 300, deg: 30, dir: -1 }, { t: 'straight', L: 50 }, { t: 'xover', side: sd, from: 0 }, { t: 'xover', side: sd, from: 1 }, { t: 'straight', L: 25 }]) {
      const p = L.attachPiece({ ...spec, ...(spec.t === 'xover' ? {} : { dbl: sd }), id: ps.length + 1 }, 0, L.pieceGeom(last).ports[1]);
      ps.push(p); last = p;
    }
    const G = L.layoutGraph({ pieces: ps });
    assert.equal(joints(G), 2 * (ps.length - 1), 'both tracks joined at every joint, side ' + sd);
    assert.equal(G.issues.length, 0, JSON.stringify(G.issues));
    assert.equal(G.nSw, 4);
    // the two tracks stay 4.5 m apart through the curves
    for (const P of G.pieces) if (P.p.dbl) {
      const [a, b] = P.g.paths, m = a.pts[(a.pts.length / 2) | 0];
      const d = Math.min(...b.pts.map(q => Math.hypot(q.X - m.X, q.N - m.N)));
      assert.ok(Math.abs(d - L.DOUBLE) < 0.01, 'spacing ' + d);
    }
  }
});

test('a siding turnout opens single track into double track flush', () => {
  const t = { id: 1, t: 'turnout', k: 'par', dir: 1, X: 0, N: 0, h: 0 }, q = L.pieceGeom(t).ports;
  const d = L.attachPiece({ id: 2, t: 'straight', L: 100, dbl: 1 }, 0, q[1]);
  const G = L.layoutGraph({ pieces: [t, d] });
  assert.equal(joints(G), 2); assert.equal(G.issues.length, 0);
});

test('a crossover joins its two tracks through two sets of points', () => {
  for (const from of [0, 1]) {
    const g = L.pieceGeom({ id: 1, t: 'xover', side: -1, from, X: 10, N: 20, h: 0.7 });
    const jog = g.paths[4].pts, A = g.ports[4], B = g.ports[5];
    assert.ok(Math.hypot(jog[0].X - A.X, jog[0].N - A.N) < 1e-9);
    assert.ok(Math.hypot(jog.at(-1).X - B.X, jog.at(-1).N - B.N) < 1e-6, 'reverse curve lands on the other track');
    assert.ok(Math.abs(L.wrapPi(jog.at(-1).h - 0.7)) < 1e-9, 'and leaves it parallel');
    assert.equal(g.sws.length, 2);
  }
});

test('a train runs from one track to the other across a crossover built into the network', () => {
  const ctx = { THREE: h.THREE, console, Math, location: { search: '' }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  const code = ['01_util.js', '02_track.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n')
    + '\nconst NET = new Network(); const ROUTE = { lines: {}, stations: [], water: [], signals: [], crossings: [], mileposts: [], bumpers: [], features: {} };\n'
    + fs.readFileSync(path.join(__dirname, '..', 'src', '03b_layout.js'), 'utf8')
    + '\n({ NET, ROUTE, TrackPos, buildLayoutRoute, attachPiece, pieceGeom });';
  const R = vm.runInContext(code, ctx);
  const a = { id: 1, t: 'straight', L: 200, dbl: 1, X: 0, N: 0, h: 0 };
  const x = R.attachPiece({ id: 2, t: 'xover', side: 1, from: 0 }, 0, R.pieceGeom(a).ports[1]);
  const b = R.attachPiece({ id: 3, t: 'straight', L: 200, dbl: 1 }, 0, R.pieceGeom(x).ports[1]);
  R.buildLayoutRoute({ name: 'T', pieces: [a, x, b] });
  assert.equal(R.NET.switches.length, 2);
  assert.equal(R.ROUTE.bumpers.length, 4);
  const near = (e, i, X, N) => Math.hypot(e.X[i] - X, e.N[i] - N) < 0.6;
  const edgeAt = (X, N) => R.NET.edges.find(e => near(e, 0, X, N) || near(e, e.n - 1, X, N));
  const run = () => {
    const e = edgeAt(0, 0), fwd = near(e, 0, 0, 0), tp = new R.TrackPos(e, fwd ? 5 : e.len - 5, fwd ? 1 : -1);
    tp.advance(380, null);
    return tp.e.N[Math.round(tp.s / tp.e.ds)];
  };
  assert.ok(Math.abs(run()) < 0.5, 'points normal: stays on the first track');
  for (const sw of R.NET.switches) sw.state = 1;
  assert.ok(Math.abs(run() - 4.5) < 0.5, 'points reversed: crosses to the second track');
});
