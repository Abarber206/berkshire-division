/* ============================================================================
   Save and resume: the whole run goes to localStorage. That is the railroad,
   every car where it stands (coupled or not, knuckles, handbrakes and air),
   the switches, the controls, boiler and air, the job sheet, the clock and
   weather, the traffic on the road, the camera, and a wreck as it came to
   rest. There is an autosave and three slots of your own. Single player only.
   ========================================================================== */
const SAVE = { VER: 1, SLOTS: ['auto', '1', '2', '3'], EVERY: 60, runT: 0, warned: false, armed: null };
SAVE.key = slot => 'bd_save_' + slot;
/* which railroad a save belongs to: a built-in route, or a layout from the editor */
SAVE.routeId = () => PLAY_LAYOUT ? PLAY_LAYOUT.id : 'route:' + ROUTE_KEY;
SAVE.routeName = id => id.startsWith('route:') ? (ROUTES[id.slice(6)] || ROUTES.ohio).name : ((LAYOUTS.get(id) || {}).name || 'Your layout');
/* the track as it was built: edge ids only mean the same track if this matches */
SAVE.print = () => `${NET.edges.length}:${NET.switches.length}:${Math.round(NET.edges.reduce((a, e) => a + e.len, 0))}`;
const rnd = (x, k = 1000) => Math.round(x * k) / k;

/* ---------------- track positions ---------------- */
/* exact: edge id, distance along it and facing */
const tpOut = tp => [tp.e.id, rnd(tp.s), tp.o];
function tpIn(a, E) { const e = a && E.get(a[0]); return e ? new TrackPos(e, clamp(a[1], 0, e.len), a[2] < 0 ? -1 : 1) : null; }
/* by name: the line and the distance along it, for when the track has been rebuilt since the save */
const lineOut = tp => tp.e.line ? [tp.e.line.name, rnd(tp.e.lineS0 + tp.s), tp.o] : null;
function lineIn(a) {
  const ln = a && ROUTE.lines[a[0]]; if (!ln) return null;
  const loc = ln.locate(clamp(a[1], 0, ln.len));
  return loc && loc.edge ? new TrackPos(loc.edge, loc.s, a[2] < 0 ? -1 : 1) : null;
}

/* ---------------- vehicles and consists ---------------- */
const brakeOut = b => ({ AR: rnd(b.AR), BC: rnd(b.BC), BP: rnd(b.BP), emerg: !!b.emerg, released: !!b.released });
/* one vehicle: power by its place in the engine's own list, a car by what it is */
function vehicleOut(v, power) {
  const o = { f: !!v.flip, kn: v.kn ? v.kn.slice() : [0, 0], b: brakeOut(v.brake), r: rnd(v.roll || 0), pts: v.ptsAll.map(p => tpOut(p.tp)) };
  const p = power.indexOf(v);
  if (p >= 0) o.p = p;
  else if (v.helper) o.hp = v.helper;   // a helper engine: built again from its own engine
  else { o.m = v.made || { type: v.kind, num: 0 }; o.w = Math.round(v.mass); }
  if (v.hb) o.hb = true;
  if (v.yard) o.y = true;
  if (v.placed) o.pl = true;
  if (v.slide) o.sl = true;
  if (v.job) o.j = v.job;
  const ind = IND.carOut(v); if (ind) o.ind = ind;   // the load and the waybill
  return o;
}
function consistOut(c, power = []) {
  return { v: c.vehicles.map(v => vehicleOut(v, power)), d: rnd(c.dist), front: lineOut(c.endTP('front')) };
}
/* a car built again from its record (not yet on the track) */
function carIn(o) {
  const m0 = o.m || { type: 'box', num: 0 };
  let m;
  if (m0.type === 'coach') m = coachModel(LOCO_SPEC[m0.rk] || LOCO_SPEC['765'], m0.num, !!m0.flag, TRIM[m0.tr] ? m0.tr : '');
  else { const road = ROAD_SHORT; if (m0.rs) ROAD_SHORT = m0.rs; m = freightModel(m0.type, m0.num, () => 0.5); ROAD_SHORT = road; }
  scene.add(m.root);
  const v = carVehicle(m); v.made = m0;
  if (o.w) v.mass = o.w;
  return v;
}
/* what a vehicle carries besides its model */
function vehicleIn(v, o) {
  v.flip = !!o.f; v.kn = (o.kn || [0, 0]).slice(); v.brake = Object.assign({ AR: 90, BC: 0, BP: 90, emerg: false, released: true }, o.b); v.roll = o.r || 0;
  v.hb = !!o.hb; v.yard = !!o.y; v.placed = !!o.pl; v.slide = !!o.sl;
  if (o.j) v.job = o.j; else delete v.job;
  IND.carIn(v, o.ind);
}
/* put a consist back on the rails: every tracked point where it was, or, if the track has changed, the
   front coupler where it was by line and the rest behind it as the switches lie */
