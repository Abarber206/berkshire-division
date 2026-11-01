/* Union Pacific GTEL 8500 gas turbine: built to UP's diagram (cab unit, turbine unit and fuel tender each one piece on
   its trucks, nothing floating, inside the clearance outline), and pulling like one in the headless physics: 212,312 lbf
   starting, 146,000 lbf continuous at 18 mph, 65 mph top speed, power only once the turbine is up to speed, started by
   the auxiliary diesel and burning Bunker C. Run with: node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const { have, world, prep, modelPieces, components, describe } = require('./geocheck');

const FT = 0.3048, IN = 0.0254;
const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what}: ${v.toFixed(3)}, want ${want.toFixed(3)} ± ${tol}`);
const skip = !have && 'no tests/vendor/three.min.js';

/* every piece of a unit with its trucks set under the truck centres, as 07_train places them on straight track */
function unitPieces(w, m) {
  const P = modelPieces(m.root);
  m.trucks.forEach((tg, k) => {
    const x = m.len / 2 - m.frame[k];
    for (const p of modelPieces(tg)) { const g = new w.THREE.BufferGeometry(); g.setFromPoints(p.v); g.translate(x, 0, 0); P.push(prep(w.THREE, g, p.k, p.at)); }
  });
  return P;
}
function solid(name, P) {
  const C = components(P);
  assert.equal(C.length, 1, `${name}: ${C.length - 1} loose group(s) apart from the model (${P.length} pieces):\n  ` + C.slice(1).slice(0, 12).map(describe).join('\n  '));
}
function bounds(w, P) { const b = new w.THREE.Box3(); for (const p of P) b.union(p.box); return b; }

test('the gas turbine is built to Union Pacific\'s diagram', { skip }, () => {
  const w = world(), { GT, GTT } = w;
  near(GT.lenA, 69 * FT + 6 * IN, 0.005, 'cab unit over the pulling faces');
  near(GT.lenB, 63 * FT, 0.005, 'turbine unit');
  near(GT.lenA + GT.lenB, 132 * FT + 6 * IN, 0.005, 'both units');
  near(GT.lenA + GT.lenB + GTT.len, 178 * FT + 11.25 * IN, 0.005, 'units and fuel tender');
  near(GT.lenA - 2 * GT.tc, 40 * FT + 8 * IN, 0.005, 'truck centres, cab unit');
  near(GT.lenB - 2 * GT.tc, 34 * FT + 2 * IN, 0.005, 'truck centres, turbine unit');
  near(GT.tc - GT.axle, 7 * FT + 2 * IN, 0.005, 'first axle from the coupler face');
  // total wheelbase: first axle of the cab unit to the last of the turbine unit
  near(GT.lenA + GT.lenB - 2 * (GT.tc - GT.axle), 118 * FT + 2 * IN, 0.005, 'total wheelbase');
  near(2 * GT.rW, 40 * IN, 0.001, 'wheels'); near(2 * GTT.R, 36 * IN, 0.001, 'tender wheels');
  near(GTT.len - 2 * GTT.tc, 23 * FT + 5 * IN, 0.005, 'tender truck centres');
  for (const [name, m] of [['cab unit', w.buildTurbineUnit({ unit: 'A' })], ['turbine unit', w.buildTurbineUnit({ unit: 'B' })]]) {
    const b = bounds(w, unitPieces(w, m));
    assert.ok(b.max.y <= 16 * FT + 0.01, `${name}: ${b.max.y.toFixed(3)} m high, 16 ft is ${(16 * FT).toFixed(3)}`);
    assert.ok(b.max.z - b.min.z <= 11 * FT, `${name}: ${(b.max.z - b.min.z).toFixed(2)} m wide`);
    near(b.min.y, 0, 0.04, `${name}: wheels on the rail`);
    assert.ok(b.max.x - b.min.x <= m.len + 0.16, `${name}: nothing past the coupler knuckles`);   // the knuckles' noses stand a little proud of the pulling faces
    assert.equal(m.wheels.length, 6, `${name}: six axles`);
  }
  const T = w.buildTurbineTender(), tb = bounds(w, modelPieces(T.root));
  assert.ok(tb.max.y <= 16 * FT + 0.01 && tb.max.z - tb.min.z <= 11 * FT, 'tender inside the clearance outline');
  near(tb.max.y, GTT.rail, 0.03, 'tender railing height');
});

test('cab unit, turbine unit and fuel tender are each one piece, nothing floating', { skip }, () => {
  const w = world();
  solid('cab unit', unitPieces(w, w.buildTurbineUnit({ unit: 'A', number: 18 })));
  solid('turbine unit', unitPieces(w, w.buildTurbineUnit({ unit: 'B', number: 18 })));
  solid('fuel tender', modelPieces(w.buildTurbineTender(18).root));
});

test('the cab has the turbine\'s gauges and controls', { skip }, () => {
  const w = world(), A = w.buildTurbineUnit({ unit: 'A' }), ids = A.cab.ctls.map(c => c.id);
  for (const k of ['throttle', 'turbine', 'dyn', 'reverser', 'brake', 'ind', 'horn', 'engine', 'tspd', 'egt', 'load', 'speed']) assert.ok(ids.includes(k), `no ${k} in the cab`);
  // the eye inside the cab, behind the windshield, at a seated engineer's height
  assert.ok(A.cabEye.y > 3.9 && A.cabEye.y < 4.4 && A.cabEye.z > 0.4 && A.cabEye.z < 1.3);
});

