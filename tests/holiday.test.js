/* The Polar Limited holiday trim: the wreaths, garland, bows, berries, gold lining and snow are only built when the
   trim is asked for, and every piece of it is fixed to the engine, tender or car it decorates: nothing floats.
   Builds the models with the real three.js (geometry only, no page or GPU). Each piece GeoBin is given is kept,
   and a trim piece counts as attached when it touches (within 12 mm, or by an edge passing through a face) a
   piece of the model, or another trim piece that is attached.
   Run with: node --test tests/*.test.js. three.js r128 is read from tests/vendor/three.min.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = ['01_util.js', '06_models.js', '06b_diesel.js', '06c_couplers.js', '06d_cab.js'];
const TRIM_KEYS = new Set(['snow', 'snowDust', 'garland', 'ribbon', 'berry', 'gold']);
const have = fs.existsSync(THREE_JS);

function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}
let W = null;
function world() {
  if (W) return W;
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {},
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = 'var SCN = { winMats: [] }, SKY = { night: false }, TEX = {}, GAME = { isDiesel: () => false, train: null, settings: { finish: "standard" } }, S = { throttle: 0, reverser: 0, brakeH: 0.12, indH: 0.6, dyn: 0, whistle: 0, light: 1, bell: false };\n' + FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    // keep every piece each GeoBin is given, in the order given, on the bin
    const _add = GeoBin.prototype.add;
    GeoBin.prototype.add = function (k, g, m) { const r = _add.call(this, k, g, m); (this.pieces || (this.pieces = [])).push({ k, g: r }); return r; };
    const _build = GeoBin.prototype.build;
    GeoBin.prototype.build = function (mats, opt) { const grp = _build.call(this, mats, opt); grp.userData.pieces = this.pieces || []; return grp; };
    rollingMaterials();
    ({ THREE, RMAT, SCN, LOCO_SPEC, TRIM, buildBerkshire, buildTender, coachModel, trimWanted, GAME })`;
  return (W = vm.runInContext(code, ctx, { filename: 'berkshire-holiday.js' }));
}
/* all the pieces of a model, from every GeoBin built into it */
function pieces(root) { const out = []; root.traverse(o => { if (o.userData && o.userData.pieces) out.push(...o.userData.pieces); }); return out; }
function names(root) { const s = new Set(); root.traverse(o => { if (o.isMesh) s.add(o.name); }); return s; }

/* triangles and vertices of a piece, with its bounding box */
function prep(THREE, p) {
  const g = p.g.index ? p.g.toNonIndexed() : p.g, a = g.attributes.position, v = [];
  for (let i = 0; i < a.count; i++) v.push(new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)));
  const tris = []; for (let i = 0; i + 2 < v.length; i += 3) tris.push(new THREE.Triangle(v[i], v[i + 1], v[i + 2]));
  const box = new THREE.Box3().setFromPoints(v);
  return { k: p.k, v, tris, box };
}
const TOL = 0.012;
function touches(THREE, A, B) {
  const bb = B.box.clone().expandByScalar(TOL), ab = A.box.clone().expandByScalar(TOL);
  if (!bb.intersectsBox(A.box)) return false;
  const q = new THREE.Vector3(), tb = new THREE.Box3();
  const near = (P, Q, box) => {
    const tris = Q.tris.filter(t => { tb.setFromPoints([t.a, t.b, t.c]).expandByScalar(TOL); return tb.intersectsBox(box); });
    if (!tris.length) return false;
    for (const p of P.v) { if (!box.containsPoint(p)) continue; for (const t of tris) { t.closestPointToPoint(p, q); if (q.distanceToSquared(p) < TOL * TOL) return true; } }
    return null;
  };
  if (near(A, B, bb) || near(B, A, ab)) return true;
  // an edge of A passing through a face of B
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), dir = new THREE.Vector3();
  const tris = B.tris.filter(t => { tb.setFromPoints([t.a, t.b, t.c]); return tb.intersectsBox(ab); });
  for (const t of A.tris) for (const [p0, p1] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
    const L = dir.subVectors(p1, p0).length(); if (L < 1e-9) continue; ray.set(p0, dir.normalize());
    for (const u of tris) if (ray.intersectTriangle(u.a, u.b, u.c, false, hit) && hit.distanceTo(p0) <= L) return true;
  }
  return false;
}
/* trim pieces not attached to the model, directly or through other trim */
function loose(root) {
  const { THREE } = world(), all = pieces(root).map(p => prep(THREE, p));
  const trim = all.filter(p => TRIM_KEYS.has(p.k)), base = all.filter(p => !TRIM_KEYS.has(p.k));
  assert.ok(trim.length > 0, 'the trimmed model has no trim pieces');
  const fixed = new Set();
  for (const t of trim) if (base.some(b => touches(THREE, t, b))) fixed.add(t);
  for (let grew = true; grew;) { grew = false; for (const t of trim) if (!fixed.has(t) && [...fixed].some(f => touches(THREE, t, f))) { fixed.add(t); grew = true; } }
  return trim.filter(t => !fixed.has(t)).map(t => `${t.k} at (${t.box.getCenter(new THREE.Vector3()).toArray().map(x => x.toFixed(2)).join(', ')})`);
}

