/* ============================================================================
   Traffic: the interlocking (routes locked for AI trains, signal aspects)
   and AI trains running the timetable on the Berkshire Division
   ========================================================================== */
const IX = { res: new Map(), idx: null, idxAt: -1 };
const AI = { trains: [] };

/* every consist on the railroad: ours, standing cuts, AI trains and other players' trains */
IX.consists = function () {
  const a = [];
  if (GAME.train) a.push(GAME.train);
  a.push(...CARS.cuts);
  for (const t of AI.trains) a.push(t.train);
  if (MP.on) for (const p of MP.peers.values()) if (p.rt && p.rt.placed) a.push(p.rt.train);
  return a;
};
/* where everything stands, by edge: each tracked point and coupler face (rebuilt at most once a tick) */
IX.index = function () {
  if (IX.idx && IX.idxAt === S.time) return IX.idx;
  const idx = new Map(), add = (tp, c) => { let l = idx.get(tp.e); if (!l) idx.set(tp.e, l = []); l.push({ c, s: tp.s }); };
  for (const c of IX.consists()) { for (const p of c.pts) add(p.tp, c); add(c.endTP('front'), c); add(c.endTP('rear'), c); }
  IX.idx = idx; IX.idxAt = S.time;
  return idx;
};
/* the consists standing on edge e between a and b (either order), or foul of switch sw */
IX.on = function (e, a, b, out) {
  const l = IX.index().get(e); if (!l) return out;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (const it of l) if (it.s >= lo && it.s <= hi && !out.includes(it.c)) out.push(it.c);
  return out;
};
IX.fouling = function (sw, out) {
  for (const c of IX.consists()) if (!out.includes(c) && c.fouls(sw)) out.push(c);
  return out;
};

/* Walk the route as the switches lie from track position (e, s) heading o (+1 along the edge), for at most
   maxD metres. piece(e, a, b, d) is called for each stretch of track (d: distance to its start) and
   node(node, d, facing, lined) at each switch; either returning true stops the walk. Returns the
   distance walked and why it ended: 'stop' (a callback), 'end' (end of track) or 'far'. */
function routeWalk(e, s, o, maxD, piece, node) {
  let d = 0;
  for (let g = 0; g < 80; g++) {
    const toEnd = o > 0 ? e.len - s : s, b = o > 0 ? e.len : 0;
    if (d + toEnd >= maxD) { const bb = s + o * (maxD - d); piece(e, s, bb, d); return { d: maxD, why: 'far' }; }
    if (piece(e, s, b, d)) return { d, why: 'stop' };
    d += toEnd;
    const end = o > 0 ? 1 : 0, nd = end ? e.b : e.a;
    const nx = nd ? nd.next(e, end, null) : null;
    if (!nx) return { d, why: 'end' };
    if (nd.sw) {
      const sw = nd.sw, facing = sw.trunk.edge === e && sw.trunk.end === end;
      const lined = facing || sw.legs[sw.state].edge === e && sw.legs[sw.state].end === end;
      if (node(nd, d, facing, lined)) return { d, why: 'stop' };
    }
    e = nx.edge; o = nx.end === 0 ? 1 : -1; s = nx.end === 0 ? 0 : e.len;
  }
  return { d, why: 'far' };
}

/* ---------------- signals ---------------- */
/* A signal governs the route from itself to the next signal facing the same way. Stop when a train is on
   that route or foul of it, a switch on it is moving or lined against the move, or an AI train has it
   locked; Restricting when only standing cars are in the way; Approach when the next signal is at Stop. */
