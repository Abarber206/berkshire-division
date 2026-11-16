/* Getting off a moving train (src/06g_person.js fallStep/fallLand, used by 11j_walk.js WALK.jump/fallMove).
   He keeps the train's speed: slow, he steps down; quicker, he runs it out; fast, he goes down, rolls the way he
   was going, ends flat on his front or back and gets up on his feet. Each way he stops over about the distance
   his feet or the ground would stop him in, and in every tumbling pose he is one piece and put down on the
   ground by the lowest of him, never through it. Run with: node --test tests/*.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world, modelPieces, components, describe } = require('./geocheck');
const skip = !have && 'no tests/vendor/three.min.js';
const MPH = 0.44704;

function ride(w, mph, vy = -4.5) {
  const B = { ph: 'air', v: { x: mph * MPH, z: 0 }, th: 0, tuck: 0, t: 0, hit: 0 };
  const first = w.fallLand(B, vy), seen = new Set([first]);
  let x = 0, t = 0, maxTh = 0;
  while (t < 30) {
    const dt = 1 / 60; x += B.v.x * dt; t += dt;
    const done = w.fallStep(B, dt); seen.add(B.ph); maxTh = Math.max(maxTh, B.th);
    if (done) return { first, seen, x, t, B, maxTh };
  }
  return { first, seen, x, t, B, stuck: true };
}

test('slow he steps down, faster he runs it out, fast he rolls', { skip }, () => {
  const w = world();
  assert.equal(ride(w, 3).first, 'land');
  assert.equal(ride(w, 9).first, 'stumble');
  assert.equal(ride(w, 20).first, 'roll');
  assert.equal(ride(w, 2, -9).first, 'roll', 'a hard drop puts him down even at a crawl');
});

test('every landing ends on his feet, upright, having slid about as far as friction allows', { skip }, () => {
  const w = world();
  for (const mph of [3, 6, 9, 12, 20, 35, 60]) {
    const r = ride(w, mph);
    assert.ok(!r.stuck, `${mph} mph: still down after 30 s (${r.B.ph})`);
    assert.equal(r.B.th, 0, `${mph} mph: not upright at the end`);
    assert.equal(r.B.tuck, 0);
    const u = mph * MPH, mu = r.first === 'roll' ? w.FALL.muRoll : r.first === 'stumble' ? w.FALL.muRun : 0.8;
    const ideal = (u * u - Math.min(u, 1.25) ** 2) / (2 * mu * 9.81);
    assert.ok(r.x >= ideal * 0.85 && r.x <= ideal * 1.25 + 1.5, `${mph} mph: went ${r.x.toFixed(1)} m, friction says about ${ideal.toFixed(1)} m`);
    if (r.first === 'roll') {
      assert.ok(r.seen.has('lie') && r.seen.has('up'), `${mph} mph: never lay down and got up`);
      // a roll turns over at the speed he goes along the ground
      assert.ok(r.maxTh > ideal / w.FALL.R * 0.8, `${mph} mph: only turned ${r.maxTh.toFixed(1)} rad over ${ideal.toFixed(1)} m`);
    }
  }
});

test('tumbling, he is one piece and the lowest of him is what touches the ground', { skip }, () => {
  const w = world(), T = w.THREE;
  const rig = w.buildPerson({});
  for (const st of [{ air: 1 }, { flail: 1, speed: 4.5, phase: 1 }, { tuck: 1, free: true }, { tuck: 0.5, free: true }, { free: true }]) {
    for (const th of st.free ? [0, 0.8, Math.PI / 2, 2.4, Math.PI, 3 * Math.PI / 2, 5.5] : [0]) {
      rig.pose(st);
      rig.root.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), th); rig.root.position.set(0, 0, 0);
      rig.root.updateMatrixWorld(true);
      rig.root.position.y -= w.personLow(rig); rig.root.updateMatrixWorld(true);
      const name = JSON.stringify(st) + ' th ' + th.toFixed(2);
      const C = components(modelPieces(rig.root));
      assert.equal(C.length, 1, `${name}: ${C.length - 1} loose group(s):\n  ` + C.slice(1).map(describe).join('\n  '));
      // every vertex of him: none under the ground, and something on it
      let lo = Infinity; const v = new T.Vector3();
      rig.root.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.set(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(o.matrixWorld); if (v.y < lo) lo = v.y; } });
      assert.ok(lo > -0.006, `${name}: ${(-lo * 100).toFixed(1)} cm of him under the ground`);
      assert.ok(lo < 0.006, `${name}: floating ${(lo * 100).toFixed(1)} cm over the ground`);
    }
  }
});
