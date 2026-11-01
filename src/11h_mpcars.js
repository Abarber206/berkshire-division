/* ============================================================================
   Cars in a room. The cuts of cars standing about belong to everyone in a
   multiplayer room: anyone can couple up to them, shove them, kick them, cut
   cars off their own train, work the knuckles, or set new cars down, and
   everyone sees the same cars in the same places.

   Each cut has an id ('y0'.. for the cuts the yard is made up with, or the
   player's id and a number for cuts made since) and a record: the cars in it,
   front to back, with their knuckles and handbrakes, where its front coupler
   stands, and how fast it is rolling. A record carries a version and an owner.
   Whoever last did something to a cut takes it over with a higher version,
   and from then on their game runs its physics and reports it about five
   times a second while it rolls; everyone else just draws it where it is
   reported (running it on by its speed between reports). The higher version
   wins; at the same version the lower player id does, so every game settles on
   the same cars without a server. Cars coupled into a player's own train leave
   the shared list (the record is kept as gone), and travel with that train,
   which tells the room what it is made up of (11b_net.js, trainCode).

   Changes are found by looking, not by hooks: every frame each cut is checked
   against the record it was last sent or received as. A cut that differs, that
   is new, or that is no longer on the railroad here was changed by this
   player, so it goes out. A newcomer asks for every record once; owners also
   send theirs again every few seconds, so a lost message heals itself.
   ========================================================================== */
const MPC = { live: false, synced: false, recs: new Map(), objs: new Map(), absorbed: new Map(), dirty: new Set(), seq: 0, q: 0, gen: -1,
  sentAt: 0, fullAt: 0, askAt: 0, asks: 0, joinedAt: 0 };
const MPC_ROLL_EVERY = 200, MPC_FULL_EVERY = 5000, MPC_TOMB_KEEP = 60000, MPC_MAX_CARS = 120, MPC_ORPHAN = 4000;

/* which of two records of one cut counts: the higher version; at the same version, the owner's later report,
   or between two owners, the lower player id */
function mpcBeats(r, rec) {
  if (!rec) return true;
  if (r.n !== rec.n) return r.n > rec.n;
  if (r.o === rec.o) return r.q > rec.q;
  return r.o < rec.o;
}
/* a car with its two knuckles and its handbrake */
const mpcCar = v => carToken(v) + ':' + ((v.kn && v.kn[0]) || 0) + ((v.kn && v.kn[1]) || 0) + (v.hb ? 1 : 0);
/* everything about a cut but where it stands and how fast it rolls */
MPC.sig = c => c.vehicles.map(mpcCar).join(',') + (c.vented ? '|v' : '');
/* which cars, in what order and which way round */
MPC.ids = c => c.vehicles.map(carToken).join(',');
MPC.find = mid => CARS.cuts.find(c => c.mid === mid) || null;
/* another player's game is moving these cars: ours only draws them */
CARS.driven = c => {
  if (!MPC.live || !c.mid) return false;
  const rec = MPC.recs.get(c.mid);
  return !!rec && !rec.g && rec.o !== '' && rec.o !== MP.id;
};
/* builds a car from its token; the tests swap this for a stand-in */
MPC.makeCar = k => carFromToken(k);
MPC.send = function (o) {
  o.id = MP.id;
  const txt = JSON.stringify(o);
  for (const l of MP.links) l.publish(MP.topic + '/c', txt);
};

