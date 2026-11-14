/* Post-processing and graphics quality: presets, Auto's choice, the look following the light, and
   dynamic resolution stepping down only when it helps. Run with: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
function load(opts = {}) {
  let now = 0;
  const ctx = {
    Math, console, JSON,
    screen: { width: opts.phone ? 390 : 1920, height: opts.phone ? 844 : 1080 },
    navigator: { userAgent: opts.phone ? 'iPhone' : 'Desktop' }, devicePixelRatio: 2,
    localStorage: { getItem: () => opts.saved ? JSON.stringify({ gfx: opts.saved }) : null },
    document: { hidden: false, getElementById: () => null },
    performance: { now: () => now },
    GAME: { settings: { gfx: opts.gfx || 'auto' } },
    allocs: 0,
  };
  ctx.renderer = { setPixelRatio(p) { ctx.pr = p; }, getDrawingBufferSize: (v) => v.set(1920, 1080), capabilities: { maxTextureSize: 8192, isWebGL2: true } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', 'three.min.js'), 'utf8'), ctx, { filename: 'three.min.js' });
  vm.runInContext(fs.readFileSync(path.join(SRC, '01_util.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SRC, '10j_post.js'), 'utf8') +
    '\nthis.X = { GFXQ, GFX_MENU, POST, postSavedKey, postResolve, postQuality, postLight, postTime, ppNoCast };' +
    '\npostAlloc = function () { allocs++; };', ctx);
  ctx.THREE = ctx.THREE || vm.runInContext('THREE', ctx);
  ctx.tick = (ms) => { now += ms; ctx.X.postTime(); };
  return ctx;
}

test('every preset is in the menu, and Auto picks High on a desktop and Medium on a phone', () => {
  const d = load(), p = load({ phone: true });
  for (const k of ['auto', 'low', 'medium', 'high', 'ultra']) assert.ok(d.X.GFX_MENU[k], k);
  assert.strictEqual(d.X.postResolve('auto'), 'high');
  assert.strictEqual(p.X.postResolve('auto'), 'medium');
  assert.strictEqual(d.X.postResolve('low'), 'low');
  assert.strictEqual(load({ saved: 'ultra' }).X.postSavedKey(), 'ultra');
  assert.strictEqual(load({ saved: 'bogus' }).X.postSavedKey(), 'auto');
  // Low draws straight to the screen; the rest go through the chain
  assert.strictEqual(d.X.GFXQ.low.post, false);
  for (const k of ['medium', 'high', 'ultra']) assert.strictEqual(d.X.GFXQ[k].post, true, k);
});

test('quality sets the pixel ratio, capped lower on phones', () => {
  const d = load(); d.X.POST.ready = true; d.X.postQuality('low'); assert.strictEqual(d.pr, 1);
  d.X.postQuality('high'); assert.strictEqual(d.pr, 2);
  const p = load({ phone: true }); p.X.POST.ready = true; p.X.postQuality('ultra'); assert.ok(p.pr <= 1.6, `phone pixel ratio ${p.pr}`);
});

test('the look follows the light: more bloom at night, shafts by day and none in overcast or at night', () => {
  const c = load(), P = c.X.POST;
  c.X.postLight(0, 0, 0, 1); const day = { b: P.bloomK, s: P.shaftK };
  c.X.postLight(1, 0, 0, 1); const night = { b: P.bloomK, s: P.shaftK };
  c.X.postLight(0, 1, 0, 1); const golden = P.shaftK;
  c.X.postLight(0, 0, 1, 1); const gray = P.shaftK;
  assert.ok(night.b > day.b, 'night bloom');
  assert.ok(day.s > 0.3 && golden > day.s, 'shafts by day, strongest at golden hour');
  assert.ok(night.s < 0.01 && gray < 0.01, 'no shafts at night or under cloud');
  assert.ok(P.sat >= 0.9 && P.sat <= 1.15 && P.con >= 1 && P.con <= 1.1, 'grade stays gentle');
});

test('dynamic resolution steps down when frames run long, and back when that bought nothing', () => {
  const c = load(), P = c.X.POST; P.ready = true; c.X.postQuality('high');
  for (let i = 0; i < 200; i++) c.tick(16.7);          // a smooth 60: nothing changes
  assert.strictEqual(P.scale, 1);
  // GPU-bound: the frame costs fall with the pixel count, so it shrinks until it fits
  for (let i = 0; i < 1500; i++) c.tick(6 + 22 * P.scale * P.scale);
  assert.ok(P.scale < 0.95 && P.scale >= 0.6, `scale after slow frames ${P.scale}`);
  // CPU-bound: frames stay slow whatever the size, so a step down is undone and not kept
  const g = load(), Q = g.X.POST; Q.ready = true; g.X.postQuality('high');
  for (let i = 0; i < 200; i++) g.tick(16.7);
  for (let i = 0; i < 1500; i++) g.tick(28);
  assert.ok(Q.scale > 0.85, `a step that buys nothing is undone (scale ${Q.scale})`);
  // Ultra never scales
  const u = load(); u.X.POST.ready = true; u.X.postQuality('ultra'); for (let i = 0; i < 400; i++) u.tick(40); assert.strictEqual(u.X.POST.scale, 1);
});

test('glass, decals, glows and tiny parts stop casting shadows; bodies and cut-out foliage keep theirs', () => {
  const c = load(); const T = c.THREE;
  const r = c.X.ppNoCast;
  const mesh = (mat, size = 1, inst) => { const g = new T.BoxGeometry(size, size, size); const o = inst ? new T.InstancedMesh(g, mat, 2) : new T.Mesh(g, mat); o.castShadow = true; return o; };
  assert.strictEqual(r(mesh(new T.MeshStandardMaterial())), false, 'a body');
  assert.strictEqual(r(mesh(new T.MeshStandardMaterial({ transparent: true, opacity: 0.3 }))), true, 'glass');
  assert.strictEqual(r(mesh(new T.MeshStandardMaterial({ transparent: true, alphaTest: 0.35, depthWrite: false }))), true, 'a decal');
  assert.strictEqual(r(mesh(new T.MeshLambertMaterial({ alphaTest: 0.5 }))), false, 'cut-out leaves');
  assert.strictEqual(r(mesh(new T.MeshBasicMaterial(), 0.3)), true, 'a lens');
  assert.strictEqual(r(mesh(new T.MeshStandardMaterial(), 0.04)), true, 'a bolt');
  assert.strictEqual(r(mesh(new T.MeshStandardMaterial({ transparent: true }), 1, true)), false, 'instanced is left alone');
});