function seatConsist(c, o, E) {
  let ok = !!E;
  if (ok) c.vehicles.forEach((v, i) => { const P = o.v[i].pts || []; if (P.length !== v.ptsAll.length) { ok = false; return; } v.ptsAll.forEach((p, j) => { const tp = tpIn(P[j], E); if (tp) p.tp = tp; else ok = false; }); });
  if (!ok) { const tp = lineIn(o.front); if (!tp) return false; c.place(tp); }
  c.dist = o.d || 0;
  return true;
}

/* ---------------- the wreck ---------------- */
const m4Out = m => m.elements.map(x => rnd(x, 1e5));
const m4In = a => new THREE.Matrix4().fromArray(a);
function wreckOut(T) {
  const R = T.rb, W = GAME.wrecking; if (!R || !S.derailed) return null;
  return {
    spec: T.wk, broken: [...R.broken], title: W ? W.title : 'Derailed', why: W ? W.why : '',
    bodies: R.bodies.map(b => ({ i: T.vehicles.indexOf(b.v), M0: m4Out(b.M0), t0: b.t0.map(m4Out), u0: b.u0 ? b.u0.map(m4Out) : null, l0: b.l0 ? m4Out(b.l0) : null, f0: b.f0 ? m4Out(b.f0) : null, s0: b.s0 ? m4Out(b.s0) : null, p: b.p.toArray().map(x => rnd(x)), q: b.q.toArray().map(x => rnd(x, 1e5)) })),
  };
}
/* the pile as it came to rest: each car off the rails where it lay, asleep until it is re-railed */
function wreckIn(T, w) {
  const R = Object.create(WreckSim.prototype);
  Object.assign(R, { T, spec: w.spec, r: rng((w.spec && w.spec.seed) || 1), bodies: [], t: 0, still: 0, asleep: true, acc: 0, kin: { v: 0, mass: 0, force: 0 }, broken: new Set(w.broken || []) });
  T.wk = w.spec; T.rb = R;
  WreckSim.couplers(T);
  const au = AU.on; AU.on = false;   // no clunks for a pile that fell long ago
  try {
    for (const s of w.bodies) {
      const v = T.vehicles[s.i]; if (!v || v.rb) continue;
      v.root.matrix.fromArray(s.M0);
      const b = R.derail(s.i, 0); if (!b) continue;
      b.t0 = s.t0.map(m4In); if (s.u0) b.u0 = s.u0.map(m4In); if (s.l0) b.l0 = m4In(s.l0); if (s.f0) b.f0 = m4In(s.f0); if (s.s0) b.s0 = m4In(s.s0);
      b.p.fromArray(s.p); b.q.fromArray(s.q).normalize(); b.lv.set(0, 0, 0); b.av.set(0, 0, 0); b.sleep = true;
      R.pose(b); v.pos.copy(b.p);
    }
  } finally { AU.on = au; }
}

