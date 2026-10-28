/* ============================================================================
   Car work: cuts of cars standing on the yard and spur tracks, coupling on
   contact, pulling the pin, kicking cars, tie-downs
   ========================================================================== */
const CARS = { cuts: [], geo: null, gen: 0, cutAt: 0, cutFrom: null };

/* cars spotted around the railroad when a new train is made up (single player) */
const YARD_CUTS = [
  { line: 'Yard 3', at: 0.62, cars: ['box', 'box', 'tank', 'box', 'hopper', 'hopper', 'box', 'gon', 'box', 'tank'] },
  { line: 'Yard 4', at: 0.78, cars: ['hopper', 'hopper', 'hopper', 'hopper', 'hopper', 'hopper'] },
  { line: 'Elevator Track', end: 24, cars: ['box', 'box', 'box', 'box'] },     // grain moved in boxcars in the 1940s
  { line: 'Quarry Storage', end: 20, cars: ['hopper', 'hopper', 'gon', 'gon', 'hopper'] },
];
const CAR_NAMES = { box: 'Box', hopper: 'Hopper', tank: 'Tank', gon: 'Gon', caboose: 'Caboose', coach: 'Coach', tender: 'Tender' };
const COUPLE_OK = 4 * MPH, COUPLE_HARD = 8 * MPH, COUPLE_WRECK = 11 * MPH;
const isPower = v => v.kind === 'loco' || v.kind === 'loco2' || v.kind === 'tender';

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

function consistMass(c) {
  let m = 0;
  for (const v of c.vehicles) m += v.kind === 'tender' ? c.tenderEmpty + S.water + S.coal : v.mass;
  return m;
}
const velOf = c => c === GAME.train ? S.v : c.v;
function setVel(c, v) { if (c === GAME.train) { S.v = v; S.vw = v; } else { c.v = v; c.rolling = Math.abs(v) > 0.005 || c.rolling; } }
function freeVehicle(v) {
  const seen = new Set();
  v.root.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } });
}

/* ---------------- making up the yard ---------------- */
CARS.clear = function (oldTrain) {
  for (const c of CARS.cuts) { c.dispose(); c.vehicles.forEach(freeVehicle); }
  if (oldTrain) for (const v of oldTrain.vehicles) if (v.yard) freeVehicle(v);
  CARS.cuts = []; CARS.gen++;
};
CARS.setup = function () {
  if (MP.on || WORLD.custom) return;
  if (!CARS.geo) { CARS.geo = { tg: truckGeos(), a6: plainAxle(0.457), a4: plainAxle(0.419) }; }
  const r = rng(1959);
  let num = 21000;
  for (const def of YARD_CUTS) {
    const line = ROUTE.lines[def.line]; if (!line) continue;
    const vehicles = def.cars.map(type => {
      const m = freightModel(type, num += 7 + ((r() * 40) | 0), r);
      scene.add(m.root); linearizeObject(m.root);
      const v = carVehicle(m); v.yard = true; v.hb = true;
      v.brake = { AR: 0, BC: 0, BP: 0, emerg: false, released: true };   // bled off and tied down
      return v;
    });
    const c = new Cut(scene, vehicles);
    const sF = def.end !== undefined ? line.len - def.end : line.len * def.at;
    const sR = sF - c.length;
    const foul = line.cuts.some(k => k.s > sR - 45 && k.s < sF + 45) || sR < 10;
    if (foul) console.warn('cut on', def.line, 'fouls a switch');
    const loc = line.locate(sF);
    c.place(new TrackPos(loc.edge, loc.s, 1));
    c.home = def.line;
    CARS.cuts.push(c);
  }
};

