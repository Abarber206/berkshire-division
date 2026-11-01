/* ============================================================================
   Car work: cuts of cars standing on the yard and spur tracks, knuckle
   couplers, coupling on contact, shoving, pulling the pin, kicking cars,
   tie-downs
   ========================================================================== */
const CARS = { cuts: [], geo: null, gen: 0, cutAt: 0, cutFrom: null };

/* cars spotted around the railroad when a new train is made up (single player) */
/* Each car is 'type/lading>destination' (industries in 11k_industry.js): no lading is an empty, and the
   cut's first car stands at its east end. Yard 3 holds the way freight for Kenton and Delphos, made up so
   the cars for the first stop are at the far end from the engine; Yard 4 the empties the shippers ordered. */
const YARD_CUTS = [
  { line: 'Yard 3', at: 0.62, cars: ['tank/oil>delphos', 'tank/oil>delphos', 'box/feed>kenton', 'hopper/coal>kenton', 'hopper/coal>kenton'] },
  { line: 'Yard 4', at: 0.78, cars: ['box/>elevator', 'box/>elevator', 'box/>elevator', 'hopper/>quarry', 'hopper/>quarry', 'hopper/>quarry', 'gon/>quarry', 'gon/>quarry'] },
  { line: 'Elevator Track', end: 24, cars: ['box/grain>yard', 'box/grain>yard', 'box/grain>yard', 'box/grain>yard'] },     // grain moved in boxcars in the 1940s
  { line: 'Quarry Storage', end: 20, cars: ['hopper/stone>yard', 'hopper/stone>yard', 'gon/stone>yard', 'gon/stone>yard', 'hopper/stone>yard'] },
];
const CAR_NAMES = { box: 'Box', hopper: 'Hopper', tank: 'Tank', gon: 'Gon', caboose: 'Caboose', coach: 'Coach', tender: 'Tender' };
/* closing speeds: clean, hard, damaging (lading and draft gear), and a wreck that derails the cars */
const COUPLE_OK = 4 * MPH, COUPLE_HARD = 8 * MPH, COUPLE_DAMAGE = 11 * MPH, COUPLE_WRECK = 25 * MPH;
/* a knuckle is closed (0), open (1), or has its lock lifted by the cut lever (2) while the faces are still
   pressed together: it swings open once the cars part. Two closed knuckles only buff; one open one couples. */
const KN_CLOSED = 0, KN_OPEN = 1, KN_LIFTED = 2;
const isPower = v => v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender';
/* the vehicle at one end of consist c and which of its own couplers (0 at its front, 1 at its rear) faces out there */
function endCoupler(c, end) {
  const v = end === 'front' ? c.vehicles[0] : c.vehicles[c.vehicles.length - 1];
  if (!v.kn) v.kn = [KN_CLOSED, KN_CLOSED];
  return { v, k: (end === 'front') !== !!v.flip ? 0 : 1 };
}
const knOf = e => e.v.kn[e.k];
function setKn(e, s) { if (e.v.kn[e.k] !== s) { e.v.kn[e.k] = s; CARS.gen++; } }

class Cut extends Consist {
  constructor(scene, vehicles) {
    super(scene);
    this.v = 0; this.rolling = false; this.stopT = 0; this.vented = false;
    this.vehicles = vehicles;
    for (const v of vehicles) if (!v.ptsAll) this.track(v);
    this.layout();
    this.buildInstances(CARS.geo);
    for (const im of this.inst) linearizeObject(im);
  }
  dispose() { for (const v of this.vehicles) this.scene.remove(v.root); for (const im of this.inst) this.scene.remove(im); }
}

/* a train with its own engine: the one being driven, or one standing while you drive another (11l_fleet.js) */
const isTrainC = c => !!c && (c === GAME.train || !!c.parkS);
function consistMass(c) {
  let m = 0;
  const st = c.parkS || S;   // a standing train's tender holds what it had when it was left
  for (const v of c.vehicles) m += v.kind === 'tender' ? (c.turb ? turbineTenderMass(c, st) : c.tenderEmpty + st.water + st.coal) : v.mass;
  return m;
}
const velOf = c => c === GAME.train ? S.v : c.v;
function setVel(c, v) { if (c === GAME.train) { S.v = v; S.vw = v; } else { c.v = v; c.rolling = Math.abs(v) > 0.005 || c.rolling; } }
function freeVehicle(v) {
  const seen = new Set();
  v.root.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } });
}

