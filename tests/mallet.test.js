/* Chesapeake & Ohio 1308, the H-6 2-6-6-2 compound Mallet: built to the published figures, one solid piece (front
   engine, main frame and tender on their wheels, nothing floating), the front engine hinged so it swings out on a
   curve with its wheels on the rails, the gear holding together all the way round, and the engine pulling like a
   compound Mallet in the headless physics. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const { have, world, prep, modelPieces, components, describe } = require('./geocheck');

const FT = 0.3048, IN = 0.0254;
const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what}: ${v.toFixed(3)}, want ${want.toFixed(3)} ± ${tol}`);
const skip = !have && 'no tests/vendor/three.min.js';
function geoOf(THREE, p) { const g = new THREE.BufferGeometry(); g.setFromPoints(p.v); return g; }
function solid(name, P) {
  const C = components(P);
  assert.equal(C.length, 1, `${name}: ${C.length - 1} loose group(s) apart from the model (${P.length} pieces):\n  ` + C.slice(1).slice(0, 12).map(describe).join('\n  '));
}
/* every piece of the engine (front engine, main frame, lead truck) on straight track, in the main frame's coordinates */
function engineOnStraight(L) {
  const w = world(), { THREE, ML } = w;
  L.root.traverse(o => { for (const k of ['x', 'y', 'z']) if (!Number.isFinite(o.rotation[k])) o.rotation[k] = 0; });
  w.animateMallet(L, 0, 0, 0.6, 0);
  L.front.matrix.makeTranslation(ML.refR - ML.refF, 0, 0); L.front.matrixWorldNeedsUpdate = true;
  L.leadTruck.matrix.makeTranslation(ML.refR - ML.leadA, 0, 0); L.leadTruck.matrixAutoUpdate = false;
  const P = modelPieces(L.root);
  for (const [g, m] of [[L.front, L.front.matrix], [L.leadTruck, L.leadTruck.matrix]]) for (const p of modelPieces(g)) P.push(prep(THREE, p.v.length ? geoOf(THREE, p).applyMatrix4(m) : null, p.k, p.at));
  return P;
}

test('C&O 1308 is built to its published dimensions', { skip }, () => {
  const w = world(), { ML, MLT, MLW } = w;
  near(ML.len + MLT.len, 99 * FT + 8 * IN, 0.03, 'engine and tender over the couplers');
  near(ML.aT - ML.aL, 48 * FT + 10 * IN, 0.06, 'engine wheelbase');
  near(ML.aDf[2] - ML.aDf[0], 10 * FT, 0.01, 'rigid wheelbase, front engine');
  near(ML.aDr[2] - ML.aDr[0], 10 * FT, 0.01, 'rigid wheelbase, rear engine');
  near(2 * ML.rD, 56 * IN, 0.002, 'drivers'); near(2 * ML.cr, 32 * IN, 0.002, 'stroke');
  assert.ok(MLW.f.cylR > 17.5 * IN && MLW.f.cylR > 1.4 * MLW.r.cylR, 'the low-pressure cylinders on the front engine are the big ones');
  const L = w.buildMallet('1308'), T = w.buildMalletTender('1308');
  const box = new w.THREE.Box3();
  for (const p of engineOnStraight(L)) box.union(p.box);
  assert.ok(box.max.y > 14.5 * FT && box.max.y < 15.6 * FT, `height ${(box.max.y / FT).toFixed(2)} ft`);
  assert.ok(box.max.z - box.min.z <= 11 * FT + 0.04, `width ${(box.max.z - box.min.z).toFixed(2)} m, 11 ft is ${(11 * FT).toFixed(2)}`);
  const tb = new w.THREE.Box3(); for (const p of modelPieces(T.root)) tb.union(p.box);
  assert.ok(tb.max.y < box.max.y && tb.max.z - tb.min.z <= box.max.z - box.min.z, 'the tender inside the engine\'s outline');
  assert.equal(T.trucks.length, 2); assert.equal(T.trucks[0].type, 'four');
  assert.equal(L.parts.drivers.length, 6); assert.equal(L.parts.lead.length, 1); assert.equal(L.parts.trail.length, 1);
});

test('C&O 1308 is one piece: front engine on its hinge, boiler, pumps, cab, trucks, nothing floating', { skip }, () => {
  const w = world(), L = w.buildMallet('1308');
  solid('C&O 1308', engineOnStraight(L));
});

