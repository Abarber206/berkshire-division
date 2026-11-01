/* Weather: the spells and how they blend, the wet rail, lightning and thunder timing, the cloud map,
   and save/restore of a spell part way through. Run with: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
function load() {
  const ctx = { THREE: new Proxy({}, { get: () => function () {} }), Math, console };
  vm.createContext(ctx);
  vm.runInContext(['01_util.js', '10d_weather.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') +
    '\nthis.X = { WX, WX_KINDS, WX_NUMS, WEATHER, WX_NEXT, WX_HOLD, WX_MAP, wxSet, wxStep, wxMu, wxRailWord, wxOut, wxIn, wxBuildMap, wxMapAt, wxCoverAt, wxCoverEdge, wxBlend, wxBeam, WX_DRY_MU };', ctx);
  return ctx.X;
}
const X = load();
const run = (sec, dt = 0.5, sun = 1, each) => { for (let t = 0; t < sec; t += dt) { X.wxStep(dt, sun); if (each) each(t); } };

test('every kind has every number, and every menu entry and every next step names a real kind', () => {
  for (const k in X.WX_KINDS) for (const n of X.WX_NUMS) assert.ok(Number.isFinite(X.WX_KINDS[k][n]), `${k}.${n}`);
  for (const k in X.WEATHER) { const m = X.WEATHER[k]; assert.ok(m.walk || X.WX_KINDS[m.kind], k); assert.ok(m.name && m.sub, k); }
  for (const s in X.WX_NEXT) for (const a in X.WX_NEXT[s]) { assert.ok(X.WX_KINDS[a], a); for (const b in X.WX_NEXT[s][a]) assert.ok(X.WX_KINDS[b], `${a} -> ${b}`); }
  for (const k in X.WX_KINDS) assert.ok(X.WX_HOLD[k], `hold for ${k}`);
});

test('a fixed choice holds its weather; a changing sky goes round the kinds and never jumps', () => {
  X.wxSet('rain', 5); run(3600);
  assert.strictEqual(X.WX.to, 'rain'); assert.strictEqual(X.WX.P.rain, X.WX_KINDS.rain.rain);
  X.wxSet('changing', 12345);
  const seen = new Set([X.WX.to]); let last = { ...X.WX.P }, worst = 0, changes = 0;
  run(6 * 3600, 0.5, 1, () => {
    if (X.WX.changed) changes++;
    seen.add(X.WX.to);
    for (const n of ['cover', 'rain', 'gray', 'fogK', 'sunK']) worst = Math.max(worst, Math.abs(X.WX.P[n] - last[n]) / (n === 'fogK' ? 50 : 1));
    last = { ...X.WX.P };
  });
  assert.ok(changes >= 25 && changes <= 90, `${changes} changes in six hours`);
  for (const k of ['clear', 'fair', 'cloudy', 'overcast', 'rain', 'storm']) assert.ok(seen.has(k), `summer weather reaches ${k}`);
  assert.ok(!seen.has('snow'), 'no snow in summer');
  assert.ok(worst < 0.012, `largest change in half a second: ${worst.toFixed(4)}`);
  // rain only ever comes out of a cloudy or grey sky, and a storm never breaks out of a clear one
  for (const a of ['clear', 'fair']) for (const b in X.WX_NEXT.summer[a]) assert.ok(!X.WX_KINDS[b].rain, `${a} -> ${b}`);
});

test('winter goes round to snow and keeps the ground white; summer has no snow', () => {
  X.wxSet('winter', 99); const seen = new Set();
  run(6 * 3600, 1, 1, () => seen.add(X.WX.to));
  assert.ok(seen.has('snow'), 'winter snows'); assert.ok(!seen.has('rain') && !seen.has('storm'), 'no rain in winter');
  assert.strictEqual(X.WX.season, 'winter');
});

test('wet rail: rain soaks it within a minute or two, it dries in a quarter of an hour, slipperiest when rain has just started', () => {
  X.wxSet('clear', 1);
  const dry = X.wxMu(); assert.ok(Math.abs(dry - X.WX_DRY_MU) < 1e-9, 'dry rail');
  X.wxSet('rain', 1); X.WX.wet = 0; X.WX.wash = 0;
  let t = 0; while (X.WX.wet < 0.9 && t < 600) { X.wxStep(1, 0); t++; }
  assert.ok(t < 150, `soaked in ${t} s`);
  const fresh = X.wxMu();
  run(900, 1, 0);
  const washed = X.wxMu();
  assert.ok(fresh < 0.18 && fresh > 0.14, `fresh rain mu ${fresh.toFixed(3)}`);
  assert.ok(washed > fresh + 0.01 && washed < 0.21, `washed rail mu ${washed.toFixed(3)}`);
  assert.strictEqual(X.wxRailWord(fresh), 'slippery');
  // the rain stops: still wet for a while, dry within half an hour in sunshine
  X.WX.from = X.WX.to = 'clear'; X.wxStep(0.1, 1);
  run(120, 1, 1); assert.ok(X.wxMu() < 0.24, 'still wet two minutes after');
  run(1800, 1, 1); assert.ok(X.wxMu() > 0.265, `dry after half an hour: ${X.wxMu().toFixed(3)}`);
  // fog and drizzle leave it damp; snow is slipperiest of all
  X.wxSet('fog', 1); assert.ok(X.wxMu() < 0.24 && X.wxMu() > 0.2, `fog ${X.wxMu()}`);
  X.wxSet('snow', 1); assert.ok(X.wxMu() <= 0.15 + 1e-9, `snow ${X.wxMu()}`);
});

test('lightning in a storm, none otherwise; thunder comes later the farther the stroke', () => {
  X.wxSet('storm', 7); let flashes = 0, prev = 0;
  run(600, 0.05, 0, () => { if (X.WX.flash > 0.3 && prev <= 0.3) flashes++; prev = X.WX.flash; });
  assert.ok(flashes >= 8 && flashes <= 120, `${flashes} flashes in ten minutes`);
  for (const b of X.WX.bolts) assert.ok(b.dist >= 600 && b.dist <= 6600 && b.k > 0 && b.k <= 1);
  X.wxSet('overcast', 7); run(600, 0.05, 0); assert.strictEqual(X.WX.bolts.length, 0); assert.strictEqual(X.WX.flash, 0);
});

test('the cloud map: levelled 0-1 and tileable, so the cover number is the share of sky under cloud', () => {
  X.wxBuildMap(); const M = X.WX_MAP, N = M.n;
  for (const c of [0.1, 0.3, 0.58, 0.95]) {
    let s = 0, n = 0;
    for (let z = 0; z < M.tile; z += 97) for (let x = 0; x < M.tile; x += 97) { s += X.wxCoverAt(x, z, c); n++; }
    assert.ok(Math.abs(s / n - c) < 0.08, `cover ${c}: ${(s / n).toFixed(3)} of the sky`);
  }
  // it wraps without a seam
  for (let v = 0; v < 1; v += 0.13) assert.ok(Math.abs(X.wxMapAt(0, v) - X.wxMapAt(1, v)) < 1e-6, 'wraps in u');
  for (let u = 0; u < 1; u += 0.13) assert.ok(Math.abs(X.wxMapAt(u, 0) - X.wxMapAt(u, 1)) < 1e-6, 'wraps in v');
  // and neighbouring texels are close: soft cloud edges, not speckle
  let jump = 0; for (let i = 0; i < N * N - 1; i++) if ((i + 1) % N) jump = Math.max(jump, Math.abs(M.a[i] - M.a[i + 1]));
  assert.ok(jump < 0.25, `largest step between texels ${jump.toFixed(3)}`);
  for (let x = 0; x < M.tile; x += 331) { assert.ok(X.wxCoverAt(x, 900, 0) < 0.1, 'no cover: hardly a wisp'); assert.strictEqual(X.wxCoverAt(x, 900, 1), 1, 'full cover'); }
});

test('save and restore a spell part way through, wet rail and all', () => {
  X.wxSet('changing', 4242); run(1500, 0.5, 0.5);
  const o = JSON.parse(JSON.stringify(X.wxOut())), P = { ...X.WX.P }, mu = X.wxMu();
  X.wxSet('clear', 1);
  assert.ok(X.wxIn(o));
  for (const n of X.WX_NUMS) assert.ok(Math.abs(X.WX.P[n] - P[n]) < 0.02 * Math.max(1, Math.abs(P[n])), n);
  assert.ok(Math.abs(X.wxMu() - mu) < 0.003, 'same rail');
  assert.strictEqual(X.wxIn({ key: 'nonsense' }), false);
});

test('the headlight beam shows in rain, fog and snow, faintly under grey skies, not on a clear day', () => {
  X.wxSet('clear', 1); assert.strictEqual(X.wxBeam(), 0);
  for (const k of ['rain', 'fog', 'snow', 'storm']) { X.wxSet(k, 1); assert.ok(X.wxBeam() >= 0.02, k); }
});