function signalRoute(s) {
  if (!s.loc) s.loc = s.sg.line.locate(s.sg.sLine);
  const out = { pieces: [], switches: [], diverging: false, against: false, next: null, end: false };
  const w = routeWalk(s.loc.edge, s.loc.s, s.sg.dir, 4500, (e, a, b, d) => {
    // the next signal facing the same way ends the route
    let cut = null;
    for (const q of SCN.signals) {
      if (q === s) continue;
      const ql = q.loc || (q.loc = q.sg.line.locate(q.sg.sLine)); if (ql.edge !== e) continue;
      const o = b >= a ? 1 : -1, ds = (ql.s - a) * o;
      if (ds <= 2 || ds > Math.abs(b - a) || (q.sg.dir > 0) !== (o > 0)) continue;
      if (!cut || ds < cut.ds) cut = { q, ds };
    }
    out.pieces.push({ e, a, b: cut ? a + (b >= a ? 1 : -1) * cut.ds : b });
    if (cut) { out.next = cut.q; return true; }
  }, (nd, d, facing, lined) => {
    const sw = nd.sw;
    out.switches.push(sw);
    if (facing && sw.state) out.diverging = true;
    if (!lined || Math.abs(sw.anim - sw.state) > 0.02) { out.against = true; return true; }
  });
  out.end = w.why === 'end';
  return out;
}
function signalAspect(s) {
  const r = signalRoute(s);
  s.route = r; s.why = '';
  if (r.against) { s.why = 'switch not lined'; return 'Stop'; }
  // the train this route is locked for, while it is still short of the signal, gets a proceed
  const mine = IX.holders().find(h => h.signalsAhead.includes(s)) || null;
  for (const p of r.pieces) { const o = IX.reserved(p.e, p.a, p.b, mine); if (o) { s.why = `route locked for ${o.name}`; return 'Stop'; } }
  const hit = [];
  for (const p of r.pieces) IX.on(p.e, p.a, p.b, hit);
  for (const sw of r.switches) IX.fouling(sw, hit);
  if (hit.length) {
    if (hit.every(c => c instanceof Cut)) return 'Restricting';
    const c = hit.find(c => !(c instanceof Cut));
    s.why = c === GAME.train ? 'your train is in the block' : c.ai ? `${c.ai.name} is in the block` : 'a train is in the block';
    return 'Stop';
  }
  const nx = r.next && r.next.aspect;
  const approach = !r.next || nx === 'Stop' || nx === 'Restricting';
  return r.diverging ? (approach ? 'Diverging Approach' : 'Diverging Clear') : (approach ? 'Approach' : 'Clear');
}

/* ---------------- route locking ----------------
   A route is locked as pieces of track (an edge between two distances) held by an owner: an AI train,
   or the player's train once it is given a signal (IX.PLAYER). Switches on a locked route are locked too,
   and the two switches of a crossover lock together. */
IX.lock = new Map();
IX.PLAYER = { name: 'your train', signalsAhead: [], pieces: [], locks: [] };
IX.holders = () => [IX.PLAYER, ...AI.trains];
IX.reserve = function (owner, e, a, b) {
  const r = { e, a, b, owner };
  let l = IX.res.get(e); if (!l) IX.res.set(e, l = []);
  l.push(r);
  return r;
};
IX.unreserve = function (r) { const l = IX.res.get(r.e); if (!l) return; const i = l.indexOf(r); if (i >= 0) l.splice(i, 1); if (!l.length) IX.res.delete(r.e); };
/* who other than skip holds any of edge e between a and b */
IX.reserved = function (e, a, b, skip) {
  const l = IX.res.get(e); if (!l) return null;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (const r of l) if (r.owner !== skip && Math.max(r.a, r.b) >= lo && Math.min(r.a, r.b) <= hi) return r.owner;
  return null;
};
const swPair = sw => sw.mate ? [sw, sw.mate] : [sw];
IX.take = function (owner, sw) { for (const s of swPair(sw)) { const k = IX.lock.get(s); if (k && k.owner === owner) k.n++; else IX.lock.set(s, { owner, n: 1 }); } };
IX.drop = function (owner, sw) { for (const s of swPair(sw)) { const k = IX.lock.get(s); if (k && k.owner === owner && --k.n <= 0) IX.lock.delete(s); } };
IX.lockedBy = function (sw) { for (const s of swPair(sw)) { const k = IX.lock.get(s); if (k) return k.owner; } return null; };
IX.clear = function () { IX.res.clear(); IX.lock.clear(); Object.assign(IX.PLAYER, { signalsAhead: [], pieces: [], locks: [], last: null, passed: null }); };

/* The player's train holds the route of a signal it is running up to at speed, and of the signal it has
   just passed for as long as it is on that route, so an AI train is never let in ahead of it. Passing a
   signal at Stop is a rules violation. */
