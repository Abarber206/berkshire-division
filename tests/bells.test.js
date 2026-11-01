/* The bells swing while they ring, and the class lamps light green. Checks that each engine's bell swings on its
   trunnions without hitting anything it doesn't already rest on, that the swing follows the strokes (full lean as
   each one sounds) and dies away when the bell is let go, and that the lamps light and go out.
   Run with: node --test tests/*.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world, prep, modelPieces, touches, describe } = require('./geocheck');
const skip = !have && 'no tests/vendor/three.min.js';

function engines(w) {
  return { 'NKP 765': w.buildBerkshire('765'), 'PM 1225': w.buildBerkshire('1225'), 'PM 1225 holiday': w.buildBerkshire('1225', 'polar'), diesel: w.buildDiesel({ livery: w.LIVERIES ? w.LIVERIES.ss : undefined, number: 4401 }) };
}
/* the bell's own pieces and everything else on the engine, with the bell leaned to angle a */
function bellPieces(w, m, a) {
  const { THREE } = w, r = m.bellRig;
  r.g.rotation.z = a; m.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(m.root.matrixWorld).invert(), mat = new THREE.Matrix4().multiplyMatrices(inv, r.g.children[0].matrixWorld);
  return r.g.children[0].userData.pieces.map(p => prep(THREE, p.g.clone().applyMatrix4(mat), 'bell:' + p.k, p.at));
}
function others(w, m) {
  const r = m.bellRig, saved = r.g.visible;
  r.g.rotation.z = 0;
  const keep = r.g.children[0].userData.pieces; r.g.children[0].userData.pieces = [];
  const P = modelPieces(m.root, { meshes: false });
  r.g.children[0].userData.pieces = keep; r.g.visible = saved;
  return P;
}

test('every bell swings clear of everything but its own stand', { skip }, () => {
  const w = world(), { THREE } = w;
  for (const [name, m] of Object.entries(engines(w))) {
    const r = m.bellRig; assert.ok(r, `${name} has a bell rig`);
    const O = others(w, m);
    const hit = a => { const B = bellPieces(w, m, a), s = new Set(); for (const b of B) O.forEach((o, i) => { if (touches(THREE, b, o)) s.add(i); }); return s; };
    const rest = hit(0);
    assert.ok(rest.size > 0, `${name}: the bell is hung on something`);
    const Amax = r.A * (1 + w.BELL_KICK);   // full lean plus the shiver after a stroke
    for (const a of [-Amax, -r.A / 2, r.A / 2, Amax]) {
      const extra = [...hit(a)].filter(i => !rest.has(i));
      assert.equal(extra.length, 0, `${name}: leaned ${a.toFixed(2)} rad the bell runs into ${extra.map(i => describe([O[i]])).join('; ')}`);
    }
    // what it rests on must be its stand: small pieces close to the trunnion axis
    const p = r.g.position;
    for (const i of rest) { const c = O[i].box.getCenter(new THREE.Vector3()); assert.ok(Math.hypot(c.x - p.x, c.y - p.y) < 0.4, `${name}: the bell touches ${describe([O[i]])} away from its stand`); }
    r.g.rotation.z = 0;
  }
});

test('the bell leans fully over on each stroke, swings back between them and dies away when let go', { skip }, () => {
  const w = world(), m = w.buildBerkshire('765'), T = { loco: m }, r = m.bellRig, P = 0.86, dt = 1 / 60;
  let t = 0.8, at = [];
  for (let i = 0; i < 60 * 8; i++) {
    t += dt; let struck = false; if (t > P) { t = 0; struck = true; }
    w.bellSwing(T, true, t, P, struck, dt);
    if (struck && i > 120) at.push(r.g.rotation.z);
  }
  assert.ok(at.length >= 4);
  // the clapper's blow jolts it back toward the middle just after each stroke
  w.bellSwing(T, true, 0, P, true, dt);
  let t2 = 0, jolt = 0; const sg = Math.sign(r.g.rotation.z);
  for (let i = 0; i < 6; i++) { t2 += dt; w.bellSwing(T, true, t2, P, false, dt); const pure = r.amp * r.sgn * Math.cos(Math.PI * t2 / P); jolt = Math.max(jolt, sg * (pure - r.g.rotation.z)); }
  assert.ok(jolt > r.A * 0.05, `the stroke jolts the bell (${jolt.toFixed(3)} rad)`);
  for (let k = 0; k < at.length; k++) assert.ok(Math.abs(at[k]) > r.A * 0.85, `stroke ${k} at ${at[k].toFixed(3)} rad, not at full lean`);
  for (let k = 1; k < at.length; k++) assert.ok(Math.sign(at[k]) !== Math.sign(at[k - 1]), 'strokes alternate sides');
  let peak = 0;
  for (let i = 0; i < 60 * 6; i++) { w.bellSwing(T, false, 0.8, P, false, dt); if (i > 60 * 4) peak = Math.max(peak, Math.abs(r.g.rotation.z)); }
  assert.ok(peak < r.A * 0.1, `still swinging ${peak.toFixed(3)} rad six seconds after the bell was let go`);
});

test('the class lamps light green and go out', { skip }, () => {
  const w = world();
  for (const k of ['765', '1225']) {
    const m = w.buildBerkshire(k), c = m.cls;
    assert.equal(c.lenses.length, 4, `${k}: a front and a side lens on each lamp`);
    assert.equal(c.at.length, 2, `${k}: two lamps to click`);
    w.clsLampsShow(c, true);
    assert.ok(c.mat.emissiveIntensity > 0.5 && c.mat.emissive.g > c.mat.emissive.r, `${k}: lit green`);
    w.clsLampsShow(c, false);
    assert.equal(c.mat.emissiveIntensity, 0, `${k}: dark again`);
  }
});