/* ---------------- the job, the traffic, the camera ---------------- */
function jobOut(uid) {
  const R = JOB.run; if (!R || R.over) return null;
  const o = {};
  for (const k of ['t0', 'i', 'items', 'ep', 'moveAt', 'lastStop', 'lastV', 'score']) if (R[k] !== undefined) o[k] = R[k];
  o.id = R.def.id; o.steps = R.steps; o.cars = R.cars.map(v => uid.get(v)).filter(i => i !== undefined);
  return JSON.parse(JSON.stringify(o));
}
function jobIn(o, V) {
  const def = JOB.def(o.id); if (!def) return;
  JOB.closeUI();
  const R = JOB.run = { def, t0: o.t0, i: o.i, items: o.items || [], over: false, failed: null, ep: o.ep || {}, moveAt: o.moveAt == null ? null : o.moveAt, lastStop: o.lastStop || 0, lastV: o.lastV || 0, score: o.score,
    steps: def.steps.map((s, i) => ({ ...s, ...((o.steps || [])[i] || {}) })), cars: (o.cars || []).map(i => V[i]).filter(Boolean) };
  R.score = JOB.total(R).total;
  carPanelState.key = '';
  JOB.ui();
}
const aiOut = () => AI.trains.map(a => ({ id: a.id, f: tpOut(a.train.endTP('front')), fl: lineOut(a.train.endTP('front')), v: rnd(a.v), dwell: rnd(a.dwell), odo: rnd(a.odo), d: a.dir }));
/* the timetable trains, each where it was; each asks the signals for its road again, so one that had
   a clear road carries on at the speed it can still stop from */
function aiIn(list, E) {
  AI.clear();
  if (!AI.enabled() || !list) return;
  for (const o of list) {
    const def = TRAFFIC[o.id]; if (!def) continue;
    const tp = tpIn(o.f, E) || lineIn(o.fl); if (!tp) continue;
    const a = new AITrain(o.id, def);
    a.place(tp); a.odo = o.odo || 0; a.dwell = o.dwell || 0; if (o.d) a.dir = o.d;
    AI.trains.push(a); IX.idx = null;
  }
  for (const a of AI.trains) {
    const o = list.find(x => x.id === a.id), def = a.def;
    a.v = a.ask() ? Math.min(o.v || 0, Math.sqrt(2 * def.brake * 0.5 * Math.max(0, a.authLeft - 200))) : 0;
  }
}
const CAM_KEEP = ['yaw', 'pitch', 'dist', 'cabYaw', 'cabPitch', 'droneYaw', 'dronePitch'];

/* ---------------- what is saved ---------------- */
/* primitive values of the train state (controls, boiler, air, fuel, the clock) */
function stateOut() { const o = {}; for (const k in S) { const x = S[k]; if (typeof x === 'number' ? isFinite(x) : typeof x === 'boolean' || typeof x === 'string') o[k] = x; } delete o.paused; return o; }

/* the vehicles a train was built with: its engine (and tender or trailing units), or every car of a trainset */
const powerOf = T => T.vehicles.filter(v => !v.helper && (isPower(v) || (T.elec && T.units.some(m => m.vehicle === v))));
/* one of your other trains standing about (11l_fleet.js): how it was built, where every car is, and its engine as it was left */
function fleetOut(c) {
  return Object.assign(consistOut(c, powerOf(c)), { loco: c.locoKey, ck: c.consistKey, units: c.nUnits || 1, opts: JSON.parse(JSON.stringify(c.opts || {})), cfg: c.cfg || null,
    ps: c.parkS, cv: rnd(c.v || 0), rolling: !!c.rolling, stopT: rnd(c.stopT || 0), fid: c.fid || 0,
    crew: c.crew ? { mph: c.crew.mph, dir: c.crew.dir, keep: c.crew.keep ? 1 : 0 } : null, crewMph: c.crewMph || 0 });
}
/* a helper engine's vehicle from its record { g, loco, opts, i }: the engine is built once per helper (g) and
   its vehicles handed out one by one */
const HELPER_IN = new Map();
function helperIn(h) {
  if (!h || !LOCO_SPEC[h.loco]) throw new Error('a helper engine that can no longer be built');
  let X = HELPER_IN.get(h.g);
  if (!X) { X = new Train(scene, h.loco, 'light', Object.assign({}, h.opts, { dark: true })); for (const im of X.inst) scene.remove(im); HELPER_IN.set(h.g, X); }
  const v = X.vehicles[h.i]; if (!v) throw new Error('a helper engine has changed since this save');
  X.release(v); v.helper = h; if (v.kind === 'tender') v.mass = h.m || helperTender(X);
  return v;
}
/* Build train t's consist again from its record o: the engine as the Train made it, and its cars as they were.
   t was made up as a light engine, so everything it built is the engine (or the whole trainset). */