/* ---------------- making up the yard ---------------- */
CARS.clear = function (oldTrain, all, keepTrains) {
  // in a room the cars standing about belong to everyone (11h_mpcars.js): a new train leaves them be
  if (MP.on && !all) { if (oldTrain) for (const v of oldTrain.vehicles) if (v.yard) freeVehicle(v); return; }
  // keepTrains: the other trains you have made up stay where they stand (only the cars are made up again)
  const kept = keepTrains ? CARS.cuts.filter(c => c.parkS) : [];
  for (const c of CARS.cuts) if (!kept.includes(c)) { c.dispose(); c.vehicles.forEach(freeVehicle); }
  if (oldTrain) for (const v of oldTrain.vehicles) if (v.yard) freeVehicle(v);
  CARS.cuts = kept; CARS.gen++;
};
CARS.setup = function () {
  if (MP.on || WORLD.custom) return;
  IND.reset();
  CARS.yard();
};
/* the cuts spotted around the yard, as every new run (and every room) starts with them. In a room each car is
   lettered alike for everyone (road), and each cut is known by its place in YARD_CUTS ('y0', 'y1', ...). */
CARS.yard = function (road) {
  if (!CARS.geo) { CARS.geo = carGeos(); }
  const r = rng(1959), was = ROAD_SHORT;
  if (road) ROAD_SHORT = road;
  let num = 21000;
  YARD_CUTS.forEach((def, i) => {
    const line = ROUTE.lines[def.line]; if (!line) return;
    const vehicles = def.cars.map(spec => {
      const { type, ld, to } = IND.parse(spec);
      const m = freightModel(type, num += 7 + ((r() * 40) | 0), r);
      scene.add(m.root); linearizeObject(m.root);
      const v = carVehicle(m); v.yard = true; v.hb = true; v.made = { type, num, rs: ROAD_SHORT };
      v.brake = { AR: 0, BC: 0, BP: 0, emerg: false, released: true };   // bled off and tied down
      IND.setLoad(v, ld); IND.bill(v, to);
      return v;
    });
    const c = new Cut(scene, vehicles);
    const sF = def.end !== undefined ? line.len - def.end : line.len * def.at;
    const sR = sF - c.length;
    const foul = line.cuts.some(k => k.s > sR - 45 && k.s < sF + 45) || sR < 10;
    if (foul) console.warn('cut on', def.line, 'fouls a switch');
    const loc = line.locate(sF);
    c.place(new TrackPos(loc.edge, loc.s, 1));
    // one of your other trains is standing there: the cars are not made up on top of it
    if (!MP.on && CARS.overlaps(c)) { c.dispose(); vehicles.forEach(freeVehicle); return; }
    c.home = def.line; c.mid = 'y' + i;
    for (const end of ['front', 'rear']) setKn(endCoupler(c, end), KN_OPEN);   // the crew left the end knuckles open
    CARS.cuts.push(c);
  });
  ROAD_SHORT = was;
};

/* ---------------- what a car is, as a few characters ---------------- */
/* A car as type.number.road.flag.engine.tons (with ~ in front when it stands turned), so another player can
   build the same car: the road it is lettered for, an observation car's flag, the engine a coach was built to
   match, and its weight. In a train, the engine's own vehicles are #0, #1, ... in the order the engine builds them. */
