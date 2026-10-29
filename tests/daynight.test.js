/* The day/night clock: sun and moon positions, the sky's look by sun height, and that nothing in the
   light jumps as the clock runs. Run with: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const ctx = { THREE: new Proxy({}, { get: () => function () {} }), Math, console };
vm.createContext(ctx);
vm.runInContext(['01_util.js', '10a_daynight.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') +
  '\nthis.X = { DN, DN_KEYS, dnSun, dnMoon, dnDir, dnHourAt, dnLook, dnDark, dnStars, dnMoonK, dnChorus, dnFmt, dnWrap };', ctx);
const X = ctx.X;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b} (±${tol})`);

test('the sun: noon height, due south at noon, rises in the east and sets in the west', () => {
  const noon = X.dnSun(12);
  near(noon.el, 90 - X.DN.lat + X.DN.dec, 0.01, 'noon elevation');
  near(noon.az, 180, 0.01, 'noon azimuth');
  const rise = X.dnHourAt(-0.83, false), set = X.dnHourAt(-0.83, true);
  near(set - rise, 13.1, 0.25, 'length of the day (h)');
  near(X.dnSun(rise).el, -0.83, 0.01, 'sunrise found by dnHourAt');
  const ar = X.dnSun(rise).az, as = X.dnSun(set).az;
  assert.ok(ar > 70 && ar < 90, `sunrise azimuth ${ar}`);
  assert.ok(as > 270 && as < 290, `sunset azimuth ${as}`);
  // the direction vector agrees with the world's axes: east +x, north -z, up +y
  const d = X.dnDir({ el: 0, az: 90 }, {}); near(d.x, 1, 1e-9, 'east x');
  const n = X.dnDir({ el: 0, az: 0 }, {}); near(n.z, -1, 1e-9, 'north -z');
});

test('the menu start times light the scene as the old fixed looks did', () => {
  const s = X.DN.starts;
  near(X.dnSun(s.morning.h).el, 13, 0.5, 'Morning sun');
  near(X.dnSun(s.golden.h).el, 6.5, 0.5, 'Golden hour sun');
  assert.ok(X.dnSun(s.noon.h).el > 55, 'Midday sun is high');
  assert.ok(X.dnSun(s.night.h).el < -18, 'Night is past astronomical twilight');
  assert.ok(X.dnMoon(s.night.h).el > 20, 'the moon is well up at Night');
  for (const k of ['dawn', 'dusk']) { const el = X.dnSun(s[k].h).el; assert.ok(el < -1 && el > -8, `${k} is in civil twilight (${el.toFixed(1)})`); }
  // the keys at 6.5, 13 and 56 degrees are the old presets, exactly
  const g = X.dnLook(6.5), m = X.dnLook(13), nn = X.dnLook(56), ni = X.dnLook(-30);
  assert.strictEqual(g.top, 0x4c6ea6); assert.strictEqual(g.hor, 0xf3ae6e); near(g.sunI, 2.3, 1e-9, 'golden sun');
  assert.strictEqual(m.top, 0x5f93d6); near(m.exp, 1.0, 1e-9, 'morning exposure');
  assert.strictEqual(nn.fog, 0xc6d5e2); assert.strictEqual(ni.top, 0x03070f); near(ni.hemiI, 0.16, 1e-9, 'night fill');
});

test('a full moon: up all night, down by day', () => {
  for (let h = 21; h <= 27; h += 0.5) assert.ok(X.dnMoon(h).el > 0, `moon up at ${h % 24}`);
  for (let h = 9; h <= 15; h += 0.5) assert.ok(X.dnMoon(h).el < 0, `moon down at ${h}`);
});

test('nothing in the light jumps as the clock runs through a day', () => {
  let prev = null;
  const ch = (c, s) => (c >> s) & 255;
  for (let m = 0; m <= 24 * 240; m++) {   // every 15 s of the day
    const h = m / 240, sb = X.dnSun(h), mb = X.dnMoon(h), L = X.dnLook(sb.el, {});
    const bySun = sb.el > -1.5;
    const key = bySun ? L.sunI : 0.22 * X.dnMoonK(sb.el, mb.el);
    const cur = { L, key, dark: X.dnDark(sb.el), stars: X.dnStars(sb.el), bySun };
    assert.ok(key >= 0 && key < 3, 'key light in range');
    if (prev) {
      for (const k of ['top', 'hor', 'fog', 'hemiS', 'cloud']) for (const s of [16, 8, 0]) assert.ok(Math.abs(ch(L[k], s) - ch(prev.L[k], s)) <= 3, `${k} jumps at ${X.dnFmt(h)}`);
      near(L.exp, prev.L.exp, 0.01, `exposure step at ${X.dnFmt(h)}`);
      near(L.hemiI, prev.L.hemiI, 0.02, `fill step at ${X.dnFmt(h)}`);
      // the key light changes from sun to moon (or back) only while both are too faint to matter
      if (cur.bySun !== prev.bySun) assert.ok(cur.key < 0.02 && prev.key < 0.02, `key light pops at ${X.dnFmt(h)}`);
      else near(cur.key, prev.key, 0.06, `key light step at ${X.dnFmt(h)}`);
      near(cur.dark, prev.dark, 0.03, `darkness step at ${X.dnFmt(h)}`);
    }
    prev = cur;
  }
});

test('darkness, stars and the dawn chorus follow the sun', () => {
  let p = -1;
  for (let el = 60; el >= -40; el -= 0.5) { const d = X.dnDark(el); assert.ok(d >= p - 1e-12, 'darkness only grows as the sun sinks'); p = d; }
  assert.strictEqual(X.dnDark(10), 0); assert.strictEqual(X.dnDark(-10), 1);
  assert.strictEqual(X.dnStars(0), 0); assert.strictEqual(X.dnStars(-20), 1);
  const rise = X.dnHourAt(0, false);
  assert.ok(X.dnChorus(rise, 0) > 0.9, 'birds in full voice at sunrise');
  assert.strictEqual(X.dnChorus(X.dnHourAt(0, true), 0), 0, 'no dawn chorus at sunset');
  assert.strictEqual(X.dnFmt(0), '12:00 AM'); assert.strictEqual(X.dnFmt(13.5), '1:30 PM'); assert.strictEqual(X.dnFmt(24 + 6.25), '6:15 AM');
});
