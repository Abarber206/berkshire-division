/* Laurel Mountain: the route's geometry and the ground it is laid on. Builds the mountain railroad and its
   terrain with the real three.js (no page or GPU). Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '02_track.js', '03_route.js', '03c_mountain.js', '04_world.js', '04b_mountain.js'];
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

let W = null;
function mountain() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=laurel' },
    document: { createElement: () => ({ getContext: () => null }), getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    WORLD.roadsX = []; WORLD.roadN = 1e7; buildMountainRoute(); mtPrepare(); buildLattice();
    ({ ROUTE, NET, MT, WORLD, MILE, groundH, latticeAt, mtNaturalH })`;
  return (W = vm.runInContext(code, ctx, { filename: 'laurel.js' }));
}

test('the main line is over 35 miles and every track joins the network', { skip: SKIP }, () => {
  const { ROUTE, NET, MILE } = mountain();
  assert.ok(ROUTE.main.len / MILE > 35, `main line ${(ROUTE.main.len / MILE).toFixed(1)} mi`);
  const seen = new Set([NET.edges[0].a]), todo = [NET.edges[0].a];
  while (todo.length) { const n = todo.pop(); for (const e of NET.edges) for (const [p, q] of [[e.a, e.b], [e.b, e.a]]) if (p === n && !seen.has(q)) { seen.add(q); todo.push(q); } }
  const nodes = new Set(NET.edges.flatMap(e => [e.a, e.b]));
  assert.equal(seen.size, nodes.size, 'every node is reachable from every other');
});

/* a balloon leaves its switch and comes back to it from the other side, so its two ends lie at the same
   point heading opposite ways: the two legs of the switch */
test('the turning loops close on themselves, smoothly', { skip: SKIP }, () => {
  const { ROUTE } = mountain();
  for (const name of ['Riverton Loop', 'Ashby Loop']) {
    const L = ROUTE.lines[name], a = L.poseAt(0), b = L.poseAt(L.len);
    assert.ok(Math.hypot(a.X - b.X, a.N - b.N) < 0.05, `${name} ends ${Math.hypot(a.X - b.X, a.N - b.N).toFixed(3)} m from where it starts`);
    const dh = Math.abs(((b.h - a.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    assert.ok(Math.abs(dh - Math.PI) < 0.002, `${name} closes with a ${(Math.abs(dh - Math.PI) * 180 / Math.PI).toFixed(2)} degree kink`);
  }
});

test('no grade on the main line is steeper than the 1.9 per cent ruling grade', { skip: SKIP }, () => {
  const { ROUTE } = mountain(), m = ROUTE.main, y = s => { const l = m.locate(s); return l.edge.elev(l.s); };
  let worst = 0, at = 0;
  for (let s = 0; s + 100 <= m.len; s += 20) { const g = Math.abs(y(s + 100) - y(s)) / 100; if (g > worst) { worst = g; at = s; } }
  assert.ok(worst <= 0.0198, `${(worst * 100).toFixed(2)}% at ${Math.round(at)} m`);
  const top = Math.max(...Array.from({ length: Math.floor(m.len / 50) }, (_, i) => y(i * 50))) - y(0);
  assert.ok(top > 450, `the summit stands ${top.toFixed(0)} m above Riverton`);
});

test('the track is carried on graded ground: no gap under the ballast off the bridges', { skip: SKIP }, () => {
  const { NET, groundH, latticeAt } = mountain(), bad = [];
  for (const e of NET.edges) for (let s = 0; s <= e.len; s += 25) {
    if (e.isBridge(s) || e.isTunnel(s)) continue;
    const [X, N] = e.xz(s), d = groundH(X, N, latticeAt(X, N)) - (e.elev(s) - 0.95);
    if (Math.abs(d) > 0.3) bad.push(`${e.line ? e.line.name : '?'} ${Math.round((e.lineS0 || 0) + s)} m: ground ${d.toFixed(2)} m off subgrade`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('the trestle and the river bridge span real gaps, and Summit tunnel has rock over it', { skip: SKIP }, () => {
  const { ROUTE, mtNaturalH } = mountain(), m = ROUTE.main, at = s => { const l = m.locate(s), [X, N] = l.edge.xz(l.s); return { X, N, y: l.edge.elev(l.s) }; };
  const V = at(ROUTE.viaduct.s);
  assert.ok(V.y - mtNaturalH(V.X, V.N) > 25, `the trestle stands ${(V.y - mtNaturalH(V.X, V.N)).toFixed(1)} m over Bear Run`);
  const B = at(ROUTE.bridge.s);
  assert.ok(B.y - mtNaturalH(B.X, B.N) > 6, `the bridge clears the river by ${(B.y - mtNaturalH(B.X, B.N)).toFixed(1)} m`);
  const T = ROUTE.tunnels[0];
  let least = Infinity;
  for (let s = T.s0 + 60; s <= T.s1 - 60; s += 20) { const p = at(s); least = Math.min(least, mtNaturalH(p.X, p.N) - (p.y + 7.6)); }
  assert.ok(least > 15, `only ${least.toFixed(1)} m of cover over the bore`);
});

test('every creek and river runs downhill', { skip: SKIP }, () => {
  const { MT } = mountain();
  for (const r of MT.rivers) for (let i = 1; i < r.pts.length; i++) assert.ok(r.pts[i].y <= r.pts[i - 1].y + 1e-6, `${r.name} climbs at point ${i}`);
});
