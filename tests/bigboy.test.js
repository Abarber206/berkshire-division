/* Union Pacific 4014 Big Boy: built to the published figures, one solid piece (front engine, main frame and
   tender each on their wheels with nothing floating), the front engine hinged so it swings out on a curve while its
   wheels stay on the rails, the Walschaerts gear holding together all the way round, and the engine pulling and
   steaming like a 4-8-8-4 in the headless physics. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const { have, world, prep, modelPieces, components, describe } = require('./geocheck');

const FT = 0.3048, IN = 0.0254;
const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what}: ${v.toFixed(3)}, want ${want.toFixed(3)} ± ${tol}`);
const skip = !have && 'no tests/vendor/three.min.js';

/* every piece of the engine (front engine, main frame, lead truck) on straight track, in the main frame's coordinates */
function engineOnStraight(L) {
  const w = world(), { THREE, BB } = w;
  // the cab's blower and stoker wheels are posed from the sim state, which this bare world does not have
  L.root.traverse(o => { for (const k of ['x', 'y', 'z']) if (!Number.isFinite(o.rotation[k])) o.rotation[k] = 0; });
  w.animateBigBoy(L, 0, 0, 0.6, 0);
  L.front.matrix.makeTranslation(BB.refR - BB.refF, 0, 0); L.front.matrixWorldNeedsUpdate = true;
  L.leadTruck.matrix.makeTranslation(BB.refR - BB.leadA, 0, 0); L.leadTruck.matrixAutoUpdate = false;
  const P = modelPieces(L.root);
  for (const [g, m] of [[L.front, L.front.matrix], [L.leadTruck, L.leadTruck.matrix]]) for (const p of modelPieces(g)) P.push(prep(THREE, p.v.length ? geoOf(THREE, p).applyMatrix4(m) : null, p.k, p.at));
  return P;
}
function geoOf(THREE, p) { const g = new THREE.BufferGeometry(); g.setFromPoints(p.v); return g; }
function solid(name, P) {
  const C = components(P);
  assert.equal(C.length, 1, `${name}: ${C.length - 1} loose group(s) apart from the model (${P.length} pieces):\n  ` + C.slice(1).slice(0, 12).map(describe).join('\n  '));
}

test('the Big Boy is built to its published dimensions', { skip }, () => {
  const w = world(), { BB, BBT } = w;
  near(BB.len + BBT.len, 132 * FT + 9.25 * IN, 0.03, 'engine and tender over the couplers');
  near(BB.len, 85 * FT + 3.4 * IN, 0.02, 'engine');
  near(BB.aT[1] - BB.aL[0], 72 * FT + 5.5 * IN, 0.02, 'engine wheelbase');
  near(BB.len + BBT.rigid[4] - BB.aL[0], 117 * FT + 7 * IN, 0.03, 'engine and tender wheelbase');
  near(BB.aDf[3] - BB.aDf[0], 18 * FT + 3 * IN, 0.02, 'rigid wheelbase, front engine');
  near(BB.aDr[3] - BB.aDr[0], 18 * FT + 3 * IN, 0.02, 'rigid wheelbase, rear engine');
  near(BB.aDr[3] - BB.aDf[0], 47 * FT + 3 * IN, 0.02, 'driving wheelbase');
  near(2 * BB.rD, 68 * IN, 0.002, 'drivers'); near(2 * BB.rL, 36 * IN, 0.002, 'lead wheels'); near(2 * BB.rT, 42 * IN, 0.002, 'trailing wheels'); near(2 * BBT.R, 42 * IN, 0.002, 'tender wheels');
  near(2 * BB.cr, 32 * IN, 0.002, 'stroke');
  const L = w.buildBigBoy('4014'), T = w.buildBigBoyTender('4014');
  const box = new w.THREE.Box3();
  for (const p of engineOnStraight(L)) box.union(p.box);
  near(box.max.y, 16 * FT + 2.5 * IN, 0.04, 'height over the stack');
  assert.ok(box.max.z - box.min.z <= 11 * FT + 0.04, `width ${(box.max.z - box.min.z).toFixed(2)} m, 11 ft is ${(11 * FT).toFixed(2)}`);
  const tb = new w.THREE.Box3(); for (const p of modelPieces(T.root)) tb.union(p.box);
  assert.ok(tb.max.y < box.max.y && tb.max.z - tb.min.z <= 11 * FT + 0.04, 'the tender inside the engine\'s outline');
  // five axles in the frame and four wheels in the truck: 14 wheels
  assert.equal(T.wheels.length, 7);
});

test('the Big Boy engine is one piece: front engine on its hinge, boiler, cab, trucks, nothing floating', { skip }, () => {
  const w = world(), L = w.buildBigBoy('4014');
  solid('Big Boy', engineOnStraight(L));
});

test('the centipede tender is one piece on its truck and axles', { skip }, () => {
  const w = world(), { THREE } = w, T = w.buildBigBoyTender('4014');
  T.truck.matrix.makeTranslation(w.BBT.ref - w.BBT.truck, 0, 0);
  const P = modelPieces(T.root);
  for (const p of modelPieces(T.truck)) P.push(prep(THREE, geoOf(THREE, p).applyMatrix4(T.truck.matrix), p.k, p.at));
  solid('tender', P);
});

