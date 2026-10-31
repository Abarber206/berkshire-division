/* ============================================================================
   Headless harness: loads the simulation source from src/ into a Node VM with
   a small stand-in for three.js and no-op browser hooks, so the boiler, air
   brake, coupling and track code can be stepped and checked without a page or GPU.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const FILES = ['01_util.js', '02_track.js', '06_models.js', '06d_cab.js', '06e_hsr.js', '07_train.js', '07b_cars.js', '07c_place.js', '08_physics.js', '11d_jobs.js', '11e_traffic.js', '11g_save.js'];
const EXPORTS = ['S', 'ENV', 'GAME', 'CARS', 'JOB', 'LOCO_SPEC', 'HSR', 'HS_AERO', 'setVehicle', 'hsLimit', 'turnoutDerailMph', 'Consist', 'Cut', 'physicsStep', 'brakeZone', 'brakeLabel', 'consistMass',
  'COUPLE_OK', 'COUPLE_HARD', 'COUPLE_DAMAGE', 'COUPLE_WRECK', 'KN_CLOSED', 'KN_OPEN', 'KN_LIFTED', 'HANDBRAKE', 'MPH', 'LBF', 'STON', 'PSI',
  'curveUnbalanced', 'CURVE_WARN', 'CURVE_TIP', 'CURVE_HOLD', 'PathBuilder', 'Network', 'TrackPos', 'FOUL_LEN', 'POINTS_CLEAR',
  'IX', 'AI', 'routeWalk', 'PLACE', 'PLACE_SNAP', 'PLACE_CLEAR', 'endCoupler', 'carVehicle', 'signalRoute', 'signalAspect', 'swPair',
  'SAVE', 'consistOut', 'seatConsist', 'vehicleIn', 'stateOut', 'jobOut', 'jobIn', 'tpOut', 'lineOut',
  'CTL', 'ctlTravel', 'ctlSetTravel', 'pullToWhistle', 'whistleToPull', 'dialAngle', 'glassLevel', 'stokerNext', 'CAB_READ', 'DIALS'];

/* just enough three.js: real Vector3 math, everything else accepts any call and returns itself */
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  addVectors(a, b) { return this.set(a.x + b.x, a.y + b.y, a.z + b.z); }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  multiplyScalar(k) { return this.set(this.x * k, this.y * k, this.z * k); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  negate() { return this.set(-this.x, -this.y, -this.z); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  addScaledVector(v, k) { return this.set(this.x + v.x * k, this.y + v.y * k, this.z + v.z * k); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}
function Anything() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : (k in t ? t[k] : (t[k] = Anything()))),
    set: (t, k, v) => { t[k] = v; return true; },
    apply: () => proxy,
    construct: () => Anything(),
  });
  return proxy;
}
const THREE = new Proxy({ Vector3 }, { get: (t, k) => (k in t ? t[k] : (t[k] = Anything())) });

/* a fresh copy of the simulation, so tests never share state */
function load() {
  const log = { events: [], fails: [], derails: [], toasts: [], sounds: [] };
  const ctx = {
    THREE, console, Math, performance: { now: () => ctx.__now }, __now: 0,
    document: { getElementById: () => Anything() }, localStorage: { getItem: () => null, setItem() {} },
    camera: { position: new Vector3(0, 0, 0) }, scene: { add() {}, remove() {} },
    toast: (msg, kind) => log.toasts.push({ msg, kind: kind || '' }),
    sndCouple: g => log.sounds.push(['couple', g]), sndClunk: g => log.sounds.push(['clunk', g]), sndPin: g => log.sounds.push(['pin', g]),
    linearizeObject() {}, truckGeos: () => ({}), plainAxle: () => ({}), newFrame: () => ({ p: new Vector3(), f: new Vector3(1, 0, 0), u: new Vector3(0, 1, 0) }),
    MP: { on: false, noteThrow() {} }, WORLD: { custom: false },
    SCN: { signals: [], crossings: [] }, RemoteTrain: class {},
  };
  vm.createContext(ctx);
  const code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n')
    + '\nconst GAME = { train: null, fail: (t, m) => __log.fails.push(t), derail: (m, t) => __log.derails.push(m), event: e => __log.events.push(e) };'
    + `\n({ ${EXPORTS.join(', ')} });`;
  ctx.__log = log;
  const sim = vm.runInContext(code, ctx, { filename: 'berkshire-sim.js' });
  sim.log = log; sim.ctx = ctx;
  return sim;
}