const CAR_TYPES = ['box', 'hopper', 'tank', 'gon', 'caboose', 'coach'];
function carToken(v) {
  const m = v.made || {};
  return `${v.flip ? '~' : ''}${CAR_TYPES.includes(m.type) ? m.type : CAR_TYPES.includes(v.kind) ? v.kind : 'box'}.${(m.num | 0) || 0}.${m.rs || ''}.${m.flag ? 1 : 0}${m.tr === 'polar' ? 'p' : ''}.${m.rk || ''}.${Math.round((v.mass || 0) / STON)}`;
}
/* a token read back, checked: { flip, type, num, rs, flag, tr, rk, tons }, or null. The flag field carries a 'p' for a coach in the holiday trim. */
function carTokenIn(t) {
  if (typeof t !== 'string' || t.length > 48) return null;
  const flip = t[0] === '~', p = (flip ? t.slice(1) : t).split('.');
  if (p.length !== 6 || !CAR_TYPES.includes(p[0])) return null;
  const num = +p[1], tons = +p[5];
  if (!Number.isInteger(num) || num < 0 || num > 999999 || !/^[A-Z0-9&]{0,6}$/.test(p[2]) || !/^[a-z0-9]{0,8}$/i.test(p[4]) || !(tons >= 0 && tons <= 300) || !/^[01]p?$/.test(p[3])) return null;
  return { flip, type: p[0], num, rs: p[2], flag: p[3][0] === '1', tr: p[3][1] === 'p' ? 'polar' : '', rk: LOCO_SPEC[p[4]] ? p[4] : '', tons };
}
/* the engine's own vehicles in a train: everything a light engine of the same kind is built with */
const trainPower = T => T.vehicles.filter(v => !v.helper && (isPower(v) || (T.elec && T.units && T.units.some(m => m.vehicle === v))));
/* the whole train front to back as tokens joined by commas */
function trainCode(T) {
  const power = trainPower(T);
  return T.vehicles.map(v => { const i = power.indexOf(v); return i >= 0 ? '#' + i : carToken(v); }).join(',');
}
/* a car built from its token (not on the track yet) */
function carFromToken(k) {
  let m;
  if (k.type === 'coach') m = coachModel(LOCO_SPEC[k.rk] || LOCO_SPEC['765'], k.num, k.flag, k.tr || '');
  else { const was = ROAD_SHORT; if (k.rs) ROAD_SHORT = k.rs; try { m = freightModel(k.type, k.num, () => 0.5); } finally { ROAD_SHORT = was; } }
  scene.add(m.root); linearizeObject(m.root);
  const v = carVehicle(m);
  v.made = { type: k.type, num: k.num, rs: k.rs || undefined, flag: k.flag || undefined, rk: k.rk || undefined, tr: k.tr || undefined };
  if (k.tons) v.mass = k.tons * STON;
  v.flip = k.flip;
  return v;
}

/* ---------------- what is on the track ahead ---------------- */
/* every coupler face and tracked point of every consist, by edge */
function carIndex() {
  const idx = new Map();
  const add = (e, s, it) => { let l = idx.get(e); if (!l) idx.set(e, l = []); it.s = s; l.push(it); };
  for (const c of [GAME.train, ...CARS.cuts, ...AI.trains.map(a => a.train)]) {
    if (!c) continue;
    const f = c.endTP('front'), r = c.endTP('rear');
    add(f.e, f.s, { c, end: 'front', out: f.o });
    add(r.e, r.s, { c, end: 'rear', out: -r.o });
    for (const p of c.pts) add(p.tp.e, p.tp.s, { c, end: null });
  }
  return idx;
}
/* nearest other consist beyond c's front (dir +1) or rear (dir -1) coupler, within range metres */
function carAhead(c, dir, range, idx) { return carFrom(c.endTP(dir > 0 ? 'front' : 'rear'), dir, range, idx, c); }
/* nearest consist other than skip from track position t, looking along dir */
function carFrom(t, dir, range, idx, skip) {
  let e = t.e, s = t.s, o = t.o * dir, acc = 0, best = null;
  for (let g = 0; g < 40 && !best; g++) {
    const items = idx.get(e);
    if (items) for (const it of items) {
      if (it.c === skip) continue;
      const ds = (it.s - s) * o;
      if (ds < -0.03) continue;
      const d = acc + Math.max(0, ds);
      if (d <= range && (!best || d < best.d)) best = { d, it, o };
    }
    if (best) break;
    acc += o > 0 ? e.len - s : s;
    if (acc > range) break;
    const end = o > 0 ? 1 : 0, node = end ? e.b : e.a;
    const nx = node ? node.next(e, end, null) : null;
    if (!nx) break;
    e = nx.edge; o = nx.end === 0 ? 1 : -1; s = nx.end === 0 ? 0 : e.len;
  }
  if (!best) return null;
  const it = best.it;
  return { d: best.d, c: it.c, end: it.end, facing: !!it.end && it.out === -best.o };
}
/* how far consist c may move by d before it touches something */
CARS.limit = function (c, d) {
  if (!CARS.cuts.length && !AI.trains.length) return { d, hit: null };
  const idx = carIndex();
  const hit = carAhead(c, Math.sign(d), Math.abs(d) + 0.05, idx);
  if (!hit || hit.d >= Math.abs(d)) return { d, hit: null };
  return { d: Math.sign(d) * hit.d, hit };
};
/* open track from tp along dir before the nearest cut of cars (skip: the consist standing at tp) */
CARS.clearance = function (tp, dir, range, skip) {
  if (!CARS.cuts.length && !AI.trains.length) return Infinity;
  const hit = carFrom(tp, dir, range, carIndex(), skip);
  return hit ? hit.d : Infinity;
};
/* the first consist on the rails standing within a metre of c's span, if any (c itself not yet on the railroad) */
CARS.overlaps = function (c) {
  const t = c.endTP('rear'); t.advance(-1, null);
  const hit = carFrom(t, 1, c.length + 2, carIndex(), c);
  return hit ? hit.c : null;
};
/* for the HUD: the cut ahead of the train in the direction of travel */
CARS.ahead = function (T, dir, range) {
  if (!CARS.cuts.length && !AI.trains.length) return null;
  return carAhead(T, dir, range, carIndex());
};

