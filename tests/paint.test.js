/* Paint schemes: the real roads' diesel liveries, the coaches matching the engine's road, and the observation
   car's roof marker. Run with: node --test tests/*.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { have, world, modelPieces, components, describe } = require('./geocheck');
const skip = !have && 'no tests/vendor/three.min.js';

test('every real road livery is complete and its bands lie on the body sides', { skip }, () => {
  const w = world(), real = Object.keys(w.LIVERIES).filter(k => w.LIVERIES[k].real);
  assert.deepEqual(real.sort(), ['bo', 'co', 'nkp', 'nw', 'nyc', 'pm', 'prr']);
  for (const k of real) {
    const L = w.LIVERIES[k];
    for (const f of ['name', 'sub', 'road', 'init', 'num', 'body', 'roof', 'accent', 'letter', 'rail', 'nose', 'herald', 'font']) assert.ok(L[f] !== undefined, `${k}.${f}`);
    for (const [y0, y1] of L.bands || []) assert.ok(y0 >= w.LSIDE.y0 && y1 <= 4.5 && y1 > y0, `${k} band ${y0}-${y1}`);
    // a unit builds in it, side band decal and all
    const m = w.buildDiesel({ livery: L, number: L.num, lead: true });
    assert.ok(m.skin.lSide && m.skin.lSide.map, `${k}: side band decal`);
  }
});

test('a mixed lashup runs real roads behind a real road and made-up roads behind a made-up one', { skip }, () => {
  const w = world();
  for (const k of w.liveryMixOrder('nkp')) assert.ok(w.LIVERIES[k].real, k);
  for (const k of w.liveryMixOrder('ss')) assert.ok(!w.LIVERIES[k].real, k);
  assert.ok(!w.liveryMixOrder('nkp').includes('nkp'));
});

test('coaches match the engine: each steam road and each real livery has its own colours and lettering', { skip }, () => {
  const w = world();
  for (const short of ['NKP', 'PM', 'C&O', 'UP']) assert.ok(w.ROAD_COACH[short], short);
  for (const k of Object.keys(w.LIVERIES).filter(k => w.LIVERIES[k].real)) assert.ok(w.ROAD_COACH[w.LIVERIES[k].init], k);
  // behind the diesel the letterboard carries the livery's road
  assert.equal(w.coachSpecOf('diesel', 'nyc').road, 'NEW YORK CENTRAL');
  assert.equal(w.coachSpecOf('diesel', 'custom').road, w.LOCO_SPEC.diesel.road);
  assert.equal(w.coachSpecOf('765', 'nyc').road, 'NICKEL PLATE ROAD');
  assert.equal(w.COACH_PAINT.road !== undefined, true);
});

test('the observation car roof marker lamp sits on the roof as one piece with the car', { skip }, () => {
  const w = world(), m = w.coachModel(w.LOCO_SPEC['1225'], 3059, true);
  const u = m.root.userData;
  assert.ok(u.roofLamp && u.markerSets && u.markerSets.roof.length === 1 && u.markerSets.side.length === 2);
  const P = modelPieces(m.root), C = components(P);
  assert.equal(C.length, 1, C.slice(1).map(describe).join('\n'));
  // the lens faces the rear and stands above the roof
  const lens = u.markerSets.roof[0];
  assert.ok(lens.y > 4.3 && lens.x < -10, `lens at ${lens.x.toFixed(2)}, ${lens.y.toFixed(2)}`);
});
