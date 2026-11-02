/* Derailment ground damage (src/10h_dig.js): a wrecked car plowing along throws dirt that lands on the
   ground (not above it or under it), leaves a gouge lying on the ground it crossed, none across a bounce,
   and the spray dies away. Runs the real three.js r128 (tests/vendor) against a sloped ground. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');

function load() {
  const ctx = { console, Math, navigator: { userAgent: 'node' }, screen: { width: 1920, height: 1080 },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }), style: {} }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = fs.readFileSync(path.join(SRC, '01_util.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SRC, '10h_dig.js'), 'utf8') + `
    var SKY = { dark: 0 }, WORLD = {};
    // a hillside: the ground rises 1 in 10 to the north (N = -z), plus a ripple
    function groundAt(X, N) { return 0.1 * N + 0.3 * Math.sin(X * 0.2); }
    const scene = new THREE.Group(); buildDig(scene);
    const R = { bodies: [], ground: (b, P) => groundAt(P.x, -P.z) };
    ({ THREE, DIG, R, groundAt, digWreck, digFrame, cam: new THREE.PerspectiveCamera(60, 1.6, 0.1, 5000) })`;
  return vm.runInContext(code, ctx, { filename: 'dig.js' });
}

test('a car plowing along a hillside: gouge on the ground, clods land on it, spray dies away', (t) => {
  if (!fs.existsSync(THREE_JS)) return t.skip('tests/vendor/three.min.js missing');
  const W = load(), { THREE, DIG, R, groundAt } = W;
  const b = { dgS: 0 }; R.bodies.push(b);
  const P = new THREE.Vector3(0, 0, 0);
  // 3 s sliding east at 12 m/s slowing down, with a 0.4 s bounce off the ground in the middle
  for (let f = 0; f < 180; f++) {
    const dt = 1 / 60, s = Math.max(1.5, 12 - f * 0.06);
    P.x += s * dt; P.z -= 0.02; P.y = groundAt(P.x, -P.z);
    const air = f >= 80 && f < 104;
    b.dgS = air ? 0 : 1; b.dgI = s; b.dgN = 0.6; b.dgP = P.clone(); b.dgV = new THREE.Vector3(s, -0.2, 0);
    W.digWreck(R, dt); W.digFrame(dt, W.cam);
  }
  assert.ok(DIG.scarN > 12, 'gouge laid: ' + DIG.scarN);
  assert.ok(DIG.clods.live > 100 && DIG.dust.live > 5, 'dirt thrown');
  // every gouge vertex lies on the ground under it (just over it, never floating or buried)
  const pos = DIG.scar.geometry.attributes.position.array;
  let maxGap = 0, longest = 0;
  for (let s = 0; s < Math.min(DIG.scarN, DIG.SEG); s++) {
    for (let v = 0; v < 12; v++) { const o = (s * 12 + v) * 3, d = pos[o + 1] - groundAt(pos[o], -pos[o + 2]); assert.ok(d > 0.02 && d < 0.07, 'scar height ' + d); }
    // no strip bridges the bounce: rows of a strip are at most a couple of metres apart
    const o = s * 12 * 3; longest = Math.max(longest, Math.hypot(pos[o + 3] - pos[o], pos[o + 5] - pos[o + 2]));
  }
  assert.ok(longest < 2.5, 'longest strip ' + longest);
  // let it all come down
  for (let f = 0; f < 600; f++) W.digFrame(1 / 60, W.cam);
  const C = DIG.clods, cp = C.g.attributes.position.array;
  let resting = 0;
  for (let i = 0; i < C.n; i++) {
    if (C.life[i] < 0) continue;
    assert.equal(C.rest[i], 1, 'clod still in the air after 10 s');
    const gap = cp[i * 3 + 1] - groundAt(cp[i * 3], -cp[i * 3 + 2]);
    assert.ok(gap >= 0 && gap < C.s0[i] * 0.35 + 0.01, 'clod sits on the ground: ' + gap + ' s0 ' + C.s0[i] + ' fl ' + C.floor[i] + ' y ' + cp[i*3+1]);
    resting++;
  }
  assert.ok(resting > 100);
  assert.equal(DIG.dust.live, 0, 'dust has settled');
  for (let f = 0; f < 60 * 41; f++) W.digFrame(1 / 60, W.cam);
  assert.equal(C.live, 0, 'clods gone in the end');
  assert.equal(C.pts.visible, false);
  assert.ok(DIG.scar.visible, 'gouge stays');
});