IX.playerTick = function () {
  const P = IX.PLAYER, T = GAME.train, sc = GAME.scan;
  if (!T || !sc) return;
  const sig = sc.signal, av = Math.abs(S.v);
  // passed a signal: the one we were closing on is no longer the one ahead
  if (P.last && (!sig || sig.sg !== P.last.sg || sig.d > P.last.d + 5) && P.last.d < 40) {
    const g = P.last.sg;
    if (P.last.aspect === 'Stop') { JOB.note('signal', { why: g.why }); toast(`Passed a signal at Stop${g.why ? ': ' + g.why : ''}. Stop short of red signals and wait for them to clear.`, 'bad', 5200, 'stopsig'); }
    P.passed = g.route && g.aspect !== 'Stop' ? g.route : null;
  }
  P.last = sig ? { sg: sig.sg, d: sig.d, aspect: sig.sg.aspect } : null;
  const want = [], sws = [];
  if (P.passed && P.passed.pieces.some(p => IX.on(p.e, p.a, p.b, []).includes(T))) { want.push(...P.passed.pieces); sws.push(...P.passed.switches); }
  else P.passed = null;
  // running against the current of traffic there are no signals for us: hold the main ahead instead
  const f = S.v >= 0 ? T.endTP('front') : T.endTP('rear'), dir = (S.v >= 0 ? 1 : -1) * f.o;
  const ln = f.e.line, against = (ln === ROUTE.main && dir < 0) || (ln === ROUTE.main2 && dir > 0);
  if (against && av > 0.5) {
    routeWalk(f.e, f.s, dir, 900 + av * av / 0.8, (e, a, b) => { want.push({ e, a, b }); }, (nd, d, facing, lined) => { sws.push(nd.sw); return !lined; });
    if (!P.againstT || S.time - P.againstT > 120) toast(`Running against the current of traffic on track ${ln === ROUTE.main ? 1 : 2}. Trains coming the other way are held for you: keep it moving.`, 'warn', 5200, 'against');
    P.againstT = S.time;
  }
  P.signalsAhead = [];
  if (sig && sig.sg.route && sig.sg.aspect !== 'Stop' && av > 1 && sig.d < 250 + av * av / 0.8) {
    P.signalsAhead = [sig.sg]; want.push(...sig.sg.route.pieces); sws.push(...sig.sg.route.switches);
  }
  for (const r of P.pieces) IX.unreserve(r);
  for (const sw of P.locks) IX.drop(P, sw);
  P.pieces = []; P.locks = [];
  for (const p of want) if (!IX.reserved(p.e, p.a, p.b, P)) P.pieces.push(IX.reserve(P, p.e, p.a, p.b));
  for (const sw of sws) { const o = IX.lockedBy(sw); if (!o || o === P) { IX.take(P, sw); P.locks.push(sw); } }
};

/* ---------------- AI trains ----------------
   Each runs on its own main track in the current of traffic (track 1 eastward, track 2 westward), asking
   the interlocking for a route one signal at a time and stopping at the signal when it is refused. A slow
   train with a faster one close behind takes the passing siding on its track (Kenton for eastward trains,
   Fostoria for westward ones) and waits there until it has gone by. Passenger trains make station stops. */
const TRAFFIC = {
  no12: { name: 'No. 12', sub: 'Westward local', loco: '1225', consist: 'passenger', dir: -1, vmax: 60, accel: 0.3, brake: 0.55, stops: true, seed: 12 },
  no5: { name: 'No. 5', sub: 'Eastward express', loco: 'diesel', units: 2, livery: 'kn', consist: 'passenger', dir: 1, vmax: 70, accel: 0.32, brake: 0.6, stops: true, seed: 5 },
  x2210: { name: 'Extra 2210 East', sub: 'Manifest freight', loco: 'diesel', units: 2, livery: 'fle', consist: 'freight', dir: 1, vmax: 45, accel: 0.12, brake: 0.32, seed: 2210 },
};
/* free running: where each train is on the road when you start (distance along track 1) */
const FREE_TRAFFIC = [['no12', 13800], ['x2210', 7700], ['no5', 20400]];
const PASSING = { 1: 'Kenton East', '-1': 'Fostoria East' };
const DWELL = 35;