/* ---------------- what is on the track ahead ---------------- */
/* every coupler face and tracked point of every consist, by edge */
function carIndex() {
  const idx = new Map();
  const add = (e, s, it) => { let l = idx.get(e); if (!l) idx.set(e, l = []); it.s = s; l.push(it); };
  for (const c of [GAME.train, ...CARS.cuts]) {
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
  if (!CARS.cuts.length) return { d, hit: null };
  const idx = carIndex();
  const hit = carAhead(c, Math.sign(d), Math.abs(d) + 0.05, idx);
  if (!hit || hit.d >= Math.abs(d)) return { d, hit: null };
  return { d: Math.sign(d) * hit.d, hit };
};
/* open track from tp along dir before the nearest cut of cars (skip: the consist standing at tp) */
CARS.clearance = function (tp, dir, range, skip) {
  if (!CARS.cuts.length) return Infinity;
  const hit = carFrom(tp, dir, range, carIndex(), skip);
  return hit ? hit.d : Infinity;
};
/* for the HUD: the cut ahead of the train in the direction of travel */
CARS.ahead = function (T, dir, range) {
  if (!CARS.cuts.length) return null;
  return carAhead(T, dir, range, carIndex());
};

/* ---------------- coupling ---------------- */
/* K keeps going with X's cars added at its kEnd; X's coupler xEnd is the one that met it */
function absorb(K, kEnd, X, xEnd) {
  const flip = kEnd === xEnd;
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
/* consist A, moving toward its dir end, has just touched hit.c */
CARS.contact = function (A, dir, hit) {
  const B = hit.c, T = GAME.train;
  const aEnd = dir > 0 ? 'front' : 'rear';
  const vB = hit.end ? velOf(B) * (hit.end === aEnd ? -1 : 1) : 0;
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
    GAME.derail(`Hit a cut of cars at ${mph} mph and buckled the couplers. Couple at a walking pace: 4 mph or less.`, 'Collision');
    return;
  }
  sndCouple(gain);
  const K = B === T ? B : A, X = K === A ? B : A;
  const kEnd = K === A ? aEnd : hit.end, xEnd = K === A ? hit.end : aEnd;
  const n = absorb(K, kEnd, X, xEnd);
  if (closing > COUPLE_OK) JOB.note('couple', { mph: closing / MPH });
  if (!ours) { toast(`A rolling cut coupled into the cars on ${K.home || 'the track'}${closing > COUPLE_HARD ? `, hard, at ${mph} mph` : ''}.`, closing > COUPLE_HARD ? 'warn' : '', 2600, 'cc'); return; }
  const re = CARS.cutFrom === X && performance.now() - CARS.cutAt < 4000;
  const what = `${n} car${n > 1 ? 's' : ''}`;
  if (re) toast(`Still shoving, so the cut coupled back on. Brake as you pull the pin and let the cars run.`, 'warn', 4200, 'recouple');
  else if (closing > COUPLE_HARD) toast(`Hard coupling at ${mph} mph to ${what}. That rattles lading; 4 mph is the limit.`, 'bad', 4200, 'hard');
  else if (closing > COUPLE_OK) toast(`Coupled to ${what} at ${mph} mph: a bit hard. Ease in slower.`, 'warn', 3600, 'firm');
  else toast(`Coupled to ${what}. Hoses connected and handbrakes released: let the air pump up before you pull.`, 'good', 4600, 'coupled');
  if (CARS.onChange) CARS.onChange();
};

/* ---------------- pulling the pin ---------------- */
/* joint j sits between vehicles j-1 and j of the player's train */
CARS.canCut = function (T, j) {
  const V = T.vehicles; if (j <= 0 || j >= V.length) return false;
  return !(isPower(V[j - 1]) && isPower(V[j]));
};
CARS.uncouple = function (j) {
  const T = GAME.train;
  if (MP.on) { toast('Car work is not shared with the room yet, so couplers stay locked in multiplayer.', 'warn', 4000, 'mpcars'); return; }
  if (!T || !CARS.canCut(T, j)) return;
  if (!CARS.geo) CARS.geo = { tg: truckGeos(), a6: plainAxle(0.457), a4: plainAxle(0.419) };
  const V = T.vehicles, behind = j > T.li;
  const off = behind ? V.slice(j) : V.slice(0, j);
  T.vehicles = behind ? V.slice(0, j) : V.slice(j);
  for (const v of off) T.release(v);
  T.layout(); T.buildInstances();
  for (const im of T.inst) linearizeObject(im);
  const c = new Cut(scene, off);
  c.v = S.v;
  const kick = Math.abs(S.v) > 0.6;
  if (kick) c.rolling = true;
  else {
    // angle cock closed on the engine side; the cut's hoses part and its brakes go into emergency
    c.vented = true; c.rolling = Math.abs(S.v) > 0.005;
    for (const v of off) { v.brake.BP = 0; v.brake.emerg = true; }
  }
  CARS.cuts.push(c); CARS.cutFrom = c; CARS.cutAt = performance.now(); CARS.gen++;
  c.update(0); T.update(0, S.theta, S.reverser);
  sndPin(1 / (1 + Math.pow(off[0].pos.distanceTo(camera.position) / 30, 1.3)), !kick);
  const n = off.length, what = `${n} car${n > 1 ? 's' : ''}`;
  if (kick) toast(`Pin pulled: ${what} rolling free at ${Math.round(Math.abs(S.v) / MPH)} mph. Brake to let them run.`, 'warn', 4200, 'kick');
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
CARS.step = function (h) {
  for (const c of CARS.cuts.slice()) {
    if (!c.rolling || !CARS.cuts.includes(c)) continue;
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
      Fb += v.mass * v.brakeA * (b.BC / 64) * shoe + (v.hb ? v.mass * 9.81 * 0.1 : 0);
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
