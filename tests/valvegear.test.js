/* The valve gear is timed as on the real engines, which have piston valves with inside admission: the valve
   leads the piston. At front dead centre it stands ahead of its middle position (lap and lead, from the
   combination lever), in forward gear it is furthest forward within the first quarter turn after that, in back
   gear within the last quarter turn before it, and in mid gear it only makes the lever's short travel.
   Run with: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./geocheck');

/* one turn of the wheels in gear `rev`: where in the turn (degrees after front dead centre, in forward rotation)
   the valve is furthest forward, its travel, and how far ahead of its middle position it stands at dead centre */
function events(anim, rods, rev) {
  let best = [-Infinity, 0], lo = Infinity, hi = -Infinity, xFDC = -Infinity, vFDC = 0, iFDC = 0;
  for (let i = 0; i < 360; i += 2) {
    anim(-i * Math.PI / 180, rev);
    const v = rods.vstem.position.x, x = rods.cross.position.x;
    if (v > best[0]) best = [v, i];
    lo = Math.min(lo, v); hi = Math.max(hi, v);
    if (x > xFDC) { xFDC = x; vFDC = v; iFDC = i; }
  }
  return { at: (best[1] - iFDC + 360) % 360, travel: hi - lo, lead: vFDC - (hi + lo) / 2 };
}
function timed(name, anim, rods) {
  const f = events(anim, rods, 1), b = events(anim, rods, -1), m = events(anim, rods, 0);
  assert.ok(f.at >= 30 && f.at <= 88, `${name}: in forward gear the valve is furthest forward ${f.at} deg after dead centre`);
  assert.ok(b.at >= 272 && b.at <= 330, `${name}: in back gear the valve is furthest forward ${b.at} deg after dead centre`);
  assert.ok(m.at <= 16 || m.at >= 344, `${name}: in mid gear the valve only follows the crosshead (furthest forward at ${m.at} deg)`);
  for (const [k, e] of [['forward', f], ['back', b], ['mid', m]]) assert.ok(e.lead > 0.02, `${name}: in ${k} gear the valve leads at dead centre (${e.lead.toFixed(3)} m)`);
  assert.ok(m.travel < 0.6 * Math.min(f.travel, b.travel), `${name}: mid gear travel ${m.travel.toFixed(3)} is well short of full gear ${f.travel.toFixed(3)} / ${b.travel.toFixed(3)}`);
  assert.ok(f.travel > 0.15 && f.travel < 0.3 && b.travel > 0.15 && b.travel < 0.3, `${name}: full gear travel ${f.travel.toFixed(3)} / ${b.travel.toFixed(3)} m is near the real 7 in`);
  assert.ok(Math.abs(f.travel - b.travel) < 0.06, `${name}: forward and back gear give about the same travel`);
}

test('Berkshire Baker gear: the valves lead the pistons, forward and back', () => {
  const w = G.world();
  for (const key of ['765', '1225']) { const L = w.buildBerkshire(key); for (const s of [1, -1]) timed(`${key} ${s > 0 ? 'right' : 'left'}`, (th, rev) => w.animateBerkshire(L, th, rev), L.parts.rods[s]); }
});

test('Big Boy Walschaerts gear: the valves lead the pistons on both engines, forward and back', () => {
  const w = G.world(), L = w.buildBigBoy('4014');
  for (const e of ['f', 'r']) for (const s of [1, -1]) timed(`4014 ${e === 'f' ? 'front' : 'rear'} engine ${s > 0 ? 'right' : 'left'}`, (th, rev) => w.animateBigBoy(L, 0, th, rev, 0), L.parts.eng[e].rods[s]);
});
