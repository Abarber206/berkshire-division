/* Winter snow: the coat on the trees and trains builds while it snows and thaws after, survives a save, and
   only the outside of the rolling stock takes it (cabs, coach saloons and the warm boiler stay dry). The tree
   models carry a snow weight on every corner. Run with: node --test tests/ (needs tests/vendor/three.min.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

function weather() {
  const ctx = { THREE: new Proxy({}, { get: () => function () {} }), Math, console };
  vm.createContext(ctx);
  vm.runInContext(['01_util.js', '10d_weather.js'].map(read).join('\n') + '\nthis.X = { WX, WX_KINDS, wxSet, wxStep, wxOut, wxIn, wxLayStep };', ctx);
  return ctx.X;
}
function withThree(files, tail) {
  const ctx = { console, Math, document: { createElement: () => ({ getContext: () => null }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', 'three.min.js'), 'utf8'), ctx);
  return vm.runInContext(files.map(read).join('\n') + '\n' + tail, ctx);
}

test('snow builds a full coat in a few minutes of snowfall and thaws slowly after it stops', () => {
  const X = weather();
  X.wxSet('clear', 3);
  assert.strictEqual(X.WX.lay, 0, 'no snow lying in summer');
  X.wxSet('snow', 3);
  const start = X.WX.lay;
  assert.ok(start >= 0.45 && start <= 0.55, `starting in a snowfall, some has fallen already (${start})`);
  X.WX.lay = 0;
  let t = 0; while (X.WX.lay < 0.999 && t < 3600) { X.wxStep(1, 0.2); t++; }
  assert.ok(t > 240 && t < 600, `a full coat takes ${t} s of steady snow`);
  // fixed clear winter sky afterwards: still lying a few minutes on, gone within the hour
  X.wxSet('winter', 9); X.WX.walk = false; X.WX.from = X.WX.to = 'clear'; X.WX.t = X.WX.dur = 1; X.WX.hold = 1e9;
  for (let i = 0; i < 300; i++) X.wxStep(1, 1);
  assert.ok(X.WX.lay > 0.6, `five minutes of sun leaves most of it (${X.WX.lay.toFixed(2)})`);
  for (let i = 0; i < 3300; i++) X.wxStep(1, 1);
  assert.strictEqual(X.WX.lay, 0, 'an hour of winter sun clears it');
});

test('changing winter skies keep the snow that lies; summer thaws it in a minute or two', () => {
  const X = weather();
  X.wxSet('snow', 4); X.WX.lay = 0.9;
  X.wxSet('winter', 4);
  assert.strictEqual(X.WX.lay, 0.9, 'Snow to Winter keeps the coat');
  X.wxSet('clear', 4);
  for (let i = 0; i < 150; i++) X.wxStep(1, 1);
  assert.strictEqual(X.WX.lay, 0, 'gone in summer');
  assert.strictEqual(X.wxLayStep(0.5, 10, { snow: 0.8 }, 1, true), 0.5 + 10 / 360);
});

test('the coat is saved with the weather and comes back', () => {
  const X = weather();
  X.wxSet('winter', 7); X.WX.lay = 0.637;
  const d = JSON.parse(JSON.stringify(X.wxOut()));
  X.wxSet('clear', 7); X.WX.lay = 0;
  assert.ok(X.wxIn(d));
  assert.strictEqual(X.WX.lay, 0.637);
  delete d.lay; assert.ok(X.wxIn(d));
  assert.ok(X.WX.lay >= 0.3, 'an old save in winter gets the light starting coat');
});

test('only the outside of the rolling stock takes the coat; insides, the boiler and moving parts stay dry', () => {
  const R = withThree(['01_util.js', '10i_snow.js'], `
    var RMAT = { black: new THREE.MeshStandardMaterial({ color: 0x111111 }), dark: new THREE.MeshStandardMaterial(), rod: new THREE.MeshStandardMaterial(),
      glass: new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.4 }), win: new THREE.MeshStandardMaterial({ emissive: 0xffc77a }) };
    const mats = { ...RMAT, jacket: RMAT.black };
    const scen = { black: new THREE.MeshStandardMaterial(), wall: new THREE.MeshStandardMaterial() };
    const out = { outside: snowMat(mats, 'black', {}), jacket: snowMat(mats, 'jacket', {}), inside: snowMat(mats, 'dark', { cast: false }), dark: snowMat(mats, 'dark', {}),
      rod: snowMat(mats, 'rod', {}), glass: snowMat(mats, 'glass', {}), win: snowMat(mats, 'win', {}), house: snowMat(scen, 'wall', {}) };
    ({ RMAT, out, scen, coated: m => SNOWC.done.has(m), twinOf: m => SNOWC.twins.get(m) })`);
  const { RMAT, out } = R;
  assert.strictEqual(out.outside, RMAT.black); assert.ok(R.coated(RMAT.black), 'the black paint takes snow');
  assert.notStrictEqual(out.jacket, RMAT.black, 'the boiler jacket is a dry twin');
  assert.ok(!R.coated(out.jacket) && out.jacket.color === RMAT.black.color, 'the twin shares the colour');
  assert.ok(!R.coated(out.inside) && out.inside !== RMAT.dark && out.dark === RMAT.dark && R.coated(RMAT.dark), 'cab insides are dry, the same paint outside is not');
  assert.strictEqual(R.twinOf(RMAT.dark), out.inside, 'one twin per material');
  assert.ok(!R.coated(RMAT.rod) && !R.coated(RMAT.glass) && !R.coated(RMAT.win), 'rods, glass and lit windows stay clear');
  assert.ok(!R.coated(R.scen.wall), 'scenery is left alone');
  // the shader goes in: the coat is drawn on the surface in the paint's own pass
  const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <metalnessmap_fragment>' };
  RMAT.black.onBeforeCompile(sh);
  assert.ok(sh.uniforms.uSnowLay && /snowCov/.test(sh.fragmentShader) && /vSnN/.test(sh.vertexShader));
});

test('every tree corner carries a snow weight, highest on the tops of the sprays and limbs', () => {
  const G = withThree(['01_util.js', '04c_foliage.js'], `({ dec: hardwoodGeo(11), con: coniferGeo(5), bush: bushGeo(3) })`);
  for (const k of ['dec', 'con', 'bush']) {
    const g = G[k], a = g.attributes.aSnow, n = g.attributes.position.count;
    assert.ok(a && a.count === n, `${k}: one snow weight per vertex`);
    for (let i = 0; i < n; i++) assert.ok(a.getX(i) >= 0 && a.getX(i) <= 1, `${k} weight in 0..1`);
  }
  // the conifer: the upper corners of the sprays hold more than the lower ones
  const g = G.con, a = g.attributes.aSnow, p = g.attributes.position, leaf = g.attributes.aLeaf;
  let up = 0, nu = 0, dn = 0, nd = 0;
  let i0 = 0; while (!leaf.getX(i0)) i0++;   // the trunk comes first; the sprays are four corners each after it
  for (let i = i0; i + 3 < p.count; i += 4) {
    let hi = 0, lo = 0; for (let j = 1; j < 4; j++) { if (p.getY(i + j) > p.getY(i + hi)) hi = j; if (p.getY(i + j) < p.getY(i + lo)) lo = j; }
    up += a.getX(i + hi); nu++; dn += a.getX(i + lo); nd++;
  }
  assert.ok(up / nu > dn / nd + 0.25, `sprays: top corners ${(up / nu).toFixed(2)} vs bottom ${(dn / nd).toFixed(2)}`);
});