class AITrain extends RemoteTrain {
  constructor(id, def) {
    const st = { lk: def.loco, ck: def.consist, u: def.units || 1, lv: def.livery || 'ss', mx: false, cu: null, no: null };
    const road = ROAD_SHORT;
    super(null, st, { seed: def.seed });
    ROAD_SHORT = road;
    this.id = id; this.def = def; this.name = def.name;
    this.st = Object.assign(st, { hl: 2, wh: 0, bl: false, dl: true, rpm: 300, ex: 0, rv: 0.6 });
    this.train.ai = this; this.train.v = 0;
    this.line = def.dir > 0 ? ROUTE.main : ROUTE.main2;
    this.route = []; this.sws = []; this.signalsAhead = []; this.endSig = null; this.end = null;
    this.authLeft = 0; this.odo = 0; this.events = []; this.askT = 0; this.held = 0; this.heldWhy = ''; this.dwell = 0;
    this.horn = []; this.hornT = 0; this.blown = new Set(); this.lookT = 0; this.block = null; this.yieldTo = null; this.yieldT = 0;
  }
  get v() { return this.train ? this.train.v : 0; }
  set v(x) { if (this.train) this.train.v = x; }
  /* stand the train with its front coupler at track position tp, facing the way it runs */
  place(tp) {
    const T = this.train;
    T.place(tp); T.update(0, this.theta, this.st.rv);
    this.placed = true; this.visible = true;
    this.end = T.endTP('front'); this.authLeft = 0; this.endSig = null;
  }
  /* the track the train stands on, from rear coupler to front, as pieces */
  footprint(pad = 0) {
    const out = [], f = this.train.endTP('front');
    f.advance(pad, null);
    routeWalk(f.e, f.s, -f.o, this.train.length + 2 * pad, (e, a, b) => { out.push({ e, a, b }); }, () => {});
    return out;
  }

  /* ---- asking for a route ---- */
  /* the route from the end of our authority to the next signal facing our way, choosing legs as we go */
  plan() {
    const sigs = SCN.signals, out = { pieces: [], sws: [], sig: null, len: 0 };
    let e = this.end.e, s = this.end.s, o = this.end.o, d = 0;
    for (let g = 0; g < 40 && d < 4500; g++) {
      const b = o > 0 ? e.len : 0;
      let cut = null;
      for (const q of sigs) {
        const ql = q.loc || (q.loc = q.sg.line.locate(q.sg.sLine)); if (ql.edge !== e || (q.sg.dir > 0) !== (o > 0)) continue;
        const ds = (ql.s - s) * o; if (ds <= 1 || ds > Math.abs(b - s)) continue;
        if (!cut || ds < cut.ds) cut = { q, ds };
      }
      if (cut) { out.pieces.push({ e, a: s, b: s + o * cut.ds }); out.sig = cut.q; out.len = d + cut.ds; return out; }
      out.pieces.push({ e, a: s, b }); d += Math.abs(b - s);
      const end = o > 0 ? 1 : 0, nd = end ? e.b : e.a;
      if (!nd) { out.len = d - 12; return out; }
      let nx;
      if (nd.sw) {
        const sw = nd.sw, facing = sw.trunk.edge === e && sw.trunk.end === end;
        const leg = facing ? this.choose(sw) : (sw.legs[0].edge === e && sw.legs[0].end === end ? 0 : 1);
        out.sws.push({ sw, state: leg, d });
        nx = facing ? sw.legs[leg] : sw.trunk;
      } else nx = nd.next(e, end, null);
      if (!nx) { out.len = d - 12; return out; }   // end of track: stop short of the bumper
      e = nx.edge; o = nx.end === 0 ? 1 : -1; s = nx.end === 0 ? 0 : e.len;
    }
    out.len = d; return out;
  }
  /* which way to take a facing switch: straight on, unless it is our passing siding and we should let a faster train by */
  choose(sw) {
    if (sw.name !== PASSING[this.def.dir] || this.yieldTo) return this.yieldTo && sw.name === PASSING[this.def.dir] ? 1 : 0;
    const f = this.follower();
    if (f) { this.yieldTo = f; this.yieldT = 0; return 1; }
    return 0;
  }
  /* a faster train coming up behind us on our track, within a few miles */
  follower() {
    const rear = this.train.endTP('rear'), hit = carFrom(rear, -1, 5000, carIndex(), this.train);
    if (!hit) return null;
    const c = hit.c, them = c === GAME.train ? Math.abs(S.v) : Math.abs(c.v || 0);
    if (c === GAME.train) return them > 6 && hit.d < 3500 ? c : null;
    if (c.ai && c.ai.def.dir === this.def.dir && c.ai.def.vmax > this.def.vmax + 8) return c;
    return null;
  }
  /* why the route can't be had, or '' */
  refused(r) {
    const me = this.train;
    if (this.yieldTo && this.inSiding() && !this.passedBy(this.yieldTo)) return `letting ${this.yieldTo === GAME.train ? 'you' : this.yieldTo.ai.name} by`;
    for (const p of r.pieces) {
      const on = IX.on(p.e, p.a, p.b, []).filter(c => c !== me);
      if (on.length) return on[0] === GAME.train ? 'your train' : on[0].ai ? on[0].ai.name : 'cars';
      const o = IX.reserved(p.e, p.a, p.b, this);
      if (o) return o === IX.PLAYER ? 'your train' : o.name;
    }
    for (const { sw, state } of r.sws) for (const s of swPair(sw)) {
      const o = IX.lockedBy(s);
      if (o && o !== this && s.state !== state) return o === IX.PLAYER ? 'your train' : o.name;
      const foul = IX.fouling(s, []).filter(c => c !== me);
      if (foul.length) return foul[0] === GAME.train ? 'your train' : foul[0].ai ? foul[0].ai.name : 'cars';
      if (Math.abs(s.anim - s.state) > 0.02) return 'a switch moving';
    }
    return '';
  }
  ask() {
    const r = this.plan();
    if (!r.pieces.length || r.len <= 1) return false;
    const why = this.refused(r);
    if (why) { this.heldWhy = why; return false; }
    // grant: line and lock the switches, lock the track, and note what lies along it
    const base = this.odo + this.authLeft;
    for (const { sw, state, d } of r.sws) {
      const changed = sw.state !== state;
      for (const s of swPair(sw)) s.state = state;
      IX.take(this, sw);
      this.sws.push({ sw, at: base + d, changed, passed: false });
    }
    for (const p of r.pieces) this.route.push(IX.reserve(this, p.e, p.a, p.b));
    if (this.endSig) this.signalsAhead.push(this.endSig);
    let d = 0;
    for (const p of r.pieces) {
      const L = Math.abs(p.b - p.a);
      this.events.push({ at: base + d, limit: p.e.limit * MPH });
      if (this.def.stops) for (const st of ROUTE.stations) {
        const m = this.stopMark(st); if (!m || m.e !== p.e) continue;
        const k = (m.s - p.a) * Math.sign(p.b - p.a || 1);
        if (k >= 0 && k <= L) this.events.push({ at: base + d + k + 18, stop: st.name });   // the cab on the mark
      }
      for (const c of SCN.crossings) if (c.edge === p.e) { const k = (c.s - p.a) * Math.sign(p.b - p.a || 1); if (k >= 0 && k <= L) this.events.push({ at: base + d + k - 380, horn: 'crossing' }); }
      d += L;
    }
    this.events.sort((a, b) => a.at - b.at);
    this.authLeft += r.len; this.endSig = r.sig;
    const last = r.pieces[r.pieces.length - 1]; this.end = new TrackPos(last.e, last.b, Math.sign(last.b - last.a) || this.end.o);
    this.heldWhy = '';
    return true;
  }
  /* a station's mark on our track */
  stopMark(st) {
    if (st.kind !== 'depot' && st.kind !== 'small') return null;
    if (this.line === ROUTE.main) return st.line === ROUTE.main ? { e: st.edge, s: st.s } : null;
    const loc = ROUTE.main2.locate(ROUTE.to2(st.sLine)); return { e: loc.edge, s: loc.s };
  }
  inSiding() { const k = this.train.endTP('front').e.kind; return k === 'siding' || k === 'yard'; }
  /* the train t has gone past us: its rear is ahead of our front along the main */
  passedBy(t) {
    if (!t || (t !== GAME.train && !AI.trains.some(a => a.train === t))) return true;
    const dir = this.def.dir, L = ROUTE.mainLen, wrap = x => ((x % L) + L * 1.5) % L - L / 2;
    const me = AI.along(this.train.endTP('front'), dir), f = AI.along(t.endTP('front'), dir), b = AI.along(t.endTP('rear'), dir);
    if (me === null || f === null || b === null) return false;
    return wrap(f - me) > 30 && wrap(b - me) > 30;
  }