/* ---------------- joining and leaving ---------------- */
MPC.join = function (creator) {
  const now = performance.now();
  Object.assign(MPC, { live: true, seq: 0, gen: -1, sentAt: 0, fullAt: now, askAt: 0, asks: 0, joinedAt: now });
  MPC.recs.clear(); MPC.objs.clear(); MPC.absorbed.clear(); MPC.dirty.clear();
  if (creator) {
    // the railroad as we left it becomes the room's: every cut is ours, and the yard as first made up is gone
    YARD_CUTS.forEach((d, i) => MPC.recs.set('y' + i, { n: 1, o: MP.id, q: ++MPC.q, g: 1, gAt: now }));
    for (const c of CARS.cuts) c.mid = null;
    MPC.synced = true;
  } else {
    // start from the yard as everyone first has it, then ask the room how it stands now
    if (typeof PLACE !== 'undefined' && PLACE.on) PLACE.exit();
    CARS.clear(null, true);
    if (!WORLD.custom) CARS.yard(LOCO_SPEC['765'].short);
    for (const c of CARS.cuts) { MPC.recs.set(c.mid, { n: 0, o: '', q: 0, g: 0, sig: MPC.sig(c), v: 0, r: 0 }); MPC.objs.set(c.mid, c); }
    MPC.synced = false;
  }
  MPC.changed();
};
MPC.leave = function () {
  if (!MPC.live) return;
  MPC.live = false; MPC.synced = false;
  MPC.recs.clear(); MPC.objs.clear(); MPC.absorbed.clear(); MPC.dirty.clear();
  // what is left standing stays put, as single-player cars
  for (const c of CARS.cuts) { c.mid = null; if (c.rolling) { c.v = 0; c.rolling = false; } }
  MPC.changed();
};
/* the lowest id in the room that has the cars: it answers a newcomer */
MPC.leader = function () {
  let id = MPC.synced ? MP.id : '';
  for (const p of MP.peers.values()) if (p.st && p.st.cs && (!id || p.id < id)) id = p.id;
  return id;
};
/* the lowest id in the room: it takes over the cars of a player who has left */
MPC.heir = function () { let id = MP.id; for (const p of MP.peers.keys()) if (p < id) id = p; return id; };

/* ---------------- every frame ---------------- */
MPC.tick = function () {
  if (!MPC.live) return;
  const now = performance.now();
  MPC.follow(now);
  MPC.diff(now);
  // a claim on cars we coupled up to only needs settling while the room may not have heard of it yet
  for (const [mid, ab] of MPC.absorbed) if (now - ab.at > 10000) MPC.absorbed.delete(mid);
  if (MPC.dirty.size && now - MPC.sentAt > 90) MPC.flush(now);
  if (now - MPC.fullAt > MPC_FULL_EVERY) { MPC.fullAt = now; MPC.resend(now); }
  if (!MPC.synced && now - MPC.askAt > 1500) {
    MPC.askAt = now; MPC.asks++;
    // nobody answers: we are the first here, or the others are not sharing cars yet
    if (MPC.asks > 3 && (!MP.peers.size || MPC.asks > 6)) MPC.synced = true;
    else MPC.send({ t: 'req' });
  }
};
/* another player's cuts, drawn where they report them and run on at the speed they report */
MPC.follow = function (now) {
  const T = GAME.train, live = GAME.running && !S.paused && !S.derailed && !(typeof PLACE !== 'undefined' && PLACE.on);
  for (const c of CARS.cuts.slice()) {
    if (!c.mid || !CARS.cuts.includes(c)) continue;
    const rec = MPC.recs.get(c.mid);
    if (!rec || rec.g || rec.o === '' || rec.o === MP.id || !rec.tp || !rec.v) continue;
    // the player moving them has left the room: the lowest id left carries on with them
    if (!MP.peers.has(rec.o) && now - MPC.joinedAt > MPC_ORPHAN && now - rec.at > MPC_ORPHAN) {
      if (MPC.heir() === MP.id) MPC.take(c, rec, now);
      continue;
    }
    const t = Math.min(1.5, Math.max(0, (now - rec.at) / 1000 + (rec.lag || 0)));
    const target = rec.tp.clone(); target.advance(rec.v * t, null);
    const cur = c.endTP('front');
    const d = trackDelta(cur, target, 80);
    if (d === null) { c.place(target); c.dirty = true; continue; }
    if (Math.abs(d) < 1e-4) continue;
    if (live && T && Math.sign(d) === Math.sign(rec.v)) {
      // rolling into our train: here they stop against it or couple to it, as the physics has it, and become ours
      const lim = CARS.limit(c, d);
      if (lim.hit && lim.hit.c === T && lim.hit.facing) {
        if (lim.d) { const f = cur.clone(); f.advance(lim.d, null); c.place(f); }
        c.dirty = true;
        CARS.contact(c, Math.sign(d), lim.hit);
        continue;
      }
    }
    const f = cur.clone(); f.advance(d, null); c.place(f); c.dirty = true;
  }
};
/* what this player has done to the cars since the last look */
MPC.diff = function (now) {
  const seen = new Set(), again = CARS.gen !== MPC.gen;
  MPC.gen = CARS.gen;
  for (const c of CARS.cuts) {
    if (!c.mid) c.mid = MP.id + '.' + (++MPC.seq);
    seen.add(c.mid); MPC.objs.set(c.mid, c);
    let rec = MPC.recs.get(c.mid);
    if (!rec) { rec = { n: 0, o: MP.id, q: 0, g: 0 }; MPC.recs.set(c.mid, rec); MPC.take(c, rec, now); continue; }   // new cars: ours
    if (rec.g) { MPC.take(c, rec, now); continue; }   // picked up and set down again
    const sig = again || rec.sig === undefined ? MPC.sig(c) : rec.sig;
    const v = c.v || 0, rolling = c.rolling ? 1 : 0;
    if (rec.o !== MP.id) {
      // someone else's (or nobody's) cars, changed here: we coupled up, shoved them, worked a knuckle
      if (sig !== rec.sig || v !== rec.v || rolling !== rec.r) MPC.take(c, rec, now);
      continue;
    }
    if (sig !== rec.sig) { rec.n++; MPC.mark(c, rec, sig, now); }
    else if (rolling !== rec.r || (rolling && now - rec.at > MPC_ROLL_EVERY)) MPC.mark(c, rec, sig, now);
  }
  for (const [mid, rec] of MPC.recs) {
    if (rec.g || seen.has(mid)) continue;
    // gone from the railroad here: coupled into our train or another cut, or picked up to be placed
    const c = MPC.objs.get(mid), T = GAME.train;
    if (c && T && c.vehicles.length && c.vehicles.every(v => T.vehicles.includes(v))) MPC.absorbed.set(mid, { at: now, vehicles: c.vehicles.slice() });
    rec.n++; rec.o = MP.id; rec.g = 1; rec.gAt = now; rec.q = ++MPC.q; rec.at = now;
    MPC.objs.delete(mid);
    MPC.dirty.add(mid);
  }
};
MPC.take = function (c, rec, now) { rec.n++; rec.o = MP.id; rec.g = 0; MPC.mark(c, rec, MPC.sig(c), now); };
MPC.mark = function (c, rec, sig, now) {
  rec.sig = sig; rec.v = c.v || 0; rec.r = c.rolling ? 1 : 0; rec.at = now; rec.q = ++MPC.q;
  MPC.dirty.add(c.mid);
};