/* ---------------- coupling ---------------- */
/* Train X is being coupled into another: its engine (and tender or units) go in as a helper, MU'd to the
   train's controls. Each helper vehicle keeps what it needs to be built again for a save. Returns X's name. */
let HELPER_N = 0;
function helperOf(X) {
  const name = typeof FLEET !== 'undefined' && X.parkS ? FLEET.name(X) : 'the other engine';
  const own = X.vehicles.filter(v => isPower(v) && !v.helper), g = ++HELPER_N + '.' + Math.round(performance.now());
  const opts = JSON.parse(JSON.stringify(Object.assign({}, X.opts || {}, { remote: undefined })));
  own.forEach((v, i) => { v.helper = { g, loco: X.locoKey, opts, i }; });
  if (X.crew && typeof IX !== 'undefined') IX.release(X.crew.ix);
  X.crew = null; X.parkS = null;
  if (typeof FLEET !== 'undefined' && FLEET.card === X) FLEET.closeCard();
  return name;
}
/* how much more pulling the helpers in train T add to its own engine, by weight on the rails */
function helperK(T) {
  if (T._hk && T._hk[0] === CARS.gen) return T._hk[1];
  let own = 0, all = 0;
  for (const v of T.vehicles) if (v.kind === 'loco' || v.kind === 'loco2') { all += v.mass; if (!v.helper) own += v.mass; }
  const k = own > 0 ? all / own : 1;
  T._hk = [CARS.gen, k];
  return k;
}
/* K keeps going with X's cars added at its kEnd; X's coupler xEnd is the one that met it */
function absorb(K, kEnd, X, xEnd) {
  const flip = kEnd === xEnd;
  setKn(endCoupler(K, kEnd), KN_CLOSED); setKn(endCoupler(X, xEnd), KN_CLOSED);
  const MK = consistMass(K), MX = consistMass(X);
  const v = (MK * velOf(K) + MX * velOf(X) * (flip ? -1 : 1)) / (MK + MX);
  const list = X.vehicles.slice();
  for (const u of list) X.release(u);
  if (flip) {
    list.reverse();
    for (const u of list) { u.flip = !u.flip; for (const p of u.ptsAll) p.tp.o = -p.tp.o; }
  }
  for (const u of list) { K.adopt(u); if (K === GAME.train) u.hb = false; }
  K.vehicles = kEnd === 'rear' ? K.vehicles.concat(list) : list.concat(K.vehicles);
  for (const im of X.inst) X.scene.remove(im);
  CARS.cuts = CARS.cuts.filter(c => c !== X);
  K.layout(); K.buildInstances();
  for (const im of K.inst) linearizeObject(im);
  if (K !== GAME.train) { K.vented = K.vented || X.vented; K.stopT = 0; K.home = X.home || K.home; }
  setVel(K, v);
  K.update(0);
  CARS.gen++;
  return list.length;
}
/* Two consists meeting end on, with closing speed u > 0 measured along A's travel: the draft gear soaks up most
   of a hard hit (restitution e), and below a walking pace they simply move off together. Returns the
   speeds of A and B afterward, both along A's travel. */
