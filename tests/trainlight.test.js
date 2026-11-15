/* Light off the trains (src/10k_trainlight.js): a headlight's pool lands on the rails ahead of the engine
   and only when it is dark, a steam engine's fire glows under the ashpan, and a train that goes away takes
   its lamps with it. Run with: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
function load() {
  const ctx = { Math, console, LAMPS: { lights: [] }, LAMP_KINDS: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', 'three.min.js'), 'utf8'), ctx, { filename: 'three.min.js' });
  vm.runInContext(fs.readFileSync(path.join(SRC, '01_util.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SRC, '10k_trainlight.js'), 'utf8') +
    '\nthis.X = { trainLights, trainLightsOff, TL, THREE };', ctx);
  return ctx;
}
/* an engine heading along +x (or turned by yaw) with its lamp 3.6 m up at the front and its ashpan at the back */
function engine(c, yaw = 0, at = [100, 2, 50]) {
  const T = c.X.THREE, root = new T.Group(), body = new T.Group(), ash = new T.Object3D();
  root.position.set(...at); root.rotation.y = yaw; root.add(body); ash.position.set(-6, 0.9, 0); body.add(ash);
  root.updateMatrixWorld(true);
  return { root, body, ash, headlightPos: new T.Vector3(8, 3.6, 0) };
}

test('a bright headlight at night throws its pool down the rails ahead; dim is weaker and day is dark', () => {
  const c = load(), L = engine(c), own = {};
  c.X.trainLights(own, L, 2, 0, 1);
  assert.strictEqual(c.LAMPS.lights.length, 2, 'two lamps registered');
  assert.strictEqual(own.h.lv, 1);
  assert.ok(own.h.dir.x > 0.99 && own.h.dir.y < -0.03 && own.h.dir.y > -0.2, `beam points ahead and a little down (${own.h.dir.x.toFixed(3)}, ${own.h.dir.y.toFixed(3)})`);
  assert.ok(own.h.p.x > 108 && Math.abs(own.h.p.y - 5.6) < 0.2 && Math.abs(own.h.p.z - 50) < 1e-6, 'starts just ahead of the lens');
  // the centre of the beam meets the rails well ahead of the pilot and inside the lamp's reach
  const reach = (own.h.p.y - 2) / -own.h.dir.y;
  assert.ok(reach > 25 && reach < c.LAMP_KINDS.head.r, `beam centre lands ${reach.toFixed(0)} m ahead`);
  c.X.trainLights(own, L, 1, 0, 1); assert.ok(own.h.lv > 0.2 && own.h.lv < 0.6, 'dim');
  c.X.trainLights(own, L, 0, 0, 1); assert.strictEqual(own.h.lv, 0, 'off');
  c.X.trainLights(own, L, 2, 0, 0); assert.strictEqual(own.h.lv, 0, 'nothing shows on the ground in daylight');
  assert.strictEqual(c.LAMPS.lights.length, 2, 'never registered twice');
});

test('the beam follows the engine round a curve', () => {
  const c = load(), own = {};
  c.X.trainLights(own, engine(c, Math.PI / 2), 2, 0, 1);   // turned to face -z
  assert.ok(own.h.dir.z < -0.99 && Math.abs(own.h.dir.x) < 1e-6);
  assert.ok(own.h.p.z < 42 && Math.abs(own.h.p.x - 100) < 1e-6);
});

test('a steam engine\'s fire glows under the ashpan at night and flickers; a diesel has none', () => {
  const c = load(), L = engine(c), own = {};
  let lo = 9, hi = 0;
  for (let t = 0; t < 3; t += 0.05) { c.X.trainLights(own, L, 0, 1, 1, t); lo = Math.min(lo, own.f.lv); hi = Math.max(hi, own.f.lv); }
  assert.ok(lo >= 0.6 && hi <= 1 && hi - lo > 0.1, `flicker ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  assert.ok(Math.abs(own.f.p.x - 94) < 1e-6 && own.f.p.y > 2 && own.f.p.y < 2.9, 'under the ashpan, above the ties');
  assert.ok(own.f.dir.y === -1 && own.f.cos > 0 && own.f.cos < 0.5, 'shines down on the track, not sideways onto the wheel faces');
  assert.ok(c.LAMP_KINDS.fire.col > 0xff0000 && c.LAMP_KINDS.fire.r < 8, 'a small orange pool');
  c.X.trainLights(own, L, 0, 0.3, 1, 0); assert.ok(own.f.lv < 0.35, 'a low fire is dimmer');
  c.X.trainLights(own, L, 0, 0, 1, 0); assert.strictEqual(own.f.lv, 0);
  const D = engine(c); delete D.ash; const o2 = {};
  c.X.trainLights(o2, D, 2, 1, 1, 0); assert.strictEqual(o2.f.lv, 0, 'no ashpan, no glow');
});

test('a hidden train goes dark, a removed one leaves the registry, and it can come back', () => {
  const c = load(), L = engine(c), own = {};
  c.X.trainLightsOff(undefined); c.X.trainLightsOff({});   // nothing to do, nothing thrown
  c.X.trainLights(own, L, 2, 1, 1);
  c.X.trainLightsOff(own); assert.strictEqual(own.h.lv + own.f.lv, 0); assert.strictEqual(c.LAMPS.lights.length, 2);
  c.X.trainLightsOff(own, true); assert.strictEqual(c.LAMPS.lights.length, 0);
  c.X.trainLights(own, L, 2, 1, 1); assert.strictEqual(c.LAMPS.lights.length, 2); assert.strictEqual(own.h.lv, 1);
});
