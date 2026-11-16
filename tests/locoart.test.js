/* The side views on the menu's Locomotive cards (src/12a_locoart.js, made by tools/locoart.js from the in-game
   models): every engine has one, each is a sound PNG mask of the right size, and each picture is an engine side on,
   standing on the bottom edge and filling the card across or up. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const h = require('./harness');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', '12a_locoart.js'), 'utf8');
const ctx = {}; vm.createContext(ctx); vm.runInContext(SRC + '\nthis.LOCO_ART = LOCO_ART; this.LOCO_ART_SIZE = LOCO_ART_SIZE;', ctx);
const { LOCO_ART, LOCO_ART_SIZE } = ctx;

/* the alpha channel of a 8-bit greyscale + alpha PNG, as rows */
function alphaOf(url) {
  const b = Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64');
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature');
  let p = 8, w, ht, idat = [];
  while (p < b.length) {
    const n = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + n);
    if (type === 'IHDR') { w = d.readUInt32BE(0); ht = d.readUInt32BE(4); assert.equal(d[8], 8, 'bit depth'); assert.equal(d[9], 4, 'grey + alpha'); }
    if (type === 'IDAT') idat.push(d);
    p += 12 + n;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), rows = [];
  for (let y = 0; y < ht; y++) { assert.equal(raw[y * (w * 2 + 1)], 0, 'unfiltered rows'); const r = new Uint8Array(w); for (let x = 0; x < w; x++) r[x] = raw[y * (w * 2 + 1) + 2 + x * 2]; rows.push(r); }
  return { w, h: ht, rows };
}

test('every engine in the game has a side view for its card', () => {
  const sim = h.load();
  const keys = Object.keys(sim.LOCO_SPEC);
  assert.ok(keys.length >= 8);
  for (const k of keys) assert.ok(LOCO_ART[k], `no card art for engine '${k}': run ./build.sh && node tools/locoart.js && ./build.sh`);
  for (const k in LOCO_ART) assert.ok(keys.includes(k), `card art for '${k}', which is not an engine`);
});

test('each side view is an engine standing on the bottom edge, filling the card across or up', () => {
  const [W, H] = LOCO_ART_SIZE;
  for (const k in LOCO_ART) {
    const a = alphaOf(LOCO_ART[k]);
    assert.equal(a.w, W, k + ' width'); assert.equal(a.h, H, k + ' height');
    let x0 = W, x1 = -1, y0 = H, y1 = -1, on = 0;
    a.rows.forEach((r, y) => r.forEach((v, x) => { if (v > 40) { on++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
    assert.ok(y1 >= H - 2, `${k}: stands ${H - 1 - y1} px above the bottom edge`);
    const across = (x1 - x0 + 1) / W, up = (y1 - y0 + 1) / H;
    assert.ok(across > 0.97 || up > 0.97, `${k}: fills ${(across * 100).toFixed(0)}% across and ${(up * 100).toFixed(0)}% up`);
    assert.ok(across > up * H / W, `${k}: taller than it is long`);
    const fill = on / ((x1 - x0 + 1) * (y1 - y0 + 1));
    assert.ok(fill > 0.3 && fill < 0.95, `${k}: ${(fill * 100).toFixed(0)}% of its box is solid, not an engine's shape`);
  }
});

test('the side views differ from one another', () => {
  const ks = Object.keys(LOCO_ART);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) assert.notEqual(LOCO_ART[ks[i]], LOCO_ART[ks[j]], `${ks[i]} and ${ks[j]} share a picture`);
});