function buff(mA, uA, mB, uB, e) {
  const k = (1 + e) * (uA - uB) / (mA + mB);
  return [uA - k * mB, uB + k * mA];
}
const buffE = closing => closing < 1 ? 0 : 0.3 * smooth(1, 3, closing);
/* consist A, moving toward its dir end, has just touched hit.c */
CARS.contact = function (A, dir, hit) {
  if (A.ai || hit.c.ai) { AI.contact(A, dir, hit); return; }
  const B = hit.c, T = GAME.train;
  const aEnd = dir > 0 ? 'front' : 'rear';
  const sB = hit.end === aEnd ? -1 : 1;   // B's velocity, seen along A's direction
  const vB = hit.end ? velOf(B) * sB : 0;
  const closing = dir * (velOf(A) - vB);
  const mph = Math.round(closing / MPH);
  const ours = A === T || B === T;
  const hear = (A === T ? B : A).vehicles[0].pos;
  const gain = hear ? clamp(closing / COUPLE_OK, 0.25, 1.6) / (1 + Math.pow(hear.distanceTo(camera.position) / 30, 1.3)) : 0;
  if (!hit.facing) {
    // the side of cars standing foul of the route
    if (ours) JOB.note('foul');
    if (ours && closing > 2.2) { GAME.derail(`Sideswiped cars standing foul of the switch at ${mph} mph. Leave cars clear of the points before you line a route past them.`, 'Collision'); return; }
    sndClunk(gain, 0);
    for (const c of [A, B]) setVel(c, 0);
    if (ours) toast('Stopped against cars standing foul of the route.', 'bad', 3000, 'foul');
    return;
  }
  if (ours && closing > COUPLE_WRECK) {
    const other = A === T ? B : A;
    GAME.derail(other.parkS && other.crew ? `Collided with ${FLEET.name(other)} at ${mph} mph. Keep a train length or more back from your other trains.`
      : other.parkS && typeof FLEET !== 'undefined' ? `Ran into ${FLEET.name(other)} at ${mph} mph. Come up on a standing train at a walking pace, 4 mph or less.`
      : `Hit a cut of cars at ${mph} mph: the couplers buckled and the cars climbed each other. Shove at a walking pace, 4 mph or less.`, 'Collision');
    return;
  }
  const ka = endCoupler(A, aEnd), kb = endCoupler(B, hit.end);
  // a high-speed trainset's nose coupler is under a fairing and only mates with another set: it buffs freight cars
  const sealed = ka.v.noCouple || kb.v.noCouple;
  // two trains couple like anything else: the other one's engine becomes a helper, worked from this train's controls
  const twoTrains = isTrainC(A) && isTrainC(B);
  const couple = !sealed && (knOf(ka) === KN_OPEN || knOf(kb) === KN_OPEN);
  if (!couple) {
    // both knuckles closed (or a lock still lifted against the other car): the cars buff and get shoved along
    const [uA, uB] = buff(consistMass(A), dir * velOf(A), consistMass(B), dir * vB, buffE(closing));
    setVel(A, dir * uA); setVel(B, dir * uB * sB);
    if (closing > 0.15) sndClunk(gain, 0);
    if (closing > COUPLE_OK) JOB.note('couple', { mph: closing / MPH, shove: true });
    if (!ours) return;
    const X = A === T ? B : A;
    if (closing > COUPLE_DAMAGE) toast(`Slammed the cars at ${mph} mph. Nothing derailed, but that wrecks lading and draft gear.`, 'bad', 4200, 'slam');
    else if (closing > COUPLE_HARD) toast(`Hit the cars hard at ${mph} mph and shoved them along. Ease in at 4 mph or less.`, 'bad', 3800, 'hardshove');
    else if (CARS.cutFrom === X && performance.now() - CARS.cutAt < 6000) toast('Pin pulled, still shoving: the cars part as soon as you ease off or brake.', '', 3600, 'stillshove');
    else if (sealed && closing > 0.15) toast('A trainset\'s coupler sits behind its nose cover and only mates with another trainset, so it can push cars but not pick them up.', 'warn', 4800, 'sealed');
    else if (closing > 0.3) toast('Both knuckles are closed, so the cars are only shoved. Tap a coupler to open its knuckle, then ease in to couple.', 'warn', 4800, 'shove');
    return;
  }
  sndCouple(gain);
  // the train keeps going with the cars added: yours, or another train's engine standing there; else the moving cut
  const K = B === T ? B : A === T ? A : isTrainC(B) ? B : A, X = K === A ? B : A;
  const kEnd = K === A ? aEnd : hit.end, xEnd = K === A ? hit.end : aEnd;
  const helper = twoTrains ? helperOf(X) : null;
  const n = absorb(K, kEnd, X, xEnd);
  if (helper) {
    if (ours) toast(`Coupled to ${helper}. Its engine is MU'd to yours and works off your throttle and brakes.`, closing > COUPLE_HARD ? 'warn' : 'good', 5200, 'coupled');
    if (CARS.onChange) CARS.onChange();
    return;
  }
  if (closing > COUPLE_OK) JOB.note('couple', { mph: closing / MPH });
  if (!ours) { toast(`A rolling cut coupled into the cars on ${K.home || 'the track'}${closing > COUPLE_HARD ? `, hard, at ${mph} mph` : ''}.`, closing > COUPLE_HARD ? 'warn' : '', 2600, 'cc'); return; }
  const what = `${n} car${n > 1 ? 's' : ''}`;
  if (closing > COUPLE_DAMAGE) toast(`Slammed into ${what} at ${mph} mph. The knuckles held and they coupled, but that wrecks lading and draft gear.`, 'bad', 4800, 'slam');
  else if (closing > COUPLE_HARD) toast(`Hard coupling at ${mph} mph to ${what}. That rattles lading; 4 mph is the limit.`, 'bad', 4200, 'hard');
  else if (closing > COUPLE_OK) toast(`Coupled to ${what} at ${mph} mph: a bit hard. Ease in slower.`, 'warn', 3600, 'firm');
  else toast(`Coupled to ${what}. Hoses connected and handbrakes released: let the air pump up before you pull.`, 'good', 4600, 'coupled');
  if (CARS.onChange) CARS.onChange();
};

