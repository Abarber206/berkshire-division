/* The Van Wert extension: the Berkshire Division's loop runs on west past Delphos, round a far curve and back
   through Spencerville to Bellevue. Builds the route and its terrain with the real three.js (no page or GPU).
   Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '04_world.js'];
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

let W = null;
function ohio() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '' },
    document: { createElement: () => ({ getContext: () => null }), getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    WORLD.custom = false; buildRoute(); buildLattice();
    ({ ROUTE, NET, WORLD, INNER, VW, MILE, groundH, latticeAt, riverDist, naturalH })`;
  return (W = vm.runInContext(code, ctx, { filename: 'ohio.js' }));
}

// where the old map's places stood before the extension: they must not have moved
const OLD = { 'Bellevue West': [-3100, 0], 'Fostoria West': [-450, 4.5], 'Kenton East': [2700, 2401], 'Quarry Jct': [-2102, 2401], 'Delphos crossover A': [-2265, 2401] };

test('the loop is over 30 miles, closes smoothly, and the old places have not moved', { skip: SKIP }, () => {
  const { ROUTE, NET, MILE } = ohio(), m = ROUTE.main;
  assert.ok(m.len / MILE > 30, `main line ${(m.len / MILE).toFixed(1)} mi`);
  const a = m.pts[0], b = m.pts[m.pts.length - 1];
  assert.ok(Math.hypot(a.X - b.X, a.N - b.N) < 0.01, 'the loop closes on itself');
  assert.ok(Math.abs(((b.h - a.h) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) < 1e-4 || Math.abs(((b.h - a.h) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - 2 * Math.PI) < 1e-4, 'without a kink');
  for (const [name, [X, N]] of Object.entries(OLD)) {
    const sw = NET.switches.find(s => s.name === name);
    assert.ok(sw, `${name} is still there`);
    assert.ok(Math.hypot(sw.node.X - X, sw.node.N - N) < 2, `${name} stands at ${sw.node.X.toFixed(0)}, ${sw.node.N.toFixed(0)}`);
  }
  const seen = new Set([NET.edges[0].a]), todo = [NET.edges[0].a];
  while (todo.length) { const n = todo.pop(); for (const e of NET.edges) for (const [p, q] of [[e.a, e.b], [e.b, e.a]]) if (p === n && !seen.has(q)) { seen.add(q); todo.push(q); } }
  assert.equal(seen.size, new Set(NET.edges.flatMap(e => [e.a, e.b])).size, 'every track joins the network');
});

test('the new stations, sidings and crossovers are on the extension', { skip: SKIP }, () => {
  const { ROUTE, NET } = ohio();
  for (const n of ['Middle Point', 'Van Wert', 'Willshire', 'Spencerville']) {
    const st = ROUTE.stations.find(s => s.name === n); assert.ok(st, n);
    assert.ok(st.line.poseAt(st.sLine).X < -5000, `${n} is out west`);
  }
  for (const n of ['Van Wert West', 'Van Wert East', 'Spencerville West', 'Spencerville East', 'Van Wert crossover A', 'Spencerville crossover B']) assert.ok(NET.switches.find(s => s.name === n), n);
});

test('the moraine grade stays gentle, and the line climbs over it on both sides', { skip: SKIP }, () => {
  const { ROUTE } = ohio(), m = ROUTE.main, y = s => { const l = m.locate(s); return l.edge.elev(l.s); };
  let worst = 0;
  for (let s = ROUTE.features.sC2; s + 100 <= m.len; s += 20) worst = Math.max(worst, Math.abs(y(s + 100) - y(s)) / 100);
  assert.ok(worst < 0.0066, `${(worst * 100).toFixed(2)}% on the extension`);
  for (const s0 of [ROUTE.features.sVJ1e, ROUTE.features.sVJ2]) {
    let top = 0; for (let s = s0 - 2000; s < s0 + 3000; s += 50) top = Math.max(top, y(s));
    assert.ok(top > 7, `the crest stands ${top.toFixed(1)} m up`);
  }
  assert.ok(Math.abs(y(m.len - 1) - y(0)) < 0.05, 'and comes back down to the yard');
});

test('the track is carried on graded ground over the whole extension: no gap under the ballast off the bridges', { skip: SKIP }, () => {
  const { NET, groundH, latticeAt } = ohio(), bad = [];
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 25) {
    if (e.isBridge(s)) continue;
    const [X, N] = e.xz(s); if (X > -3600) continue;
    const d = groundH(X, N, latticeAt(X, N)) - (e.elev(s) - 0.95);
    if (Math.abs(d) > 0.3) bad.push(`${e.line ? e.line.name : '?'} ${Math.round((e.lineS0 || 0) + s)} m: ground ${d.toFixed(2)} m off subgrade`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('the Little Auglaize passes under the line only at the Van Wert bridge', { skip: SKIP }, () => {
  const { ROUTE, NET, riverDist, INNER } = ohio(), b = ROUTE.bridges[1];
  assert.ok(INNER.x0 < -20000, 'the detailed country reaches past the far curve');
  const p = ROUTE.main.poseAt(b.s);
  assert.ok(riverDist(p.X, p.N) < 5, 'the river runs under the bridge');
  const wet = [];
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 5) {
    if (e.isBridge(s)) continue;
    const [X, N] = e.xz(s); if (riverDist(X, N) < 70) wet.push(`${e.line ? e.line.name : '?'} ${Math.round((e.lineS0 || 0) + s)}`);
  }
  assert.deepEqual(wet.slice(0, 5), [], 'no track runs through water or a riverbank');
});