/* ------------------------------------------------------------------ fixtures
   Vehicles carry only what the physics reads: kind, mass, axles, brake state
   and two body pivots on straight track of a given grade (rise per metre). */
function pivot(grade, limit) {
  return { F: { f: new Vector3(1, grade, 0).normalize(), p: new Vector3(), u: new Vector3(0, 1, 0) }, tp: { e: { curv: () => 0, limit }, s: 0, o: 1, pose() {} } };
}
function vehicle(kind, mass, axles, opt = {}) {
  const v = { kind, mass, axles, len: opt.len || 15, area: opt.area || 0, brakeA: opt.brakeA || (kind === 'coach' ? 0.95 : 0.5),
    brake: { AR: 90, BC: 0, BP: 90, emerg: false, released: true, ...(opt.brake || {}) }, kn: [0, 0], flip: false, trucks: [], frame: [2, 13], root: Anything() };
  v.fp = [pivot(opt.grade || 0, opt.limit || 70), pivot(opt.grade || 0, opt.limit || 70)];
  v.ptsAll = v.fp.map(p => ({ ...p, loc: 0, a: 0 }));
  v.pos = new Vector3();
  return v;
}
const FREIGHT_CAR = 65 * 907.185;   // a loaded 65-ton car, kg

/* a Berkshire (locomotive, tender) plus nCars freight cars, as a consist the physics and CARS accept */
function train(sim, nCars = 0, opt = {}) {
  const spec = sim.LOCO_SPEC[opt.loco || '765'];
  const V = [vehicle('loco', spec.weight * 0.4536, 10, { ...opt, area: 125, brakeA: 0.55 }), vehicle('tender', 0, 6, { ...opt, brakeA: 0.6 })];
  for (let i = 0; i < nCars; i++) V.push(vehicle(opt.car || 'box', FREIGHT_CAR, 4, opt));
  const T = stubConsist(V);
  Object.assign(T, { locoKey: opt.loco || '765', diesel: false, nUnits: 1, tenderEmpty: 92000 });
  sim.GAME.train = T;
  return T;
}
/* a high-speed trainset (key 'e5' or 'acela') as the physics sees it: every car a vehicle of the set */
function trainset(sim, key, opt = {}) {
  const cars = sim.HSR[key].cars, V = cars.map((def, i) => {
    const [aeroLead, aero] = sim.HS_AERO[key][def.type];
    const m = { len: def.len, frame: [3, def.len - 3], mass: def.t * 1000, motor: !!def.motor, aero, aeroLead, reversed: i === cars.length - 1 };
    const v = Object.assign(vehicle('coach', m.mass, 4, opt), sim.setVehicle(m, i));
    v.fp = [pivot(opt.grade || 0, opt.limit || 200), pivot(opt.grade || 0, opt.limit || 200)];
    return v;
  });
  const T = stubConsist(V);
  Object.assign(T, { locoKey: key, diesel: true, elec: true, nUnits: 1 });
  Object.assign(sim.S, { pan: 1, panUp: true, vcb: true, cocks: false, indH: 0, brakeH: 0.12 });
  sim.GAME.train = T;
  return T;
}
/* a consist with the geometry and rendering hooks switched off */
function stubConsist(vehicles) {
  return { vehicles, li: 0, inst: [], scene: { remove() {}, add() {} }, v: 0, rolling: false, stopT: 0, vented: false, dist: 0,
    release() {}, adopt() {}, layout() { this.li = Math.max(0, this.vehicles.findIndex(v => v.kind === 'loco')); }, buildInstances() {}, update() {} };
}

/* step the physics; until(sim) can stop early. Returns simulated seconds run. */
function run(sim, T, seconds, until, dt = 1 / 30) {
  let t = 0;
  for (; t < seconds; t += dt) {
    sim.S.time += dt;
    sim.physicsStep(dt, T);
    if (until && until(sim, t)) break;
  }
  return t;
}

module.exports = { Anything, THREE, load, train, trainset, vehicle, stubConsist, run, FREIGHT_CAR, Vector3 };
