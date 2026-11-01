/* Every engine, tender, coach and freight car is one solid thing: nothing floats or hangs in the air with a gap
   under it. Each model is built with the real three.js and put on its trucks and wheelsets exactly as the train
   places them (07_train.js update), and then every piece must touch the rest, directly or through other pieces.
   Also checks the cars against their published dimensions.
   Run with: node --test tests/*.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world, prep, modelPieces, components, describe } = require('./geocheck');

/* the car's pieces plus its trucks and wheelsets where the train puts them */
function assembled(m) {
  const w = world(), { THREE } = w, P = modelPieces(m.root), bins = w.truckBins();
  const ref = m.ref0 !== undefined ? m.ref0 : m.len / 2;
  for (const t of m.trucks) {
    const x = ref - t.a, bin = bins[t.type], sp = t.type === 'four' ? 0.865 : (t.sp || 1.676);
    for (const p of bin.pieces) P.push(prep(THREE, p.g.clone().translate(x, 0, 0), 'truck:' + p.k, p.at));
    const A = w.plainAxle(t.R, true, undefined, w.AXJ);
    for (const dx of t.type === 'four' ? [-sp, sp] : [-sp, 0, sp]) for (const k of ['black', 'tire']) P.push(prep(THREE, A[k].clone().translate(x + dx, t.R, 0), 'axle:' + k, 'axle'));
  }
  return P;
}
function solid(name, P) {
  const C = components(P);
  const loose = C.slice(1).map(describe);
  assert.equal(C.length, 1, `${name}: ${C.length - 1} loose group(s) apart from the model (${P.length} pieces):\n  ` + loose.slice(0, 12).join('\n  '));
}
function size(root) { const { THREE } = world(); return new THREE.Box3().setFromObject(root); }

const FREIGHT = ['box', 'hopper', 'tank', 'gon', 'caboose'];

test('every freight car is one piece on its trucks and wheels', { skip: !have && 'no tests/vendor/three.min.js' }, () => {
  const w = world();
  for (const type of FREIGHT) solid(type, assembled(w.freightModel(type, 1234, () => 0.5)));
});

test('the coach and the observation car are each one piece on their trucks', { skip: !have && 'no tests/vendor/three.min.js' }, () => {
  const w = world();
  for (const k of ['765', '1225']) {
    solid(`coach ${k}`, assembled(w.coachModel(w.LOCO_SPEC[k], 3010, false)));
    solid(`observation ${k}`, assembled(w.coachModel(w.LOCO_SPEC[k], 3059, true)));
  }
});

test('the tender is one piece on its trucks', { skip: !have && 'no tests/vendor/three.min.js' }, () => {
  const w = world();
  solid('tender', assembled(w.buildTender('765')));
});

test('the cars are built to their real sizes', { skip: !have && 'no tests/vendor/three.min.js' }, () => {
  const w = world(), ft = 0.3048;
  const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what}: ${v.toFixed(2)} m, want ${want.toFixed(2)} +- ${tol}`);
  const dims = (m) => { const b = size(m.root); return { h: b.max.y, w: b.max.z - b.min.z }; };
  // AAR 1937 40 ft boxcar: 15 ft 1 in to the top of the running board, 10 ft 8 in over the eaves
  { const d = dims(w.freightModel('box', 1, () => 0.5)); near(d.h, 15.08 * ft, 0.12, 'boxcar height'); near(d.w, 10.67 * ft, 0.15, 'boxcar width'); }
  // 55 t twin hopper: 10 ft 8 in high, 10 ft 4 in wide
  { const d = dims(w.freightModel('hopper', 1, () => 0.5)); near(d.h, 10.67 * ft + 0.35, 0.2, 'hopper height with its heaped load'); near(d.w, 10.33 * ft, 0.15, 'hopper width'); }
  // 10,000 gal tank car: 9 ft barrel, about 14 ft 10 in over the dome
  { const d = dims(w.freightModel('tank', 1, () => 0.5)); near(d.h, 14.8 * ft, 0.15, 'tank car height'); }
  // heavyweight coach: 13 ft 6 in to the clerestory roof, 10 ft over the sides
  { const d = dims(w.coachModel(w.LOCO_SPEC['765'], 1, false)); near(d.h, 13.9 * ft, 0.15, 'coach height'); near(d.w, 10.1 * ft, 0.2, 'coach width'); }
  // cupola caboose: about 15 ft over the cupola
  { const d = dims(w.freightModel('caboose', 1, () => 0.5)); near(d.h, 15.0 * ft, 0.15, 'caboose height'); }
});

test('the diesel is one piece on its trucks and wheels', { skip: !have && 'no tests/vendor/three.min.js' }, () => {
  const w = world();
  for (const lead of [true, false]) {
    const d = w.buildDiesel({ livery: w.LIVERIES ? w.LIVERIES.ss : undefined, number: 4401, lead });
    d.trucks.forEach((t, i) => { t.position.x = w.DG.ref - w.DG.trucks[i]; d.root.add(t); });
    solid(`diesel (${lead ? 'lead' : 'trailing'} unit)`, modelPieces(d.root));
  }
});