function trainIn(t, o, E) {
  const power = t.vehicles.slice(), V = [];
  for (const x of o.v) {
    const v = x.p !== undefined ? power[x.p] : x.hp ? helperIn(x.hp) : carIn(x);
    if (!v) throw new Error('the engine has changed since this save');
    vehicleIn(v, x);
    if (!v.ptsAll) t.track(v);
    t.markerLamps(v);
    V.push(v);
  }
  if (power.some(v => !V.includes(v))) throw new Error('the engine has changed since this save');
  t.vehicles = V; t.consistKey = o.ck || 'light';
  t.layout(); t.buildInstances();
  if (!seatConsist(t, o, E)) throw new Error('the train is not on this railroad');
  t.update(0);
  prepareTrain(t, true);
  return V;
}

/* the whole run, ready for JSON */
SAVE.snapshot = function () {
  const T = GAME.train, g = GAME.settings;
  const power = powerOf(T);
  const uid = new Map(); let n = 0;
  for (const c of [T, ...CARS.cuts]) for (const v of c.vehicles) uid.set(v, n++);
  const job = jobOut(uid), settings = {};
  for (const k of SAVE_KEYS) settings[k] = g[k];
  if (!job) settings.job = '';   // a finished job is not carried over: the run goes on free running
  const cam = { mode: CAM.mode }; for (const k of CAM_KEEP) if (CAM[k] !== undefined) cam[k] = CAM[k];
  const wreck = wreckOut(T), st = stateOut();
  if (!wreck) st.derailed = false;
  return {
    ver: SAVE.VER, at: Date.now(), route: SAVE.routeId(), print: SAVE.print(), settings,
    S: st, sw: NET.switches.map(s => [s.name, s.state]),
    train: Object.assign(consistOut(T, power), { loco: T.locoKey, ck: T.consistKey, units: T.nUnits || 1, fid: T.fid || 0 }),
    fleet: CARS.cuts.filter(c => c.parkS).map(fleetOut),
    cuts: CARS.cuts.filter(c => !c.parkS).map(c => Object.assign(consistOut(c), { cv: rnd(c.v), rolling: !!c.rolling, stopT: rnd(c.stopT || 0), vented: !!c.vented, home: c.home || null })),
    job, ai: aiOut(), sky: { hour: rnd(SKY.hour, 1e5), weather: SKY.weather, wx: wxOut() }, cam, wreck,
    ind: IND.out(),
    misc: { placed: PLACE.made || 0, lastStation: GAME.lastStation || null, spawnName: GAME.spawnName || '' },
    sum: SAVE.summary(T, job),
  };
};
/* the line shown for a save in the menu */
SAVE.summary = function (T, job) {
  const sp = LOCO_SPEC[T.locoKey];
  const loco = sp.set ? HSR[sp.set].name : sp.turb ? 'UP 18 gas turbine' : sp.diesel ? (T.nUnits > 1 ? `${T.nUnits} diesels` : 'Diesel') : `${sp.short} ${T.locoKey}`;
  const cars = T.vehicles.filter(v => !isPower(v)).length;
  let near = null, best = 3000;
  for (const st of ROUTE.stations) { const d = st.p ? st.p.distanceTo(T.lead.pos) : Infinity; if (d < best) { best = d; near = st.name; } }
  const jd = job && JOB.def(job.id), more = CARS.cuts.filter(c => c.parkS).length;
  return {
    title: jd ? jd.name : `${loco}${sp.set ? '' : cars ? ` · ${cars} car${cars > 1 ? 's' : ''}` : ' · light'}${more ? ` · +${more} train${more > 1 ? 's' : ''}` : ''}`,
    where: `${S.derailed ? 'Wrecked' : near ? (best < 400 ? 'At ' : 'Near ') + near : 'Out on the line'} · ${SAVE.routeName(SAVE.routeId())}`,
    clock: jd ? fmtClock(JOB.clock()) : dnFmt(SKY.hour),
  };
};

/* ---------------- storage ---------------- */
SAVE.read = function (slot) { try { const d = JSON.parse(localStorage.getItem(SAVE.key(slot)) || 'null'); return d && d.ver === SAVE.VER && d.train ? d : null; } catch (e) { return null; } };
SAVE.write = function (slot, d) {
  try { localStorage.setItem(SAVE.key(slot), JSON.stringify(d)); return true; }
  catch (e) { if (!SAVE.warned) { SAVE.warned = true; toast('Could not save: the browser has no room left for this site.', 'bad', 4500, 'savefail'); } return false; }
};
SAVE.remove = function (slot) { try { localStorage.removeItem(SAVE.key(slot)); } catch (e) {} };