/* a lifted knuckle swings open once nothing is pressed against it */
CARS.settle = function () {
  let idx = null;
  for (const c of [GAME.train, ...CARS.cuts]) {
    if (!c || !c.vehicles.length || (CARS.driven && CARS.driven(c))) continue;
    for (const end of ['front', 'rear']) {
      const e = endCoupler(c, end);
      if (knOf(e) !== KN_LIFTED) continue;
      idx = idx || carIndex();
      if (!carAhead(c, end === 'front' ? 1 : -1, 0.08, idx)) setKn(e, KN_OPEN);
    }
  }
};

/* the trainman works the coupler at one end of a consist: lifts the pin to open a closed knuckle, or
   pushes an open one shut */
CARS.knuckle = function (c, end) {
  const e = endCoupler(c, end), s = knOf(e);
  setKn(e, s === KN_CLOSED ? KN_LIFTED : KN_CLOSED);
  if (s === KN_CLOSED) CARS.settle();
  const p = e.v.pos, g = p ? 1 / (1 + Math.pow(p.distanceTo(camera.position) / 30, 1.3)) : 1;
  sndPin(0.6 * g, false);
  const now = knOf(e);
  toast(now === KN_OPEN ? 'Knuckle open: ease in at 4 mph or less to couple.' : now === KN_LIFTED ? 'Pin lifted. The knuckle swings open when the cars part.' : 'Knuckle closed: these cars will only be shoved, not coupled.', now === KN_OPEN ? 'good' : '', 3200, 'knuckle');
  if (CARS.onChange) CARS.onChange();
};