  /* ---- running ---- */
  tick(dt) {
    const T = this.train, def = this.def;
    // keep asking for the road while it is closer than our stopping distance and a bit
    this.askT -= dt;
    const stopD = this.v * this.v / (2 * def.brake);
    if (this.authLeft < stopD + 400 && this.askT <= 0) { this.askT = 1; this.ask(); }
    if (this.yieldTo) { this.yieldT += dt; if (this.yieldT > 480 || (!this.inSiding() && this.passedBy(this.yieldTo))) this.yieldTo = null; }
    // something on the track ahead that should not be: brake for it
    this.lookT -= dt;
    if (this.lookT <= 0) {
      this.lookT = 0.25;
      const hit = carAhead(T, 1, Math.min(this.authLeft + 50, 1500), carIndex());
      this.block = hit && hit.d < this.authLeft + 20 ? hit : null;
    }
    // speed allowed: track limits under the train and ahead, our own top speed, and stopping where we must
    let vt = def.vmax * MPH;
    for (const p of T.pts) vt = Math.min(vt, p.tp.e.limit * MPH);
    // each target is a speed to be down to at a distance ahead; brake to meet the hardest of them
    const b = def.brake * 0.85, v = this.v, ahead = x => x - this.odo;
    let need = 0;
    const target = (v1, d) => {
      vt = Math.min(vt, Math.sqrt(v1 * v1 + 2 * b * Math.max(0, d)));
      if (v > v1) need = Math.max(need, (v * v - v1 * v1) / (2 * Math.max(d, 0.5)));
    };
    target(0, this.authLeft - 14);
    if (this.block) target(0, this.block.d - 20);
    for (const ev of this.events) {
      const d = ahead(ev.at);
      if (ev.limit !== undefined && d > 0) target(ev.limit, d - 4);
      if (ev.stop && !ev.done) { if (d > -3) target(0, d); else ev.done = true; }   // overrun: carry on
      if (d > 2500) break;
    }
    if (this.dwell > 0) { vt = 0; this.dwell -= dt; if (this.dwell <= 0) this.toot([0.5, 0.35, 0.5]); }
    // throttle and brake
    let a;
    if (this.block && this.block.d < stopD + 15 && v > 0.5) { a = -1.6; if (!this.emg) { this.emg = true; this.toot([1.4, 0.3, 1.4, 0.3, 1.4]); } }
    else {
      this.emg = false;
      a = clamp((vt - v) * 0.5, -def.brake, def.accel * Math.min(1, 9 / (v + 4)));
      if (need > b * 0.5) a = Math.min(a, -Math.min(need, def.brake * 1.3));
    }
    let nv = Math.max(0, v + a * dt);
    if (vt < 0.05 && nv < 0.15) nv = 0;
    this.accel = (nv - v) / Math.max(dt, 1e-3);
    this.v = nv;
    // station stops
    for (const ev of this.events) if (ev.stop && !ev.done && ahead(ev.at) < 2 && this.v < 0.05) { ev.done = true; this.dwell = DWELL; this.st.bl = true; }
    // horn for road crossings, ringing the bell through towns
    for (const ev of this.events) if (ev.horn && !ev.done && ahead(ev.at) < 0) { ev.done = true; if (this.v > 3) this.toot([2.2, 0.35, 2.2, 0.35, 0.8, 0.35, 2.6]); }
    if (this.st.bl && this.v > 13) this.st.bl = false;
    if (this.dwell > 0 && this.dwell < 8) this.st.bl = true;
    this.horning(dt);
    // move
    const d = this.v * dt;
    if (d > 0) {
      const lim = CARS.limit(T, d);
      const moved = T.move(lim.d, {
        onNode: node => { for (const x of this.sws) if (x.sw.node === node) x.passed = true; },
        onRunThrough: () => {},
        onBlocked: () => { this.v = 0; },
      });
      this.odo += moved; this.authLeft -= moved; this.theta -= moved / LG.rD;
      if (lim.hit) CARS.contact(T, 1, lim.hit);
      this.dirty = true;
    }
    this.events = this.events.filter(ev => ahead(ev.at) > -50 || (ev.stop && !ev.done));
    if (this.v < 0.05 && this.dwell <= 0 && this.heldWhy) this.held += dt; else if (this.v > 0.5) this.held = 0;
    this.st.ex = this.accel > 0.02 ? clamp(0.3 + 0.7 * this.accel / def.accel, 0.3, 1) : (this.v > 1 && this.accel > -0.02 ? 0.22 : 0);
    this.st.rpm = 300 + (this.accel > 0.02 ? 750 * clamp(0.5 + 0.5 * this.accel / def.accel, 0, 1) : this.v > 1 && this.accel > -0.02 ? 300 : 0);
    this.release();
  }
  /* give back the track behind us, and the switches once we are clear of them */
  release() {
    const T = this.train, rear = T.endTP('rear');
    let k = this.route.findIndex(p => p.e === rear.e && (rear.s - p.a) * Math.sign(p.b - p.a || 1) >= -0.5 && (p.b - rear.s) * Math.sign(p.b - p.a || 1) >= -0.5);
    if (k < 0 && this.route.length && !this.footprint().some(f => this.route.some(p => p.e === f.e))) k = this.route.length;   // left our route entirely
    if (k > 0) { for (const p of this.route.splice(0, k)) IX.unreserve(p); }
    if (this.route.length && this.route[0].e === rear.e) this.route[0].a = rear.s;
    for (const x of this.sws.slice()) {
      if (!x.passed || swPair(x.sw).some(s => T.fouls(s))) continue;
      IX.drop(this, x.sw);
      this.sws.splice(this.sws.indexOf(x), 1);
      // put back to normal what we reversed, once no one is near it
      if (x.changed && x.sw.state && !IX.lockedBy(x.sw) && !swPair(x.sw).some(s => IX.fouling(s, []).length)) for (const s of swPair(x.sw)) s.state = 0;
    }
    // the signals we hold a route from and have not reached yet
    const f = T.endTP('front'), i = this.route.findIndex(p => p.e === f.e && (f.s - p.a) * Math.sign(p.b - p.a || 1) >= -0.5);
    this.signalsAhead = this.signalsAhead.filter(q => {
      const ql = q.loc, j = this.route.findIndex(p => p.e === ql.edge && (ql.s - p.a) * Math.sign(p.b - p.a || 1) >= -0.5 && (p.b - ql.s) * Math.sign(p.b - p.a || 1) >= -0.5);
      return j >= 0 && (j > i || (j === i && (ql.s - f.s) * f.o > 0));
    });
  }
  /* blow a pattern: lengths in seconds, alternately sounding and silent */
  toot(p) { if (!this.horn.length) { this.horn = p.slice(); this.hornT = 0; } }
  horning(dt) {
    if (!this.horn.length) { this.st.wh = Math.max(0, this.st.wh - dt * 6); return; }
    this.hornT += dt;
    if (this.hornT >= this.horn[0]) { this.hornT = 0; this.horn.shift(); }
    const on = this.horn.length % 2 === 1;
    this.st.wh = clamp(this.st.wh + (on ? 8 : -8) * dt, 0, 1);
  }
  render(dt, cam) {
    const T = this.train;
    const far = T.lead.pos && T.lead.pos.distanceTo(cam) > 2600 + T.length;
    if (far) { if (this.visible) { T.setVisible(false); this.visible = false; } this.updT += dt; if (this.updT < 0.5) return; }
    else if (!this.visible) { T.setVisible(true); this.visible = true; this.dirty = true; }
    this.updT = 0;
    if (this.dirty || !far) { T.update(dt, this.theta, this.st.rv); this.dirty = false; }
    this.fx(dt, this.st, cam);
  }
}
/* position along track 1 of a track position on either main, a siding or a crossover (null elsewhere),
   in the travel sense of dir */