/* ---------------- sending ---------------- */
MPC.record = function (mid) {
  const rec = MPC.recs.get(mid); if (!rec) return null;
  if (rec.g) return { k: mid, n: rec.n, o: rec.o, q: rec.q, g: 1 };
  const c = MPC.objs.get(mid); if (!c || !CARS.cuts.includes(c)) return null;
  const f = c.endTP('front');
  // while our game is stopped (the menu, placing, a wreck) our cars stand still, so they are reported standing
  const still = !GAME.running || S.paused || S.derailed || (typeof PLACE !== 'undefined' && PLACE.on);
  return { k: mid, n: rec.n, o: rec.o, q: rec.q, c: c.vehicles.map(mpcCar), f: [f.e.id, Math.round(f.s * 1000) / 1000, f.o], v: still ? 0 : Math.round((c.v || 0) * 1000) / 1000, r: c.rolling ? 1 : 0, vt: c.vented ? 1 : 0, h: c.home || '' };
};
MPC.post = function (t, list, extra) {
  for (let i = 0; i < list.length; i += 40) MPC.send(Object.assign({ t, c: list.slice(i, i + 40) }, extra || {}));
};
MPC.flush = function (now) {
  const out = [];
  for (const mid of MPC.dirty) { const r = MPC.record(mid); if (r) out.push(r); }
  MPC.dirty.clear(); MPC.sentAt = now;
  if (out.length) MPC.post('c', out);
};
/* our own records once more, in case a message went astray */
MPC.resend = function (now) {
  const out = [];
  for (const [mid, rec] of MPC.recs) {
    if (rec.o !== MP.id || (rec.g && now - rec.gAt > MPC_TOMB_KEEP && mid[0] !== 'y')) continue;
    const r = MPC.record(mid); if (r) out.push(r);
  }
  if (out.length) MPC.post('c', out);
};
/* every record we hold, for a newcomer */
MPC.snap = function (to) {
  const now = performance.now(), out = [];
  for (const [mid, rec] of MPC.recs) {
    if (rec.g && now - rec.gAt > MPC_TOMB_KEEP && mid[0] !== 'y') continue;
    const r = MPC.record(mid); if (r) out.push(r);
  }
  if (!out.length) out.push({ k: 'none', n: 0, o: '', q: 0, g: 1 });
  MPC.post('snap', out, { to });
};