/* ---------------- saving ---------------- */
/* why the run cannot be saved right now, or '' */
SAVE.blocked = function () {
  const T = GAME.train;
  if (!GAME.ready || !GAME.running || !T) return 'Start a run first.';
  if (MP.on) return 'Saves are for single player: leave the room to save.';
  if (PLACE.on) return 'Finish placing first.';
  if (S.derailed && (!T.rb || !T.rb.asleep || Math.abs(S.v) > 0.05)) return 'Wait until the wreck has come to rest.';
  return '';
};
SAVE.now = function (slot, quiet) {
  const why = SAVE.blocked();
  if (why) { if (!quiet) toast(why, 'warn', 3000, 'save'); return false; }
  let d; try { d = SAVE.snapshot(); } catch (e) { console.warn('save', e); if (!quiet) toast('Could not save this run.', 'bad', 3000, 'save'); return false; }
  if (!SAVE.write(slot, d)) return false;
  if (!quiet) toast(slot === 'auto' ? 'Saved.' : `Saved to slot ${slot}.`, 'good', 2200, 'save');
  SAVE.menu();
  return true;
};
/* the autosave: every minute of running, and whenever the menu comes up or the page is put away */
SAVE.tick = function (dt) {
  if (!GAME.running || S.paused || PLACE.on || MP.on) return;
  SAVE.runT += dt;
  if (SAVE.runT >= SAVE.EVERY && !SAVE.blocked()) { SAVE.runT = 0; SAVE.now('auto', true); }
};
SAVE.auto = function () { if (!SAVE.blocked()) { SAVE.runT = 0; SAVE.now('auto', true); } };