/* the turbine as the physics sees it: two units, the tender and n cars */
function turbineTrain(sim, nCars, opt = {}) {
  const { GT } = sim, mk = h.vehicle;
  const V = [mk('loco', GT.massA * 0.4536, 6, { ...opt, area: 125, brakeA: 0.6 }), mk('loco2', GT.massB * 0.4536, 6, { ...opt, brakeA: 0.6 }), mk('tender', 0, 6, { ...opt, brakeA: 0.6 })];
  for (let i = 0; i < nCars; i++) V.push(mk(opt.car || 'box', h.FREIGHT_CAR, 4, opt));
  const T = h.stubConsist(V);
  Object.assign(T, { locoKey: '18', diesel: true, turb: true, nUnits: 2, tenderEmpty: sim.LOCO_SPEC['18'].tenderEmpty });
  sim.GAME.train = T;
  Object.assign(sim.S, { tOn: true, tStart: 0, tspd: sim.GTE.idle, oil: sim.GTP.oilFull, fuel: sim.GTP.dslFull, egt: sim.GTE.egtIdle, engineRun: true, rpm: 450, cocks: false, indH: 0, brakeH: 0, reverser: 1, load: 0 });
  return T;
}

test('the turbine starts at 212,312 lbf and holds 146,000 lbf at 18 mph', () => {
  const sim = h.load(), { S, LBF, MPH } = sim;
  const T = turbineTrain(sim, 120, { grade: 0.02 });
  S.throttle = 1; S.sander = true;
  h.run(sim, T, 25);
  assert.ok(S.TE / LBF > 195000 && S.TE / LBF < 214000, `starting effort ${Math.round(S.TE / LBF)} lbf`);
  // at 18 mph with the turbine flat out
  const T2 = turbineTrain(sim, 0); Object.assign(S, { throttle: 1, tspd: 1, load: 1, v: 18 * MPH, vw: 18 * MPH });
  h.run(sim, T2, 0.2);
  near(S.TE / LBF / 1000, 146, 6, 'continuous effort at 18 mph, klbf');
});

test('power comes with the turbine\'s speed, the aux diesel alone only creeps, top speed 65 mph', () => {
  const sim = h.load(), { S, MPH, LBF, GTE } = sim;
  // notched straight out from idle: the shaft has to come up before the power does
  let T = turbineTrain(sim, 0); Object.assign(S, { throttle: 1, v: 20 * MPH, vw: 20 * MPH });
  h.run(sim, T, 1);
  const early = S.TE * S.v;
  h.run(sim, T, 15);
  assert.ok(S.tspd > 0.97, `shaft at ${S.tspd.toFixed(2)} of full speed after 16 s`);
  assert.ok(S.TE * S.v > 2.5 * early, 'power grows as the turbine spools up');
  near(S.TE * S.v / 745.7, 7000, 400, 'horsepower at the rail');
  // light engine, flat out, on the level: governed at 65 mph
  T = turbineTrain(sim, 0); Object.assign(S, { throttle: 1, tspd: 1, load: 1, v: 60 * MPH, vw: 60 * MPH });
  h.run(sim, T, 120);
  assert.ok(S.v / MPH < 67 && S.v / MPH > 62, `top speed ${(S.v / MPH).toFixed(1)} mph`);
  // turbine shut down: the auxiliary diesel moves the engine, but slowly
  T = turbineTrain(sim, 0); Object.assign(S, { tOn: false, tspd: GTE.cool, throttle: 1, v: 0, vw: 0 });
  h.run(sim, T, 60);
  assert.ok(S.v / MPH > 2 && S.v / MPH < 25, `aux diesel alone: ${(S.v / MPH).toFixed(1)} mph after a minute`);
  assert.ok(S.TE / LBF < 40000);
});

test('the aux diesel cranks the turbine, it lights off, and it burns Bunker C', () => {
  const sim = h.load(), { S, GTE, GTP } = sim;
  const T = turbineTrain(sim, 0);
  Object.assign(S, { tOn: false, tspd: 0, egt: 90, engineRun: false, brakeH: 0.9, indH: 1 });
  sim.turbineSwitch();
  assert.equal(S.tStart, 0, 'no start without the aux diesel running');
  S.engineRun = true; sim.turbineSwitch();
  assert.ok(S.tStart > 0);
  const fuel0 = S.fuel;
  const t = h.run(sim, T, 120, s => s.S.tOn);
  assert.ok(S.tOn && t > 30 && t < 60, `up to idle in ${t.toFixed(0)} s`);
  assert.ok(S.fuel < fuel0, 'starts on diesel fuel');
  assert.ok(sim.log.events.includes('turbineOn'));
  // running: Bunker C goes, about 860 gal an hour flat out
  Object.assign(S, { throttle: 1, brakeH: 0, indH: 0, tspd: 1, load: 1, v: 15, vw: 15 });
  const oil0 = S.oil; h.run(sim, T, 60);
  const gph = (oil0 - S.oil) / 3.785 * 60;
  assert.ok(gph > 650 && gph < 1050, `${gph.toFixed(0)} gal an hour`);
  assert.ok(S.egt > 750 && S.egt <= GTE.egtMax, `exhaust ${S.egt.toFixed(0)} °F`);
  // the tender gets lighter as it burns
  assert.ok(sim.consistMass(T) < T.tenderEmpty + GTP.oilFull * 0.97 + (sim.GT.massA + sim.GT.massB) * 0.4536);
  // shut down: it runs down to the cool-down crank
  sim.turbineSwitch(); S.throttle = 0;
  h.run(sim, T, 90);
  assert.ok(!S.tOn && Math.abs(S.tspd - GTE.cool) < 0.03, `cool-down crank at ${(S.tspd * GTE.rpm).toFixed(0)} rpm`);
});