AI.along = function (tp, dir) {
  const e = tp.e, ln = e.line; if (!ln) return null;
  let s;
  if (ln === ROUTE.main) s = e.lineS0 + tp.s;
  else if (ln === ROUTE.main2) s = ROUTE.to1(e.lineS0 + tp.s);
  else {
    if (ln.s1 === undefined) { const n = ln.startNode, a = n && n.att.find(x => x.edge.line === ROUTE.main || x.edge.line === ROUTE.main2); if (!a) return null; const ss = a.edge.lineS0 + (a.end ? a.edge.len : 0); ln.s1 = a.edge.line === ROUTE.main ? ss : ROUTE.to1(ss); }
    s = ln.s1 + e.lineS0 + tp.s;
  }
  return dir > 0 ? s : -s;
};

/* AI train a has gone right past consist T (its rear is ahead of T's front, the way it runs) */
/* AI train a has gone by train T: its rear has passed both ends of T. On a loop "ahead" is ambiguous, so
   memo keeps, for each end of T, how far a's rear has still to run to reach it, and an end counts as passed
   when that distance wraps round from nearly nothing to nearly a whole lap. */
AI.gone = function (a, T, memo) {
  const dir = a.def.dir, L = ROUTE.mainLen, r = AI.along(a.train.endTP('rear'), dir);
  if (r === null) return false;
  let all = true;
  for (const k of ['front', 'rear']) {
    const p = AI.along(T.endTP(k), dir); if (p === null) { all = false; continue; }
    const need = (((p - r) % L) + L) % L, was = memo[k];
    if (was !== undefined && was < 600 && need > L - 600) memo[k + 'By'] = true;
    memo[k] = need;
    if (!memo[k + 'By']) all = false;
  }
  return all;
};

