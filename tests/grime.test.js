/* Weathering on the engines and cars (06l_grime.js) and the rounded domes and smokebox fronts (06_models.js).
   Run with: node --test tests/ (needs tests/vendor/three.min.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
function withThree(files, tail) {
  const ctx = { console, Math, document: { createElement: () => ({ getContext: () => null }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor', 'three.min.js'), 'utf8'), ctx);
  return vm.runInContext(files.map(read).join('\n') + '\n' + tail, ctx);
}
const SHADER = () => ({ uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <metalnessmap_fragment>' });

test('every outside paint takes weathering; glass, lamps, rods and polished metal stay clean', () => {
  const R = withThree(['01_util.js', '06l_grime.js', '10i_snow.js'], `
    const S = (o = {}) => new THREE.MeshStandardMaterial(o);
    var RMAT = { black: S({ color: 0x111111 }), graphite: S(), dark: S(), rod: S(), brass: S(), oxideW: S(), hopW: S(),
      glass: S({ transparent: true, opacity: 0.4 }), win: S({ emissive: 0xffc77a }), lens: new THREE.MeshBasicMaterial(),
      num: S({ transparent: true, alphaTest: 0.35 }), body: S(), ci: S() };
    grmTag(RMAT.body, 'diesel');
    const mats = { ...RMAT, jacket: RMAT.black };
    const out = {}; for (const k of Object.keys(mats)) out[k] = snowMat(mats, k, {});
    out.inside = snowMat(mats, 'dark', { cast: false });
    ({ RMAT, out, has: m => GRM.mats.has(m), U: m => GRM.mats.get(m), snow: m => SNOWC.done.has(m) })`);
  const { RMAT, out } = R;
  for (const k of ['black', 'graphite', 'dark', 'oxideW', 'hopW', 'body', 'num']) assert.ok(R.has(out[k]), k + ' is weathered');
  for (const k of ['rod', 'brass', 'glass', 'win', 'lens', 'ci']) assert.ok(!R.has(out[k]), k + ' stays clean');
  assert.ok(R.has(out.jacket) && out.jacket !== RMAT.black, 'the boiler jacket is a dry twin that is still weathered');
  // the heavier wear goes where it belongs
  const A = k => R.U(out[k]).uGrA.value, B = k => R.U(out[k]).uGrB.value;
  assert.ok(A('hopW').z > A('black').z * 5, 'hoppers rust, the engine barely');
  assert.ok(B('graphite').z > 0.3 && B('black').z === 0, 'only the smokebox goes ashy with heat');
  assert.ok(B('dark').x > B('black').x, 'running gear is oilier than the boiler');
  assert.ok(A('num').x < A('black').x && A('num').z === 0, 'lettering takes a lighter coat and never rusts, so it stays readable');
  assert.ok(A('inside').y === 0 && A('inside').x < A('dark').x * 0.5, 'a cab inside gets a light coat, no rain streaks');
  // weathering and the snow coat share one pass on the same paint
  assert.ok(R.snow(RMAT.black) && R.has(RMAT.black));
  const sh = SHADER(); RMAT.black.onBeforeCompile(sh);
  assert.ok(/snowCov/.test(sh.fragmentShader) && /uGrA/.test(sh.fragmentShader) && sh.uniforms.uGrK && sh.uniforms.uSnowLay);
  assert.ok(sh.fragmentShader.indexOf('uGrK > 0.001') < sh.fragmentShader.indexOf('snowCov ='), 'the snow lies on top of the grime');
  assert.ok(/vGrP = transformed/.test(sh.vertexShader), 'placed by the model\'s own coordinates, so it rides with the train');
  assert.strictEqual(RMAT.black.customProgramCacheKey(), 'snowcoat|grime');
  const sh2 = SHADER(); out.jacket.onBeforeCompile(sh2);
  assert.ok(!/snowCov/.test(sh2.fragmentShader) && /uGrA/.test(sh2.fragmentShader), 'the warm boiler: grime but never snow');
});

test('the Graphics tab can wash the trains clean', () => {
  const R = withThree(['01_util.js', '06l_grime.js'], `({ GRM, GRM_LEVELS, grmLevel })`);
  R.grmLevel('off'); assert.strictEqual(R.GRM.K.value, 0);
  R.grmLevel('light'); assert.ok(R.GRM.K.value > 0 && R.GRM.K.value < 1);
  R.grmLevel('nonsense'); assert.strictEqual(R.GRM.K.value, 1);
  assert.strictEqual(Object.keys(R.GRM_LEVELS).join(), 'off,light,full');
});

test('domes are rounded, their skirt meets them without a lip, and half() follows the surface', () => {
  const R = withThree(['01_util.js', '06_models.js'], `(function () {
    const out = [];
    for (const [L, w, h, np] of [[1.08, 1.02, 0.67, 2.4], [2.76, 0.92, 0.65, 3.0], [1.1, 0.95, 0.6, 2.6]]) {
      const d = domeShape(L, w, h, np), p = d.geos[0].attributes.position, q = d.geos[1].attributes.position;
      let maxX = 0, maxY = 0, maxZ = 0, worst = 0, flatTop = 0;
      for (let i = 0; i < p.count; i++) { maxX = Math.max(maxX, Math.abs(p.getX(i))); maxY = Math.max(maxY, p.getY(i)); maxZ = Math.max(maxZ, Math.abs(p.getZ(i)));
        const y = p.getY(i); if (y > 0.02 && y < h - 0.02) worst = Math.max(worst, Math.abs(Math.abs(p.getZ(i)) - d.half(p.getX(i), y)) * (Math.abs(p.getX(i)) < 0.05 ? 1 : 0)); }
      // the skirt's top ring lies on the dome's base curve
      let gap = 0; for (let i = 0; i < q.count; i++) { if (q.getY(i) < 0) continue; const x = q.getX(i), z = q.getZ(i); let best = 1;
        for (let j = 0; j < p.count; j++) if (Math.abs(p.getY(j)) < 1e-6) best = Math.min(best, Math.hypot(p.getX(j) - x, p.getZ(j) - z)); gap = Math.max(gap, best); }
      out.push({ L, w, h, maxX, maxY, maxZ, worst, gap, skirtBottom: Math.min(...Array.from({ length: q.count }, (_, i) => q.getY(i))) });
    }
    return out; })()`);
  for (const r of R) {
    assert.ok(Math.abs(r.maxX - r.L / 2) < 0.005 && Math.abs(r.maxZ - r.w / 2) < 0.005 && Math.abs(r.maxY - r.h) < 0.002, 'the dome keeps its drawn length, width and height');
    assert.ok(r.gap < 0.002, `skirt and dome share one base line (gap ${r.gap.toFixed(4)} m)`);
    assert.ok(r.skirtBottom < -0.3, 'the skirt reaches down into the boiler');
    assert.ok(r.worst < 0.01, `half() matches the surface across the middle (${r.worst.toFixed(4)} m)`);
  }
});

test('a smokebox door is a smooth dish: no corners, no point in the middle, same rim, inside the old outline', () => {
  const R = withThree(['01_util.js', '06_models.js'], `({ d: smokeDoorPts([[0, 0.9], [0.04, 0.9], [0.07, 0.86], [0.13, 0.58], [0.16, 0.0]]), ring: smokeRingPts(1.13) })`);
  const d = R.d;
  assert.strictEqual(JSON.stringify(d[0]), '[0,0.9]'); assert.ok(d[d.length - 1][0] > 0.145 && d[d.length - 1][0] <= 0.16 && d[d.length - 1][1] === 0);
  // never proud of the old straight cone from (0.13, 0.58) to the point, so nothing hung in front of the door hits it
  for (const [ax, r] of d) if (r < 0.58) assert.ok(ax <= 0.16 - 0.03 * r / 0.58 + 1e-9, `inside the old outline at r ${r.toFixed(2)}`);
  assert.ok(d.length > 15, 'enough points to read as a curve');
  for (let i = 1; i < d.length; i++) assert.ok(d[i][0] >= d[i - 1][0] - 1e-9 && d[i][1] <= d[i - 1][1] + 1e-9, 'the dish only bulges outward toward the centre');
  const n = d.length, slope = (d[n - 1][0] - d[n - 2][0]) / (d[n - 2][1] - d[n - 1][1]);
  assert.ok(slope < 0.02, `the crown is flat in the middle (${slope.toFixed(3)})`);
  const ring = R.ring, R1 = Math.max(...ring.map(p => p[1]));
  assert.ok(Math.abs(R1 - 1.155) < 1e-6 && ring.length > 12, 'the front ring stands 25 mm proud with rolled edges');
});
