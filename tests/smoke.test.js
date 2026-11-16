/* Steam engine smoke (src/10_sky_fx.js): the atlas has thick billows and thin curling wisps, a beat worked hard
   puts out more, bigger and darker smoke than one at a light throttle, a puff holds thick through its climb and
   turns to wisps as it twists away, dead puffs draw nothing, and phones and lower settings make less of it.
   Runs the real three.js r128 (tests/vendor) with a stand-in GL context. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

function load(opts = {}) {
  const ctx = { console, Math, innerHeight: 900, self: {}, window: {}, document: { createElement: () => ({ getContext: () => null }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = fs.readFileSync(path.join(SRC, '01_util.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SRC, '10_sky_fx.js'), 'utf8') + `
    var GFX = { lite: ${!!opts.phone} }, POST = { key: ${JSON.stringify(opts.gfx || 'high')} };
    var ENV = { wind: new THREE.Vector3(1.5, 0, 0.5) };
    var renderer = { getContext: () => ({ ALIASED_POINT_SIZE_RANGE: 1, getParameter: () => [1, 1024] }) };
    var ppPx = () => 1;
    SKY.keyDir = new THREE.Vector3(0.3, 0.8, 0.2); SKY.sun = { intensity: 2, color: new THREE.Color(1, 1, 1) };
    const scene = new THREE.Group(); buildFX(scene);
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
    ({ FX, smokeAtlas, smkBeat, smkDrift, emit, updateFX, smkQuality, cam, THREE, setGfx: k => { POST.key = k; } })`;
  return vm.runInContext(code, ctx, { filename: 'berkshire-smoke.js' });
}
const live = (FX) => { const out = []; for (let i = 0; i < FX.N; i++) if (FX.age[i] <= FX.life[i]) out.push(i); return out; };
function beat(W, inten, gv) {
  const { FX, THREE } = W, before = FX.next;
  W.smkBeat(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, 0), 12, inten, gv);
  const ids = []; for (let i = before; i !== FX.next; i = (i + 1) % FX.N) ids.push(i);
  return ids;
}

test('the atlas holds four round billows and four thin, curling wisps', { skip: SKIP }, () => {
  const W = load(), { data, SX, C } = W.smokeAtlas().userData;
  const cover = (cell) => {
    const cx = (cell % 4) * C, cy = (cell >> 2) * C; let fill = 0, sum = 0;
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const a = data[((cy + y) * SX + cx + x) * 4 + 3] / 255; sum += a; if (a > 0.35) fill++; }
    return { fill: fill / (C * C), mean: sum / (C * C) };
  };
  for (let c = 0; c < 4; c++) {
    const b = cover(c), w = cover(c + 4);
    assert.ok(b.fill > 0.18, `billow ${c} is a thick body (${b.fill.toFixed(2)})`);
    assert.ok(w.mean > 0.03, `wisp ${c} has smoke in it (${w.mean.toFixed(3)})`);
    assert.ok(w.fill < b.fill * 0.6, `wisp ${c} is threads, not a body (${w.fill.toFixed(2)} vs ${b.fill.toFixed(2)})`);
  }
});

test('working hard puts out more, bigger, thicker and darker smoke than a light throttle', { skip: SKIP }, () => {
  const W = load(), { FX } = W;
  const light = beat(W, 0.2, 0.8), hard = beat(W, 1.2, 0.35);
  assert.ok(hard.length > light.length, `${hard.length} puffs vs ${light.length}`);
  const avg = (ids, f) => ids.reduce((s, i) => s + f(i), 0) / ids.length;
  assert.ok(avg(hard, i => FX.s1[i]) > avg(light, i => FX.s1[i]) * 1.3, 'hard beats billow bigger');
  assert.ok(avg(hard, i => FX.a0[i]) > avg(light, i => FX.a0[i]), 'and thicker');
  assert.ok(avg(hard, i => FX.base[i * 3]) < avg(light, i => FX.base[i * 3]), 'and darker');
  assert.ok(avg(hard, i => FX.life[i]) > 9, 'a working plume hangs in the air a long while');
  // light and dark puffs through the plume, not one flat grey
  const g = hard.map(i => FX.base[i * 3]);
  assert.ok(Math.max(...g) - Math.min(...g) > 0.04, 'the puffs vary in shade');
});

test('a puff holds thick through its climb, then curls apart into wisps and thins away', { skip: SKIP }, () => {
  const W = load(), { FX, THREE } = W;
  const i = W.emit(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 12, 0), 12, 1.5, 24, 0.8, [0.4, 0.4, 0.4], 1, 1, 1.2);
  const j = W.emit(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 12, 0), 12, 1.5, 24, 0.8, [0.4, 0.4, 0.4], 1, 1, 0);   // same puff, still air
  const at = {};
  for (let k = 1; k <= 240; k++) { W.updateFX(0.05, W.cam); if (k === 60 || k === 180) at[k] = { a: FX.alpha[i], w: FX.wisp[i], s: FX.size[i], c: FX.col[i * 3] }; }
  assert.ok(at[60].a > 0.5, `still thick a quarter of the way up (${at[60].a.toFixed(2)})`);
  assert.ok(at[60].w < at[180].w && at[180].w > 0.6, 'turns to wisps as it ages');
  assert.ok(at[180].a < at[60].a && at[180].s > at[60].s, 'spreads and thins');
  assert.ok(at[180].c > at[60].c, 'and lightens as it mixes with the air');
  // the swirling flow pushes it off the straight path the still-air puff takes
  const d = Math.hypot(FX.pos[i * 3] - FX.pos[j * 3], FX.pos[i * 3 + 1] - FX.pos[j * 3 + 1], FX.pos[i * 3 + 2] - FX.pos[j * 3 + 2]);
  assert.ok(d > 1.5, `it twists away from a straight rise (${d.toFixed(1)} m)`);
  assert.equal(FX.wisp[j], 0, 'a puff without curl stays a billow');
});

test('a dead puff draws nothing', { skip: SKIP }, () => {
  const W = load(), { FX } = W;
  beat(W, 1, 0.5);
  for (let k = 0; k < 600; k++) W.updateFX(0.05, W.cam);   // 30 s, longer than any puff lives
  assert.equal(live(FX).length, 0);
  for (let i = 0; i < FX.N; i++) { assert.equal(FX.size[i], 0); assert.equal(FX.alpha[i], 0); }
});

test('an engine drifting with the throttle shut leaves a lazy, curling column', { skip: SKIP }, () => {
  const W = load(), { FX, THREE } = W;
  const i = FX.next; W.smkDrift(new THREE.Vector3(0, 5, 0), new THREE.Vector3(), 0.3, 0.6, 3);
  assert.ok(FX.curl[i] > FX.curl[beat(W, 1, 0.5)[0]] * 0.9, 'drifting smoke curls at least as much as a beat');
  assert.ok(FX.a0[i] < 0.5 && FX.vel[i * 3 + 1] < 5, 'thin and slow');
});

test('phones keep a smaller pool, and lower settings make fewer puffs a beat', { skip: SKIP }, () => {
  const pc = load(), phone = load({ phone: true });
  assert.ok(phone.FX.N < pc.FX.N && phone.FX.N >= 2000, `${phone.FX.N} vs ${pc.FX.N}`);
  assert.ok(phone.smkQuality() <= 0.7);
  const hi = beat(pc, 1, 0.5).length; pc.setGfx('low'); const lo = beat(pc, 1, 0.5).length; pc.setGfx('ultra'); const ul = beat(pc, 1, 0.5).length;
  assert.ok(lo < hi && ul > hi, `low ${lo}, high ${hi}, ultra ${ul}`);
  assert.ok(beat(phone, 1, 0.5).length < hi);
});