/* ---------------- the traffic on the railroad ---------------- */
AI.enabled = () => !MP.on && !WORLD.custom && GAME.settings.traffic !== 'off';
AI.clear = function () {
  for (const a of AI.trains) a.dispose();
  AI.trains = []; IX.clear();
};
/* make up the trains for free running or for a job, each where its timetable has it */
AI.setup = function () {
  AI.clear();
  if (!AI.enabled()) return;
  const job = JOB.wanted(), list = job ? job.traffic || [] : FREE_TRAFFIC;
  for (const [id, s] of list) AI.spawn(id, s);
};
AI.spawn = function (id, sMain) {
  const def = TRAFFIC[id]; if (!def) return null;
  const a = new AITrain(id, def);
  // the front at sMain, or further back along the road if something is in the way there
  for (let k = 0; k < 8; k++) {
    const sm = sMain - def.dir * k * 450, line = a.line, loc = line.locate(line === ROUTE.main ? sm : ROUTE.to2(sm));
    a.place(new TrackPos(loc.edge, loc.s, def.dir));
    const fp = a.footprint(60), me = a.train;
    const clash = fp.some(p => IX.on(p.e, p.a, p.b, []).some(c => c !== me) || IX.reserved(p.e, p.a, p.b, a)) || NET.switches.some(sw => me.fouls(sw));
    if (clash) continue;
    // running at track speed if the road ahead is clear, standing at the signal if not
    AI.trains.push(a); IX.idx = null;
    if (a.ask()) a.v = Math.min(def.vmax * MPH * 0.8, Math.sqrt(2 * def.brake * 0.5 * Math.max(0, a.authLeft - 200)));
    return a;
  }
  a.dispose();
  return null;
};
AI.tick = function (dt) {
  if (!AI.trains.length) return;
  if (!AI.enabled()) { AI.clear(); return; }   // a multiplayer session or a custom world started under us
  IX.playerTick();
  for (const a of AI.trains) a.tick(dt);
  // a train held up by ours says so, and on a job it costs a little for every minute
  for (const a of AI.trains) {
    if (a.heldWhy !== 'your train' || a.held === 0) { a.told = 0; continue; }
    if (a.held > 25 && !a.told) { a.told = a.held; toast(`${a.name} is held at a red signal waiting on your train.`, 'warn', 4500, 'held' + a.id); }
    if (a.told && a.held - a.told > 60) { a.told = a.held; JOB.note('delay', { name: a.name }); }
  }
};
AI.render = function (dt) {
  const cam = camera.position;
  for (const a of AI.trains) a.render(dt, cam);
};
/* contact between the player's train or a cut of cars and an AI train, or two AI trains: they don't couple */
AI.contact = function (A, dir, hit) {
  const B = hit.c, T = GAME.train, aEnd = dir > 0 ? 'front' : 'rear';
  const vB = hit.end ? velOf(B) * (hit.end === aEnd ? -1 : 1) : 0;
  const closing = dir * (velOf(A) - vB), mph = Math.round(closing / MPH);
  const ai = (A.ai || B.ai), other = A.ai ? B : A;
  if (other === T) {
    if (closing > 2.7) { GAME.derail(`Collided with ${ai.name} at ${mph} mph. Stop at red signals: they are protecting other trains.`, 'Collision'); return; }
    sndClunk(0.8, 0); toast(`Buffered up against ${ai.name}.`, 'warn', 2600, 'aibump');
  } else if (closing > 0.5) sndClunk(clamp(closing / COUPLE_OK, 0.3, 1.2) / (1 + Math.pow(ai.train.lead.pos.distanceTo(camera.position) / 30, 1.3)), 0);
  for (const c of [A, B]) setVel(c, 0);
};
/* which AI train, if any, holds switch sw (locked for its route, or standing over it) */
AI.holding = function (sw) {
  const o = IX.lockedBy(sw);
  if (o && o !== IX.PLAYER) return `${sw.name} is lined and locked for ${o.name}.`;
  const a = AI.trains.find(t => swPair(sw).some(s => t.train.fouls(s)));
  return a ? `${a.name} is on ${sw.name}.` : null;
};
AI.drawMap = function (g, tx, ty, opt) {
  for (const a of AI.trains) {
    const T = a.train; if (!T.lead.pos) continue;
    g.strokeStyle = '#9fd0ff'; g.lineWidth = 4 * opt.w; g.beginPath();
    T.vehicles.forEach((v, i) => { const x = tx(v.pos.x), y = ty(-v.pos.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const q = T.lead.pos, x = tx(q.x), y = ty(-q.z);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 3 * opt.w, 0, TAU); g.fill();
    if (opt.labels) { g.font = `700 ${opt.fs}px "IBM Plex Sans Condensed", sans-serif`; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(a.name, x + 7, y - 7); g.fillStyle = '#9fd0ff'; g.fillText(a.name, x + 7, y - 7); }
  }
};