/* a fake vehicle on a curve of radius R (left-hand), the way 07_train places the main frame and the front engine */
function onCurve(w, L, R) {
  const { THREE, BB } = w;
  const at = a => { const t = -a / R; return new THREE.Vector3(R * Math.sin(t), 0, R - R * Math.cos(t)).negate().add(new THREE.Vector3(0, 0, 0)); };
  // a = distance back along the arc from the front coupler: the arc runs toward -x, curving to +z
  const pos = a => { const th = a / R; return new THREE.Vector3(-R * Math.sin(th), 0, R * (1 - Math.cos(th))); };
  const A = pos(BB.aDr[0]), B = pos(BB.aDr[3]), f = A.clone().sub(B).normalize(), up = new THREE.Vector3(0, 1, 0);
  const r = new THREE.Vector3().crossVectors(f, up).normalize(), u = new THREE.Vector3().crossVectors(r, f);
  L.root.matrixAutoUpdate = false; L.root.matrix.makeBasis(f, u, r).setPosition(A.clone().add(B).multiplyScalar(0.5));
  const v = { root: L.root, artPt: { F: { p: pos(BB.refF), u: up } } };
  w.artFront(v, L, null);
  return { pos };
}

test('the front engine swings out from under the boiler on a curve, its wheels staying on the rails', { skip }, () => {
  const w = world(), { THREE, BB } = w, L = w.buildBigBoy('4014');
  for (const R of [120, 200, 400]) {
    const { pos } = onCurve(w, L, R);
    // every front driver within a couple of centimetres of the rails' centre line, lateral play of real engines
    for (const a of BB.aDf) {
      const p = new THREE.Vector3(BB.refF - a, 0, 0).applyMatrix4(L.front.matrix), c = new THREE.Vector3(0, 0, R);
      near(p.distanceTo(c), R, 0.1, `R ${R}: front driver at ${a} m from the centre line`);
    }
    // the hinge stays put on the main frame
    const hF = new THREE.Vector3(BB.refF - BB.aH, 0, 0).applyMatrix4(L.front.matrix), hR = new THREE.Vector3(BB.refR - BB.aH, 0, 0).applyMatrix4(L.root.matrix);
    near(hF.distanceTo(hR), 0, 1e-6, `R ${R}: hinge`);
    const sw = w.artSwing(L);
    // the boiler runs on the chord of the rear engine, so its front stands out over the outside rail: d^2 / 2R
    const d = BB.refR - 0.5, want = (d * d - (BB.refF - 0.5) ** 2 - (BB.aDr[3] - BB.aDr[0]) ** 2 / 4) / (2 * R);
    assert.ok(sw > 0.6 * want && sw < 1.4 * want, `R ${R}: the pilot stands ${sw.toFixed(2)} m from the smokebox's line, expected about ${want.toFixed(2)}`);
  }
  // on a 120 m curve that is plain to see
  onCurve(w, L, 120); assert.ok(w.artSwing(L) > 0.6, 'visible swing on a sharp curve');
});

test('the Walschaerts gear holds together all the way round, both engines, forward and back', { skip }, () => {
  const w = world(), L = w.buildBigBoy('4014');
  for (const rev of [1, 0.4, 0, -1]) for (let i = 0; i < 48; i++) {
    const th = -i / 48 * Math.PI * 2;
    w.animateBigBoy(L, i * 0.3, th, rev, i * 3);
    for (const E of [L.parts.eng.f, L.parts.eng.r]) for (const s of [-1, 1]) {
      const P = E.rods[s];
      for (const k of ['main', 'cross', 'eccRod', 'link', 'rrod', 'comb', 'union', 'vstem']) {
        const o = P[k]; assert.ok([o.position.x, o.position.y, o.rotation.z].every(Number.isFinite), `${k} at rev ${rev}, θ ${th.toFixed(2)}`);
      }
      assert.ok(P.cross.position.y > 0.5 && P.comb.position.y > 1.5 && P.comb.position.y < 2.0, 'crosshead and valve stem at their heights');
    }
  }
});

test('the Big Boy pulls and steams like a 4-8-8-4 (physics)', () => {
  const sim = h.load(), { S, LOCO_SPEC, steamK } = sim;
  const sp = LOCO_SPEC['4014'], k = steamK(sp);
  near(0.85 * sp.psi * sp.teK, 135375, 1200, 'tractive effort from the cylinders at 85% of boiler pressure');
  assert.equal(k.PL, 300);
  // starting a heavy train on a 1.5% grade: the engine has the adhesion and the effort for it
  const T = h.train(sim, 50, { grade: 0.015, loco: '4014' });
  Object.assign(S, { P: 295, reverser: 1, throttle: 1, brakeH: 0, indH: 0, sander: true, cocks: false });
  h.run(sim, T, 2);
  assert.ok(S.TE / sim.LBF > 100000, `starting effort ${Math.round(S.TE / sim.LBF)} lbf`);
});
