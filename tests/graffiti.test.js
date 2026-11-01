/* Graffiti on the freight cars: only some cars carry it, each car's paint comes from its own number (the same after
   a save, on every player's screen), no two cars look alike, and every sheet of paint lies flat on the car's side,
   a few millimetres off the steel, never floating or cutting into it, and clear of the reporting marks.
   Run with: node --test tests/*.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world, modelPieces, components } = require('./geocheck');

const TYPES = ['box', 'hopper', 'tank', 'gon'];
const skip = !have && 'no tests/vendor/three.min.js';
const paint = P => P.filter(p => p.k.startsWith('gf_'));

/* forces every car to be painted while fn runs */
function always(w, fn) { const was = w.GRAFFITI.rate; w.GRAFFITI.rate = 1; try { return fn(); } finally { w.GRAFFITI.rate = was; } }

test('about two cars in five carry graffiti, and never a caboose', { skip }, () => {
  const w = world();
  for (const type of TYPES) {
    let n = 0; for (let i = 0; i < 400; i++) if (w.rng(w.gfHash(type, 20000 + i * 13))() < w.GRAFFITI.rate) n++;
    assert.ok(n > 400 * 0.3 && n < 400 * 0.5, `${type}: ${n} of 400 painted`);
  }
  assert.equal(always(w, () => w.freightModel('caboose', 3, () => 0.5).graffiti), 0, 'caboose painted');
  // a clean car has no paint at all
  let clean = 0;
  for (let num = 100; num < 140 && !clean; num++) { const m = w.freightModel('box', num, () => 0.5); if (!m.graffiti) { clean = num; assert.equal(paint(modelPieces(m.root)).length, 0); } }
  assert.ok(clean, 'no clean boxcar in 40');
});

test('a car is painted the same way every time it is built, whatever else is random', { skip }, () => {
  const w = world();
  const sig = m => paint(modelPieces(m.root)).map(p => p.k + ':' + p.box.min.toArray().map(v => v.toFixed(3)) + p.box.max.toArray().map(v => v.toFixed(3))).join('|');
  always(w, () => {
    for (const type of TYPES) {
      const a = sig(w.freightModel(type, 21407, Math.random)), b = sig(w.freightModel(type, 21407, () => 0.5));
      assert.ok(a.length > 0); assert.equal(a, b, `${type} 21407 painted differently`);
    }
  });
});

test('no two cars look alike', { skip }, () => {
  const w = world(), names = new Set(), places = new Set();
  for (let i = 0; i < 60; i++) { const r = w.rng(w.gfHash('box', 21000 + i * 17)); names.add(w.gfName(r)); }
  assert.ok(names.size >= 57, `only ${names.size} different names in 60`);
  always(w, () => { for (let i = 0; i < 12; i++) places.add(paint(modelPieces(w.freightModel('box', 21000 + i * 17, () => 0.5).root)).map(p => p.box.min.x.toFixed(2)).join()); });
  assert.ok(places.size >= 11, `only ${places.size} different layouts in 12 cars`);
  for (let i = 0; i < 2000; i++) assert.doesNotMatch(w.gfName(w.rng(i)), /SEX|KKK|NAZ|ASS/);
});

test('the paint lies flat on the car sides, clear of the marks, and the car is still one piece', { skip }, () => {
  const w = world(), { THREE } = w, ray = new THREE.Ray(), hit = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
  always(w, () => {
    for (const type of TYPES) for (const num of [21007, 21352, 21999, 22441, 23001, 24876]) {
      const m = w.freightModel(type, num, () => 0.5), P = modelPieces(m.root), G = paint(P), body = P.filter(p => !p.k.startsWith('gf_'));
      assert.ok(G.length >= 1, `${type} ${num}: no paint`);
      const C = components(P); assert.equal(C.length, 1, `${type} ${num}: paint or parts float (${C.length} groups)`);
      const marks = body.filter(p => /^f[md]_/.test(p.k));
      for (const g of G) {
        const near = body.filter(p => p.box.clone().expandByScalar(0.02).intersectsBox(g.box)).flatMap(p => p.tris).filter(t => new THREE.Box3().setFromPoints([t.a, t.b, t.c]).expandByScalar(0.02).intersectsBox(g.box));
        for (const t of g.tris) {
          t.getNormal(n);
          for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10 - i; j++) {
            const a = i / 10, b = j / 10, p = new THREE.Vector3().addScaledVector(t.a, 1 - a - b).addScaledVector(t.b, a).addScaledVector(t.c, b);
            // straight in through the paint: steel within 6 mm behind every point of it
            ray.set(p.clone().addScaledVector(n, 0.0005), n.clone().negate());
            let d = Infinity; for (const u of near) if (ray.intersectTriangle(u.a, u.b, u.c, false, hit)) d = Math.min(d, hit.distanceTo(p));
            assert.ok(d <= 0.0065, `${type} ${num} ${g.k}: paint ${(d * 1000).toFixed(1)} mm off the car at ${p.toArray().map(v => v.toFixed(2))}`);
            // and no sheet of steel lies just over it (paint buried under the side); rods and stays passing through are fine
            ray.set(p, n); let f = Infinity; for (const u of near) if (Math.abs(u.getNormal(q).dot(n)) > 0.9 && ray.intersectTriangle(u.a, u.b, u.c, false, hit)) f = Math.min(f, hit.distanceTo(p));
            assert.ok(!(f < 0.0015), `${type} ${num} ${g.k}: paint inside the steel at ${p.toArray().map(v => v.toFixed(2))}`);
            for (const mk of marks) if (Math.sign(mk.box.max.z + mk.box.min.z) === Math.sign(p.z) && p.x > mk.box.min.x && p.x < mk.box.max.x && p.y > mk.box.min.y && p.y < mk.box.max.y) assert.fail(`${type} ${num} ${g.k}: paint over the ${mk.k} marks`);
          }
        }
      }
    }
  });
});
