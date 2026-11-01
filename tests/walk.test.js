/* The railroader you walk about as, and the inside of the coaches you ride in (src/06g_person.js).
   He must be one piece in every pose (nothing comes apart at a joint), stand on his soles at y = 0 (never
   floating or sunk) and be a man's height; the coach's insides must be one piece with the coach, and stay
   inside its walls, floor and roof. Run with: node --test tests/*.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world, prep, modelPieces, components, describe } = require('./geocheck');
const skip = !have && 'no tests/vendor/three.min.js';

const POSES = {
  standing: {}, walking: { phase: 0.9, speed: 1.45 }, 'mid-stride': { phase: 2.4, speed: 1.45 },
  running: { phase: 1.3, speed: 3.9 }, 'running, other foot': { phase: 4.2, speed: 3.9 },
  waving: { wave: 1.2 }, seated: { sit: 0.43 },
};
function solesY(w, rig) {
  rig.root.updateMatrixWorld(true);
  return rig.soles.map(o => new w.THREE.Vector3().setFromMatrixPosition(o.matrixWorld).y);
}

test('the man is one piece in every pose', { skip }, () => {
  const w = world();
  for (const [name, st] of Object.entries(POSES)) {
    const rig = w.buildPerson({}); rig.pose(st);
    const C = components(modelPieces(rig.root));
    assert.equal(C.length, 1, `${name}: ${C.length - 1} loose group(s):\n  ` + C.slice(1).map(describe).join('\n  '));
  }
});

test('he stands on the ground: lowest sole at y = 0 in every stride, a man\'s height', { skip }, () => {
  const w = world();
  for (const [name, st] of Object.entries(POSES)) {
    if (st.sit) continue;
    const rig = w.buildPerson({}); rig.pose(st);
    const ys = solesY(w, rig), lo = Math.min(...ys);
    assert.ok(Math.abs(lo) < 1e-6, `${name}: lowest sole at ${lo.toFixed(4)} m`);
    // and no part of him is below his soles
    const b = new w.THREE.Box3().setFromObject(rig.root);
    assert.ok(b.min.y > -0.006, `${name}: something ${(-b.min.y * 100).toFixed(1)} cm under the ground`);
  }
  const rig = w.buildPerson({}); rig.pose({});
  const b = new w.THREE.Box3().setFromObject(rig.root), h = b.max.y;
  assert.ok(h > 1.76 && h < 1.86, `height in his cap ${h.toFixed(3)} m`);
  assert.ok(b.max.x - b.min.x > 0.42 && b.max.x - b.min.x < 0.6, `shoulder breadth ${(b.max.x - b.min.x).toFixed(2)} m`);
});

test('seated, he sits on the cushion with his boots on the floor', { skip }, () => {
  const w = world(), rig = w.buildPerson({}); rig.pose({ sit: w.COACH_IN.seatH });
  const ys = solesY(w, rig), lo = Math.min(...ys);
  assert.ok(lo > -0.01 && lo < 0.04, `seated, his soles are at ${lo.toFixed(3)} m`);
  // the bottom of his seat (the pelvis) is on the cushion, within a couple of centimetres
  const P = modelPieces(rig.root).filter(p => p.k === 'denim');
  rig.root.updateMatrixWorld(true);
  const hipY = rig.j.hips.getWorldPosition(new w.THREE.Vector3()).y, pelvisLow = hipY - 0.14;
  assert.ok(Math.abs(pelvisLow - w.COACH_IN.seatH) < 0.03, `pelvis bottom ${pelvisLow.toFixed(3)} vs cushion ${w.COACH_IN.seatH}`);
  assert.ok(P.length > 0);
});

test('the coach\'s insides are one piece with the coach and stay inside its body', { skip }, () => {
  const w = world(), { THREE, CH } = w;
  for (const obs of [false, true]) {
    const m = w.coachModel(w.LOCO_SPEC['765'], 3010, obs), inner = w.coachInterior(obs);
    const IP = modelPieces(inner);
    const b = new THREE.Box3(); for (const p of IP) b.union(p.box);
    assert.ok(b.min.y >= CH.yT - 0.001, `interior below the floor: ${b.min.y.toFixed(3)}`);
    assert.ok(b.max.z <= CH.hw - 0.035 && b.min.z >= -(CH.hw - 0.035), `interior out through the sides: ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)}`);
    assert.ok(b.max.x <= CH.xb + 0.01 && b.min.x >= -CH.xb - 0.01, `interior past the bulkheads: ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}`);
    assert.ok(b.max.y <= CH.eave + 0.8, `interior up through the roof: ${b.max.y.toFixed(3)}`);
    // the interior hangs together on its own, and sits on the car's floor
    const C = components(IP);
    assert.equal(C.length, 1, `interior (${obs ? 'observation' : 'coach'}): ${C.length - 1} loose group(s):\n  ` + C.slice(1, 8).map(describe).join('\n  '));
    const floor = modelPieces(m.root).filter(p => p.box.max.y > CH.yT - 0.01 && p.box.max.y < CH.yT + 0.01 && p.box.max.x - p.box.min.x > 20);
    assert.ok(floor.length, 'the coach has its floor deck at CH.yT');
    const carpet = IP.find(p => p.k === 'ciCarpet');
    assert.ok(Math.abs(carpet.box.min.y - CH.yT) < 0.002, 'carpet lies on the floor deck');
  }
});

test('52 seats, two and two, every one with room to sit and the aisle clear', { skip }, () => {
  const w = world(), S = w.coachSeats();
  assert.equal(S.length, 52);
  for (const s of S) assert.ok(Math.abs(s.z) > w.COACH_IN.aisle && Math.abs(s.z) < w.COACH_IN.hi - 0.15);
  const xs = w.coachPairs(); for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 0.95, 'seat pitch at least 0.95 m');
});