/* ---------------- pulling the pin ---------------- */
/* joint j sits between vehicles j-1 and j of a consist (the player's train unless c is given) */
CARS.canCut = function (T, j) {
  const V = T.vehicles; if (j <= 0 || j >= V.length) return false;
  // an engine and its tender (or units) stay together; a helper comes off its train's own engine
  const grp = v => v.helper ? v.helper.g : '';
  return !(isPower(V[j - 1]) && isPower(V[j]) && grp(V[j - 1]) === grp(V[j]));
};
CARS.uncouple = function (j, c0) {
  const T = c0 || GAME.train;
  if (!T || !CARS.canCut(T, j)) return;
  if (!CARS.geo) CARS.geo = carGeos();
  const ours = T === GAME.train, vT = velOf(T);
  const V = T.vehicles, behind = isTrainC(T) ? j > T.li : true;
  const off = behind ? V.slice(j) : V.slice(0, j);
  T.vehicles = behind ? V.slice(0, j) : V.slice(j);
  for (const v of off) T.release(v);
  T.layout(); T.buildInstances();
  for (const im of T.inst) linearizeObject(im);
  const c = new Cut(scene, off);
  c.v = vT; c.home = T.home;
  // the cut lever lifts the lock on the car being cut off; its knuckle swings open as the cars part
  setKn(endCoupler(c, behind ? 'front' : 'rear'), KN_LIFTED);
  const kick = Math.abs(vT) > 0.6;
  if (!ours) {
    // splitting a standing or rolling cut: both halves keep their brakes as they were
    c.rolling = T.rolling; c.vented = T.vented;
    for (const v of off) v.hb = v.hb && !c.rolling;
  } else if (kick) c.rolling = true;
  else {
    // angle cock closed on the engine side; the cut's hoses part and its brakes go into emergency
    c.vented = true; c.rolling = Math.abs(vT) > 0.005;
    for (const v of off) { v.brake.BP = 0; v.brake.emerg = true; }
  }
  CARS.cuts.push(c); CARS.cutFrom = c; CARS.cutAt = performance.now(); CARS.gen++;
  c.update(0);
  if (ours) T.update(0, S.theta, S.reverser); else T.update(0);
  sndPin(1 / (1 + Math.pow(off[0].pos.distanceTo(camera.position) / 30, 1.3)), ours && !kick);
  const n = off.length, what = `${n} car${n > 1 ? 's' : ''}`;
  if (!ours) toast(`Pin pulled: the cut is split, ${what} on the far side.`, 'good', 3200, 'split');
  else if (kick) toast(`Pin pulled: ${what} rolling free at ${Math.round(Math.abs(vT) / MPH)} mph. Brake to let them run.`, 'warn', 4200, 'kick');
  else toast(`Cut off ${what}. Their air is dumped and the brakeman ties them down.`, 'good', 4000, 'setout');
  if (CARS.onChange) CARS.onChange();
};

/* ---------------- changing the engine or the train from the menu ---------------- */
/* V is the train front to back. power replaces its engine (and tender or trailing units); cars, when
   given, replace the cars it was made up with. Cars picked up in the yard stay coupled where they are.
   The joint that stays put is the coupler between the engine and its train (its front coupler when the
   cars are all ahead of it): offset a0 from the front of the old train and a1 from the front of the new. */
CARS.swapPlan = function (V, power, cars) {
  const p0 = V.findIndex(isPower), p1 = V.length - 1 - [...V].reverse().findIndex(isPower);
  const front = V.slice(0, p0), rear = V.slice(p1 + 1);
  const keepFront = cars ? front.filter(v => v.yard) : front;
  const keepRear = cars ? [...cars, ...rear.filter(v => v.yard)] : rear;
  const vehicles = [...keepFront, ...power, ...keepRear], len = a => a.reduce((s, v) => s + v.len, 0);
  const atFront = !rear.length && front.length;
  return {
    vehicles, dropped: V.filter(v => !vehicles.includes(v)), length: len(vehicles),
    a0: atFront ? len(front) : len(V.slice(0, p1 + 1)),
    a1: atFront ? len(keepFront) : len(keepFront) + len(power),
  };
};