test('the 12-RC tender body is one piece', { skip }, () => {
  const w = world(), T = w.buildMalletTender('1308');
  solid('tender', modelPieces(T.root));
});

test('the Berkshire tender is unchanged by the shared builder', { skip }, () => {
  const w = world(), T = w.buildTender('765');
  assert.equal(T.trucks[0].type, 'buck'); near(T.len, w.TD.len, 1e-9, 'length'); assert.equal(T.waterHatchA, 11.0);
});

test('the low-pressure engine swings out from under the smokebox on a curve, its wheels staying on the rails', { skip }, () => {
  const w = world(), { THREE, ML } = w, L = w.buildMallet('1308');
  const up = new THREE.Vector3(0, 1, 0);
  for (const R of [120, 200, 400]) {
    const pos = a => { const th = a / R; return new THREE.Vector3(-R * Math.sin(th), 0, R * (1 - Math.cos(th))); };
    const A = pos(ML.aDr[0]), B = pos(ML.aDr[2]), f = A.clone().sub(B).normalize();
    const r = new THREE.Vector3().crossVectors(f, up).normalize(), u = new THREE.Vector3().crossVectors(r, f);
    L.root.matrixAutoUpdate = false; L.root.matrix.makeBasis(f, u, r).setPosition(A.clone().add(B).multiplyScalar(0.5));
    w.artFront({ root: L.root, artPt: { F: { p: pos(L.artA), u: up } } }, L, null);
    for (const a of ML.aDf) {
      const p = new THREE.Vector3(ML.refF - a, 0, 0).applyMatrix4(L.front.matrix), c = new THREE.Vector3(0, 0, R);
      near(p.distanceTo(c), R, 0.1, `R ${R}: front driver at ${a} m from the centre line`);
    }
    const hF = new THREE.Vector3(ML.refF - ML.aH, 0, 0).applyMatrix4(L.front.matrix), hR = new THREE.Vector3(ML.refR - ML.aH, 0, 0).applyMatrix4(L.root.matrix);
    near(hF.distanceTo(hR), 0, 1e-6, `R ${R}: hinge`);
    const sw = w.artSwing(L), d = ML.refR - 0.5, want = (d * d - (ML.refF - 0.5) ** 2 - (ML.aDr[2] - ML.aDr[0]) ** 2 / 4) / (2 * R);
    assert.ok(sw > 0.6 * want && sw < 1.4 * want, `R ${R}: the pilot stands ${sw.toFixed(2)} m from the smokebox's line, expected about ${want.toFixed(2)}`);
  }
});

test('the gear holds together all the way round, both engines, forward and back', { skip }, () => {
  const w = world(), L = w.buildMallet('1308');
  for (const rev of [1, 0.4, 0, -1]) for (let i = 0; i < 48; i++) {
    const th = -i / 48 * Math.PI * 2;
    w.animateMallet(L, i * 0.3, th, rev, i * 3);
    for (const E of [L.parts.eng.f, L.parts.eng.r]) for (const s of [-1, 1]) {
      const P = E.rods[s];
      for (const k of ['main', 'cross', 'eccRod', 'link', 'rrod', 'comb', 'union', 'vstem', 'lifter', 'rarm']) {
        const o = P[k]; assert.ok([o.position.x, o.position.y, o.rotation.z].every(Number.isFinite), `${k} at rev ${rev}, θ ${th.toFixed(2)}`);
      }
      near(P.cross.position.y, w.ML.yC, 1e-9, 'crosshead on the cylinder centre line');
    }
  }
});

test('1308 pulls like a compound Mallet (physics)', () => {
  const sim = h.load(), { S, LOCO_SPEC, steamK } = sim;
  const sp = LOCO_SPEC['1308'], k = steamK(sp);
  near(0.85 * sp.psi * sp.teK, 77900, 900, 'tractive effort working compound');
  assert.equal(k.PL, 210);
  const T = h.train(sim, 40, { grade: 0.012, loco: '1308' });
  Object.assign(S, { P: 205, reverser: 1, throttle: 1, brakeH: 0, indH: 0, sander: true, cocks: false });
  h.run(sim, T, 2);
  assert.ok(S.TE / sim.LBF > 60000, `starting effort ${Math.round(S.TE / sim.LBF)} lbf`);
});