/* ---------------- loading ---------------- */
SAVE.load = function (slot) {
  const d = SAVE.read(slot);
  if (!d) { toast('That save could not be read.', 'bad', 3000, 'load'); return false; }
  if (MP.on) { toast('Leave the room first: saves are single player.', 'warn', 3500, 'load'); return false; }
  if (d.route !== SAVE.routeId()) {
    // another railroad: load it, then pick the run up once it is built
    if (!d.route.startsWith('route:') && !LAYOUTS.get(d.route)) { toast('That layout has been deleted, so this run cannot be loaded.', 'bad', 4000, 'load'); return false; }
    try { sessionStorage.setItem('bd_resume', slot); } catch (e) {}
    try { if (d.route.startsWith('route:')) localStorage.setItem('bd_route', d.route.slice(6)); } catch (e) {}
    location.href = location.pathname + (d.route.startsWith('route:') ? '?route=' + d.route.slice(6) : '?layout=' + encodeURIComponent(d.route));
    return true;
  }
  if (PLACE.on) PLACE.exit();
  try { SAVE.apply(d); }
  catch (e) {
    console.warn('load failed', e);
    toast('That save could not be loaded on this railroad. A new train is made up instead.', 'bad', 5000, 'load');
    GAME.running = false; JOB.end(); makeTrain(); return false;
  }
  return true;
};
/* rebuild the run from a save d (on the railroad it was made on) */
SAVE.apply = function (d) {
  const g = GAME.settings;
  for (const k of SAVE_KEYS) if (d.settings[k] !== undefined) g[k] = d.settings[k];
  g.loco = d.train.loco; if (!LOCO_SPEC[g.loco]) throw new Error('unknown engine ' + g.loco);
  if (LOCO_SPEC[g.loco].diesel && !LOCO_SPEC[g.loco].set && !LOCO_SPEC[g.loco].turb) g.units = d.train.units || 1;
  saveSettings(); SAVE.menuSync();
  const E = d.print === SAVE.print() ? new Map(NET.edges.map(e => [e.id, e])) : null;
  // clear the railroad
  if (JOB.run) JOB.end();
  AI.clear();
  CARS.clear(GAME.train);
  if (GAME.train) { GAME.train.wreck(null); GAME.train.dispose(); }
  GAME.wrecking = null; $('bigMsg').hidden = true; $('bigMsg').classList.remove('wreck');
  // the switches as they lay
  const byName = new Map(NET.switches.map(s => [s.name, s]));
  d.sw.forEach(([name, st], i) => { const s = E ? NET.switches[i] : byName.get(name); if (s) s.state = s.anim = st ? 1 : 0; });
  // the train: its engine as built, and its cars as they were
  const t = new Train(scene, g.loco, 'light', dieselOpts());
  GAME.train = t;
  HELPER_IN.clear();
  const V = trainIn(t, d.train, E);
  t.fid = d.train.fid || 0;
  // the cars standing about
  if (!CARS.geo) CARS.geo = carGeos();
  const all = [...V];
  for (const o of d.cuts || []) {
    const cv = o.v.map(x => { const v = x.hp ? helperIn(x.hp) : carIn(x); vehicleIn(v, x); linearizeObject(v.root); return v; });
    const c = new Cut(scene, cv);
    if (!seatConsist(c, o, E)) { c.dispose(); cv.forEach(freeVehicle); continue; }
    Object.assign(c, { v: o.cv || 0, rolling: !!o.rolling, stopT: o.stopT || 0, vented: !!o.vented, home: o.home || undefined });
    c.update(0);
    CARS.cuts.push(c); all.push(...cv);
  }
  // your other trains, standing as they were left; an engine that can no longer be built is left out
  for (const o of d.fleet || []) {
    if (!LOCO_SPEC[o.loco]) continue;
    const c = new Train(scene, o.loco, 'light', Object.assign({}, o.opts, { dark: true }));
    try { all.push(...trainIn(c, o, E)); }
    catch (e) { console.warn('fleet train', e); c.disposeDeep(); continue; }
    Object.assign(c, { parkS: Object.assign({}, o.ps), cfg: o.cfg || null, v: o.cv || 0, rolling: !!o.rolling, stopT: o.stopT || 0, fid: o.fid || 0 });
    if (c.parkS.dist0 === undefined) c.parkS.dist0 = c.dist;
    if (o.crewMph) c.crewMph = o.crewMph;
    if (o.crew) c.crew = crewNew(c, o.crew.mph, o.crew.dir, !!o.crew.keep);   // its engineer carries on
    c.update(0); FLEET.dim(c);
    CARS.cuts.push(c);
  }
  ROAD_SHORT = LOCO_SPEC[g.loco].short;
  FLEET.n = Math.max(FLEET.n, t.fid || 0, ...FLEET.parked().map(c => c.fid || 0));
  CARS.gen++;
  IND.in(d.ind);
  PLACE.made = Math.max(PLACE.made || 0, (d.misc && d.misc.placed) || 0);
  // the engine's controls, boiler, air and the clock
  if (!t.diesel) applySteamFinish(g.finish);
  resetState();
  Object.assign(S, d.S); S.paused = true;
  applyFireSetting(g.fire);
  S.limit = Math.min(...t.pts.map(p => p.tp.e.limit));
  buildWhistleIfReady();
  GAME.jointMem = new Map(); GAME.filling = null; GAME.spawnAt = performance.now(); GAME.scan = null;
  GAME.lastStation = d.misc ? d.misc.lastStation : null; GAME.spawnName = d.misc && d.misc.spawnName || GAME.spawnName;
  IX.idx = null;
  // the job and the other trains
  if (d.job) jobIn(d.job, all);
  if (JOB.run) g.job = JOB.run.def.id;
  else { g.job = ''; JOB.ui(); if (!t.elec && CONSISTS[t.consistKey] && CONSISTS[t.consistKey].hidden) t.consistKey = g.consist; }
  aiIn(d.ai, E);
  if (typeof jobMenu === 'function') jobMenu();
  // the sky
  applyLook(null, d.sky.weather); SKY.hour = d.sky.hour;
  if (d.sky.wx) { wxIn(d.sky.wx); wxGround(); }   // the same spell of weather, part way through, and the rail as wet as it was
  skyLight(true);
  // a wreck lies where it came to rest
  if (d.wreck && S.derailed) {
    wreckIn(t, d.wreck);
    GAME.wrecking = { title: d.wreck.title, why: d.wreck.why, clunkT: 0, done: false, kin: { v: 0, mass: 0, force: 0 } };
    S.v = S.vw = 0;
  } else S.derailed = false;
  t.update(0, S.theta, S.reverser);
  // the camera
  cycleCamera(d.cam.mode && CAM.modes.includes(d.cam.mode) ? d.cam.mode : 'chase');
  for (const k of CAM_KEEP) if (d.cam[k] !== undefined) CAM[k] = d.cam[k];
  CAM.init = false;
  CARS.onChange && CARS.onChange();
  GAME.running = true;
  SAVE.runT = 0;
  if (MAP.visible) MAP.draw();
};

