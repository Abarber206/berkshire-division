/* Far woods (src/05f_farwoods.js): the woodlots and fence rows drawn out to the horizon keep clear of the track,
   the roads and the water, stand on the ground (no block floating, none with a gap under it), and on the mountain
   the canopy skin lies under the ground wherever the forest stops (at the track, the rivers and clearings).
   Builds the routes with the real three.js, no page or GPU.
   Run with: node --test tests/*.test.js (needs tests/vendor/three.min.js, as the clearance test does). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const THREE_JS = path.join(__dirname, 'vendor', 'three.min.js');
const FILES = {
  ohio: ['01_util.js', '02_track.js', '03_route.js', '04_world.js', '04c_foliage.js', '05_scenery.js', '05b_detail.js', '05f_farwoods.js'],
  laurel: ['01_util.js', '02_track.js', '03_route.js', '03c_mountain.js', '04_world.js', '04b_mountain.js', '04c_foliage.js', '05_scenery.js', '05b_detail.js', '05d_mountain.js', '05f_farwoods.js'],
};
const BUILD = {
  ohio: `WORLD.custom = false; buildRoute(); buildLattice();`,
  laurel: `WORLD.custom = false; WORLD.roadsX = []; WORLD.roadN = 1e7; buildMountainRoute(); mtPrepare(); buildLattice();`,
};
function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))), set: (t, k, v) => { t[k] = v; return true }, apply: () => proxy });
  return proxy;
}
function world(route) {
  const ctx = { console, Math, performance: { now: () => 0 }, self: {}, window: {}, location: { search: '?route=' + route },
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => Anything(), style: {} }), getElementById: () => Anything() },
    localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(THREE_JS, 'utf8'), ctx, { filename: 'three.min.js' });
  const code = FILES[route].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + `
    const scene = new THREE.Group(); var SKY = { snow: false };
    ${BUILD[route]}
    buildTrackHash(); WORLD.treeTiles = [];
    WORLD.fieldTex = { planted: () => true };
    ({ NET, FR, WORLD, INNER, FIELD, FARW, scene, farFieldWoods, farCanopyAt, farSkinGeo, buildFarBlocks, farWoodsPalette, groundAt, heightRaw, riverDist,
       trackWithin: typeof trackWithin === 'function' ? trackWithin : null })`;
  return vm.runInContext(code, ctx, { filename: 'berkshire-farwoods.js' });
}
const SKIP = !fs.existsSync(THREE_JS) && !process.env.CI && 'tests/vendor/three.min.js missing (npm pack three@0.128.0)';

/* points over a block's footprint, every ~10 m: [X, N] */
function footprint([kind, X0, N0, alongX, L, W]) {
  const out = [], ax = alongX ? 1 : 0, an = alongX ? 0 : 1, px = an, pn = -ax;
  for (let u = 0; u <= L + 0.01; u += Math.min(10, L)) for (let v = -W / 2; v <= W / 2 + 0.01; v += Math.min(10, W)) out.push([X0 + ax * u + px * v, N0 + an * u + pn * v]);
  return out;
}

test('Ohio far woodlots and fence rows keep clear of the track, the roads and the water', { skip: SKIP }, () => {
  const W = world('ohio'), I = W.INNER;
  const list = W.farFieldWoods(I.x0, I.x1, I.n0, I.n1);
  const lots = list.filter(w => w[0] === 0), rows = list.filter(w => w[0] === 1);
  assert.ok(lots.length > 150 && rows.length > 600, `${lots.length} woodlots, ${rows.length} fence rows`);
  let near = 0, wet = 0, road = 0, firstWet = '';
  for (const w of list) for (const [X, N] of footprint(w)) {
    // the crowns reach 4 to 7 m past the block's trunks; the planted ones stand 24 m or more from the track
    if (W.trackWithin(X, N, w[0] ? 14 : 12)) near++;
    if (W.riverDist(X, N) < (w[0] ? 25 : 5)) { if (!wet) firstWet = [w.join(' '), X.toFixed(0), N.toFixed(0), W.riverDist(X, N).toFixed(1)].join(' / '); wet++; }
    if (w[0] === 1 && W.WORLD.roadsX.some(rx => Math.abs(X - rx) < 6)) road++;
  }
  assert.equal(near, 0, 'block points beside a track');
  assert.equal(wet, 0, 'block points in a river or lake: ' + firstWet);
  assert.equal(road, 0, 'fence-row points on a road');
});

test('Ohio far blocks stand on the ground: sunk at every corner, tops at tree height above it', { skip: SKIP }, () => {
  const W = world('ohio');
  W.farWoodsPalette(); W.buildFarBlocks(W.scene);
  const im = W.FARW.meshes[0], m = new im.matrixWorld.constructor(), e = m.elements, n = im.count;
  assert.ok(n > 3000, n + ' blocks');
  let floating = 0, short = 0, worst = 0;
  for (let k = 0; k < n; k += 7) {
    im.getMatrixAt(k, m);
    // the unit block runs y -0.3 .. 1 (farBlockGeo); a local point (x, y, z) lands at origin + x A + y U + z C
    for (const [x, z] of [[0, -0.5], [1, -0.5], [0, 0.5], [1, 0.5], [0.5, 0], [0.25, 0.25], [0.75, -0.25]]) {
      const X = e[12] + x * e[0] + z * e[8], Nn = -(e[14] + x * e[2] + z * e[10]);
      const base = e[13] + x * e[1] + z * e[9], g = W.groundAt(X, Nn);
      const bottom = base - 0.3 * e[5], top = base + 0.7 * e[5];
      if (bottom > g - 0.5) floating++;
      if (top - g < 7) short++;
      worst = Math.max(worst, bottom - g);
    }
  }
  assert.equal(floating, 0, `block sides end above the ground (worst ${worst.toFixed(2)} m)`);
  assert.equal(short, 0, 'block canopy less than 7 m over the ground');
});

test('Laurel Mountain canopy skin: none at the track or the rivers, and sunk under the ground where the woods end', { skip: SKIP }, () => {
  const W = world('laurel'), I = W.INNER;
  // the forest stops at the track
  let atTrack = 0, n = 0;
  for (const e of W.NET.edges) for (let s = 0; s <= e.len; s += 40) {
    if (e.isTunnel && e.isTunnel(s)) continue;
    e.pose(s, W.FR); const X = W.FR.p.x, N = -W.FR.p.z;
    n++; if (W.farCanopyAt(X, N, W.heightRaw(X, N)) > 0.001) atTrack++;
  }
  assert.ok(n > 500); assert.equal(atTrack, 0, 'canopy over the track');
  // a block of skin over the middle of the route: where cover is nil the skin lies below the ground; elsewhere at most tree height over it
  const x0 = (I.x0 + I.x1) / 2 - 1500, n0 = (I.n0 + I.n1) / 2 - 1500;
  const g = W.farSkinGeo(x0, n0, 75, 41, 41, (X, N) => W.groundAt(X, N));
  assert.ok(g, 'skin built');
  const p = g.attributes.position, fw = g.attributes.aFw;
  let bare = 0, wooded = 0, bad = 0;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), N = -p.getZ(i), h = W.groundAt(X, N), c = fw.getX(i), y = p.getY(i);
    if (c === 0) { bare++; if (y > h - 2) bad++; }
    else { wooded++; if (y > h + W.FARW.H + 0.01 || y < h - 3.01) bad++; }
  }
  assert.ok(bare > 20 && wooded > 400, `${bare} bare, ${wooded} wooded nodes`);
  assert.equal(bad, 0, 'skin nodes out of place');
});