/* ---------------- receiving ---------------- */
MPC.onText = function (txt) {
  if (!MPC.live || txt.length > 200000) return;
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (!m || typeof m.id !== 'string' || !/^[a-z0-9]{6,16}$/.test(m.id) || m.id === MP.id) return;
  if (m.t === 'req') { if (MPC.leader() === MP.id) MPC.snap(m.id); return; }
  if ((m.t !== 'c' && m.t !== 'snap') || !Array.isArray(m.c)) return;
  const p = MP.peers.get(m.id), lag = p && MP.lag ? MP.lag(p) : 0.15;
  for (const raw of m.c.slice(0, 400)) {
    const r = MPC.clean(raw);
    // a player only speaks for themselves, except when passing every record on to a newcomer
    if (r && (m.t === 'snap' || r.o === m.id)) MPC.apply(r, lag);
  }
  if (m.t === 'snap' && m.to === MP.id && !MPC.synced) { MPC.synced = true; MP.dirty = true; }
};
/* a record as it came in, checked and clamped, or null */
MPC.clean = function (r) {
  if (!r || typeof r !== 'object' || typeof r.k !== 'string' || !/^[a-z0-9.]{1,24}$/.test(r.k)) return null;
  if (!Number.isInteger(r.n) || r.n < 0 || r.n > 1e9) return null;
  if (typeof r.o !== 'string' || !/^[a-z0-9]{0,16}$/.test(r.o)) return null;
  const q = Number.isInteger(r.q) && r.q >= 0 ? r.q : 0;
  if (r.g) return r.k === 'none' ? null : { k: r.k, n: r.n, o: r.o, q, g: 1 };
  if (!Array.isArray(r.c) || !r.c.length || r.c.length > MPC_MAX_CARS) return null;
  const cars = [];
  for (const t of r.c) {
    if (typeof t !== 'string') return null;
    const i = t.lastIndexOf(':'), id = t.slice(0, i), st = t.slice(i + 1), k = i > 0 ? carTokenIn(id) : null;
    if (!k || !/^[012]{2}[01]$/.test(st)) return null;
    k.kn = [+st[0], +st[1]]; k.hb = st[2] === '1'; k.id = id;
    cars.push(k);
  }
  const e = Array.isArray(r.f) && MP.edges ? MP.edges.get(r.f[0]) : null;
  if (!e || typeof r.f[1] !== 'number' || !isFinite(r.f[1])) return null;
  const v = typeof r.v === 'number' && isFinite(r.v) ? clamp(r.v, -30, 30) : 0;
  const h = typeof r.h === 'string' ? r.h.replace(/[^\w &'.,-]/g, '').slice(0, 24) : '';
  return { k: r.k, n: r.n, o: r.o, q, cars, e, s: clamp(r.f[1], 0, e.len), fo: r.f[2] < 0 ? -1 : 1, v, r: r.r ? 1 : 0, vt: r.vt ? 1 : 0, h };
};
MPC.apply = function (r, lag = 0) {
  const rec = MPC.recs.get(r.k);
  if (!mpcBeats(r, rec)) return false;
  const now = performance.now();
  const nrec = { n: r.n, o: r.o, q: r.q, g: r.g ? 1 : 0, at: now, gAt: r.g ? now : 0 };
  MPC.recs.set(r.k, nrec);
  let c = MPC.find(r.k);
  // two players took the same cars at the same moment (coupled up, or one coupled while the other shoved), and
  // the other one counts: the cars leave our train
  const ab = MPC.absorbed.get(r.k);
  if (ab && r.o !== MP.id) { MPC.absorbed.delete(r.k); if (!c) MPC.unabsorb(ab.vehicles); }
  if (r.g) { if (c) MPC.drop(c); MPC.objs.delete(r.k); MPC.changed(); return true; }
  if (c && MPC.ids(c) !== r.cars.map(k => k.id).join(',')) { MPC.drop(c); c = null; }
  if (!c) {
    let V;
    try { V = r.cars.map(k => MPC.makeCar(k)); } catch (e) { console.warn('room car', e); MPC.recs.set(r.k, rec || { n: -1, o: '', q: 0, g: 1 }); return false; }
    V.forEach((v, i) => { v.flip = r.cars[i].flip; v.yard = true; v.brake = { AR: 0, BC: 0, BP: 0, emerg: false, released: true }; });
    if (!CARS.geo) CARS.geo = carGeos();
    c = new Cut(scene, V); c.mid = r.k;
    CARS.cuts.push(c);
  }
  c.vehicles.forEach((v, i) => { const k = r.cars[i]; v.kn = k.kn.slice(); v.hb = k.hb; if (r.vt) { v.brake.BP = 0; v.brake.emerg = true; } });
  c.vented = !!r.vt; c.v = r.v; c.rolling = !!r.r; c.stopT = 0; if (r.h) c.home = r.h;
  nrec.tp = new TrackPos(r.e, r.s, r.fo); nrec.lag = lag; nrec.v = c.v; nrec.r = c.rolling ? 1 : 0;
  c.place(nrec.tp); c.dirty = true;
  nrec.sig = MPC.sig(c);
  MPC.objs.set(r.k, c);
  // a cut that has only rolled on needs no more than a fresh look at what stands where
  if (!rec || rec.g || rec.sig !== nrec.sig) MPC.changed(); else if (typeof IX !== 'undefined') IX.idx = null;
  return true;
};
/* Our cars rolling into another player's train stop against it, as against a bumping post: it is their game
   that says what happens to their train. True when moving c by d would put its leading coupler on one. */
const _mpcF = newFrame(), _mpcW = new THREE.Vector3();
CARS.wall = function (c, d) {
  if (!MPC.live || !MP.peers.size || !d) return false;
  const t = c.endTP(d > 0 ? 'front' : 'rear'), F = _mpcF;
  t.pose(F); const was = _mpcW.copy(F.p);
  t.advance(d, null); t.pose(F);
  for (const p of MP.peers.values()) {
    const rt = p.rt; if (!rt || !rt.placed || !rt.polyN) continue;
    if (F.p.distanceTo(rt.poly[0]) > rt.train.length + 40) continue;
    for (let i = 0; i < rt.polyN - 1; i++) {
      const A = rt.poly[i], B = rt.poly[i + 1], now = mpSegDist(F.p, A, B);
      if (now < 1.25 && now < mpSegDist(was, A, B)) return true;
    }
  }
  return false;
};
MPC.drop = function (c) {
  CARS.cuts = CARS.cuts.filter(x => x !== c);
  c.dispose(); c.vehicles.forEach(freeVehicle);
};
/* cars that went into our train, taken back out: they are in someone else's */
MPC.unabsorb = function (gone) {
  const T = GAME.train; if (!T) return;
  const set = new Set(gone), V = T.vehicles;
  if (!V.some(v => set.has(v))) return;
  const keep = V.filter(v => !set.has(v));
  if (!keep.some(isPower)) return;
  let lead = 0; for (const v of V) { if (!set.has(v)) break; lead += v.len; }
  const front = T.endTP('front'); if (lead) front.advance(-lead, null);
  for (const v of V) if (set.has(v)) { T.release(v); T.scene.remove(v.root); freeVehicle(v); }
  T.vehicles = keep; T.layout(); T.buildInstances();
  for (const im of T.inst) linearizeObject(im);
  T.place(front); T.update(0, S.theta, S.reverser);
  toast('Someone else coupled up to those cars a moment before you did, so they went with their train.', 'warn', 4500, 'mpcboth');
  CARS.gen++;
  if (CARS.onChange) CARS.onChange();
};
/* the cars changed under the player: anything that remembers where they were has to look again */
MPC.changed = function () {
  CARS.gen++;
  if (typeof IX !== 'undefined') IX.idx = null;
  if (typeof PLACE !== 'undefined') { PLACE.grid = null; if (PLACE.pick && PLACE.pick.c !== GAME.train && !CARS.cuts.includes(PLACE.pick.c)) PLACE.pick = null; }
  if (CARS.onChange) CARS.onChange();
  if (typeof MAP !== 'undefined' && MAP.visible) MAP.draw();
};
