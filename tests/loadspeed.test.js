/* Faster loading must not change what gets built. mergeGeos unrolls indexed parts itself now (instead of copying
   each through toNonIndexed first), and every coach shares one built saloon: both must give the same geometry
   as before. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world } = require('./geocheck');
const skip = !have && 'no tests/vendor/three.min.js';

/* the merge as it was: every indexed part through toNonIndexed */
function mergeOld(THREE, list) {
  let n = 0; const parts = []; let hasColor = false;
  for (const g of list) { const gg = g.index ? g.toNonIndexed() : g; if (!gg.attributes.normal) gg.computeVertexNormals(); parts.push(gg); n += gg.attributes.position.count; if (gg.attributes.color) hasColor = true; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = hasColor ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) { if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3); }
    o += c;
  }
  return { pos, nor, uv, col };
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test('mergeGeos gives exactly what the toNonIndexed merge gave', { skip }, () => {
  const w = world(), T = w.THREE;
  const parts = () => {
    const c = new T.BoxGeometry(1, 1, 1); c.setAttribute('color', new T.BufferAttribute(new Float32Array(c.attributes.position.count * 3).map((_, i) => (i % 7) / 7), 3));
    const bare = new T.BoxGeometry(2, 1, 1); bare.deleteAttribute('normal');   // no normals: still goes the old way (flat normals)
    return [new T.BoxGeometry(1, 2, 3).translate(1, 0, 0), new T.CylinderGeometry(1, 1, 2, 7).toNonIndexed(), new T.SphereGeometry(1, 5, 4), c, new T.TorusGeometry(1, 0.2, 4, 6), bare];
  };
  const a = w.mergeGeos(parts()), b = mergeOld(T, parts());
  assert.ok(same(a.attributes.position.array, b.pos), 'positions');
  assert.ok(same(a.attributes.normal.array, b.nor), 'normals');
  assert.ok(same(a.attributes.uv.array, b.uv), 'uvs');
  assert.ok(same(a.attributes.color.array, b.col), 'colours');
});

test('every coach shares one saloon, the same shape as building it fresh', { skip }, () => {
  const w = world();
  for (const obs of [false, true]) {
    const a = w.coachInterior(obs), b = w.coachInterior(obs);
    const ga = a.children.map(m => m.geometry), gb = b.children.map(m => m.geometry);
    assert.ok(ga.length > 5 && ga.every((g, i) => g === gb[i]), 'the second coach reuses the first one\'s geometry');
    // and it is what the bins merge to
    const fresh = w.coachInteriorBin(obs).build(w.RMAT, { cast: false });
    assert.deepEqual(fresh.children.map(m => m.name), a.children.map(m => m.name));
    fresh.children.forEach((m, i) => assert.ok(same(m.geometry.attributes.position.array, ga[i].attributes.position.array), m.name));
  }
});