/* ---------------- the menu ---------------- */
/* the menu's buttons follow the settings a save brought back */
SAVE.menuSync = function () {
  const g = GAME.settings, keyOf = { optLoco: 'loco', optTrain: 'consist', optTime: 'time', optCycle: 'cycle', optWeather: 'weather', optFire: 'fire', optTraffic: 'traffic', optLivery: 'livery', optUnits: 'units', optFinish: 'finish' };
  for (const k in keyOf) { const h = $(k); if (h) [...h.children].forEach(c => c.setAttribute('aria-pressed', String(c.id === k + '_' + g[keyOf[k]]))); }
  [...$('optMix').children].forEach(c => c.setAttribute('aria-pressed', String(c.id === 'optMix_' + (g.mix ? 'mixed' : 'matched'))));
  const cc = g.custom; $('cBody').value = hexCss(cc.body); $('cAccent').value = hexCss(cc.accent); $('cLetter').value = hexCss(cc.letter); $('cNum').value = g.number;
  refreshMenuGroups(); specGrid();
};
function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
SAVE.menu = function () {
  const host = $('saveList'); if (!host) return;
  $('grpSave').hidden = MP.on;
  if (MP.on) return;
  const canSave = !SAVE.blocked();
  host.innerHTML = '';
  for (const slot of SAVE.SLOTS) {
    const d = SAVE.read(slot), auto = slot === 'auto';
    if (auto && !d) continue;
    const row = document.createElement('div'); row.className = 'saveRow' + (auto ? ' auto' : '');
    const info = document.createElement('div'); info.className = 'saveInfo';
    const name = document.createElement('b'), sub = document.createElement('small');
    if (d) {
      const s = d.sum || {};
      name.textContent = (auto ? 'Continue · ' : `${slot} · `) + (s.title || 'Saved run');
      sub.textContent = `${s.where || SAVE.routeName(d.route)} · ${s.clock || ''} · saved ${ago(d.at)}`;
    } else { name.textContent = `${slot} · Empty`; sub.textContent = canSave ? 'Save this run here' : 'Start a run to save it here'; }
    info.append(name, sub); row.appendChild(info);
    const btns = document.createElement('div'); btns.className = 'saveBtns';
    if (d) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (auto ? ' prim' : ''); b.id = 'saveLoad_' + slot;
      b.textContent = auto ? 'Continue' : 'Load';
      b.addEventListener('click', () => { if (SAVE.load(slot) && GAME.running) GAME.start(); });
      btns.appendChild(b);
    }
    if (!auto && canSave) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'saveHere_' + slot; b.textContent = 'Save';
      b.addEventListener('click', () => {
        // overwriting a run takes a second tap
        if (d && SAVE.armed !== slot) { SAVE.armed = slot; b.textContent = 'Overwrite?'; setTimeout(() => { if (SAVE.armed === slot) { SAVE.armed = null; SAVE.menu(); } }, 3000); return; }
        SAVE.armed = null; SAVE.now(slot);
      });
      btns.appendChild(b);
    }
    row.appendChild(btns);
    host.appendChild(row);
  }
  $('grpSave').hidden = !host.children.length;
};
/* after the world is built: pick up a run that was waiting for its railroad to load */
SAVE.ready = function () {
  SAVE.menu();
  let slot = null; try { slot = sessionStorage.getItem('bd_resume'); sessionStorage.removeItem('bd_resume'); } catch (e) {}
  if (!slot || MP.on) return;
  // the run comes back paused behind the menu: Resume (a tap the browser lets start the sound) carries on
  if (SAVE.load(slot)) { $('menu').hidden = false; startLabel(); toast('Run loaded. Press Resume to carry on.', 'good', 4000, 'load'); }
};
SAVE.setup = function () {
  addEventListener('visibilitychange', () => { if (document.hidden) SAVE.auto(); });
  addEventListener('pagehide', () => SAVE.auto());
};