/* ---------------- cars rolling on their own ---------------- */
/* a tied-down car: a handbrake shoe holds about 4% of the car's weight, so an engine can skid one along */
const HANDBRAKE = 0.04;
CARS.step = function (h) {
  CARS.settle();
  for (const c of CARS.cuts.slice()) {
    if (!c.rolling || c.crew || !CARS.cuts.includes(c)) continue;   // a train with its engineer runs on its own physics (11l_fleet.js)
    if (CARS.driven && CARS.driven(c)) continue;   // another player in the room is moving these cars (11h_mpcars.js)
    for (const v of c.vehicles) for (const p of v.fp) p.tp.pose(p.F);
    let M = 0, Fg = 0, Fr = 0, Fb = 0;
    const av = Math.abs(c.v), vm = av / MPH, shoe = 1.25 - 0.5 * smooth(0, 35, av);
    c.vehicles.forEach((v, i) => {
      const b = v.brake;
      if (c.vented) b.BC = Math.min(70, b.BC + 40 * h);
      M += v.mass;
      const f = _v1.addVectors(v.fp[0].F.f, v.fp[1].F.f).multiplyScalar(0.5);
      Fg -= v.mass * 9.81 * f.y;
      const tons = v.mass / STON, k = Math.abs(v.fp[0].tp.e.curv(v.fp[0].tp.s));
      Fr += (1.3 * tons + 29 * v.axles + 0.045 * tons * vm + (i === 0 ? 0.0024 : 0.0005) * (v.area || 90) * vm * vm + 0.8 * tons * 1746.4 * k + 14 * tons * (1 - smooth(0.15, 2.0, av))) * LBF;
      Fb += v.mass * v.brakeA * (b.BC / 64) * shoe + (v.hb ? v.mass * 9.81 * HANDBRAKE : 0);
    });
    let a;
    if (av < 0.03) {
      if (Math.abs(Fg) <= Fr + Fb) { c.v = 0; a = 0; } else a = (Fg - Math.sign(Fg) * (Fr + Fb)) / M;
    } else {
      a = (Fg - Math.sign(c.v) * (Fr + Fb)) / M;
      if (Math.sign(c.v + a * h) !== Math.sign(c.v) && Math.abs(Fg) < Fr + Fb) a = -c.v / h;
    }
    c.v += a * h;
    if (c.v === 0) {
      // at rest: the brakeman ties a handbrake down on every car
      c.stopT += h;
      if (c.stopT > 2.5) { c.rolling = false; c.stopT = 0; for (const v of c.vehicles) v.hb = true; }
      continue;
    }
    c.stopT = 0;
    const d = c.v * h;
    if (CARS.wall && CARS.wall(c, d)) {
      const p = c.vehicles[0].pos, g = p ? 1 / (1 + Math.pow(p.distanceTo(camera.position) / 30, 1.3)) : 0;
      if (Math.abs(c.v) > 0.3) sndClunk(clamp(Math.abs(c.v) / COUPLE_OK, 0.3, 1.4) * g, 0);
      c.v = 0; c.dirty = true; continue;
    }
    const lim = CARS.limit(c, d);
    c.move(lim.d, {
      onRunThrough: sw => { MP.noteThrow(sw); toast(`A rolling cut ran through ${sw.name} and forced the points over.`, 'bad', 3800, 'crt' + sw.id); },
      onBlocked: () => {
        const mph = Math.abs(c.v) / MPH;
        const p = c.vehicles[0].pos, g = p ? 1 / (1 + Math.pow(p.distanceTo(camera.position) / 30, 1.3)) : 0;
        sndClunk(clamp(mph / 4, 0.3, 1.4) * g, 0);
        if (mph > 6) toast(`A cut of cars hit the bumping post at ${Math.round(mph)} mph.`, 'bad', 3200, 'cbump');
        c.v = 0;
      },
    });
    c.dirty = true;
    if (lim.hit) CARS.contact(c, Math.sign(d), lim.hit);
  }
};
CARS.render = function () {
  const cam = camera.position;
  CARS.visT = (CARS.visT || 0) + 1;
  for (const c of CARS.cuts) {
    if (CARS.visT % 20 === 0 || c.dirty) {
      const far = c.vehicles[0].pos && c.vehicles[0].pos.distanceTo(cam) > 2800 + c.length;
      if (far !== !!c.hidden) { c.hidden = far; c.setVisible(!far); }
    }
    if (c.dirty && !c.hidden) { c.update(0); c.dirty = false; }
  }
};

/* switch points with cars standing over them */
CARS.occupied = sw => CARS.cuts.some(c => c.fouls(sw));