test('the holiday trim is only built when asked for, and the menu choice asks for it', { skip: !have && 'tests/vendor/three.min.js missing' }, () => {
  const w = world();
  for (const key of ['765', '1225']) {
    const plain = names(w.buildBerkshire(key).root), dressed = names(w.buildBerkshire(key, 'polar').root);
    assert.ok(!plain.has('garland') && !plain.has('snow'), `${key}: the everyday engine carries trim`);
    for (const k of ['garland', 'ribbon', 'berry', 'snow']) assert.ok(dressed.has(k), `${key}: the dressed engine has no ${k}`);
    assert.ok(names(w.buildTender(key, 'polar').root).has('snowDust'), `${key}: no snow on the coal`);
    assert.ok(!names(w.buildTender(key).root).has('snowDust'));
  }
  const coach = names(w.coachModel(w.LOCO_SPEC['1225'], 3010, false, 'polar').root);
  for (const k of ['holBody', 'holWin', 'gold', 'garland', 'snow']) assert.ok(coach.has(k), `the dressed coach has no ${k}`);
  assert.ok(!coach.has('green') && !coach.has('win'), 'the dressed coach still has everyday paint or windows');
  const plain = names(w.coachModel(w.LOCO_SPEC['1225'], 3010, false).root);
  assert.ok(plain.has('green') && !plain.has('garland'));
  // the menu's finish picks the trim; the windows of a dressed car glow a little even by day
  w.GAME.settings.finish = 'polar'; assert.equal(w.trimWanted(), 'polar');
  w.GAME.settings.finish = 'white'; assert.equal(w.trimWanted(), '');
  assert.ok(w.SCN.winMats.includes(w.RMAT.holWin) && w.RMAT.holWin.userData.minI > 0.1);
});

test('every wreath, swag, bow and drift is fixed to the engine, tender or car: nothing floats', { skip: !have && 'tests/vendor/three.min.js missing' }, () => {
  const w = world();
  const models = {
    'NKP 765': w.buildBerkshire('765', 'polar').root, 'PM 1225': w.buildBerkshire('1225', 'polar').root, tender: w.buildTender('1225', 'polar').root,
    coach: w.coachModel(w.LOCO_SPEC['1225'], 3010, false, 'polar').root, observation: w.coachModel(w.LOCO_SPEC['1225'], 3059, true, 'polar').root,
  };
  for (const name in models) { const l = loose(models[name]); assert.deepEqual(l, [], `${name}: trim not fixed to anything: ${l.join('; ')}`); }
});
