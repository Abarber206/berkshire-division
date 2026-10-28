/* ============================================================================
   Placing by hand: setting the train, or single cars, down anywhere on the
   track. A placed car is an ordinary standing cut, so it couples, gets shoved
   and holds switches exactly like the cars spotted in the yard.
   ========================================================================== */
const PLACE = { on: false, ghost: null, ver: 0, grid: null, made: 0 };
/* A coupler set down within PLACE_SNAP of another one facing it slides up and couples. Two car bodies closer
   than PLACE_CLEAR centre to centre would touch (cars are 3.0 to 3.2 m wide, tracks 4.5 m apart); bodies are
   sampled from PLACE_INSET in from each coupler face, so cars coupled end to end do not count as touching.
   AI trains are never coupled to, and a car has to stand AI_GAP clear of one. */
const PLACE_SNAP = 5, PLACE_CLEAR = 3.3, PLACE_INSET = 1.7, PLACE_AI_GAP = 2;
const PLACE_CARS = { box: 'Box', hopper: 'Hopper', tank: 'Tank', gon: 'Gon', caboose: 'Caboose', coach: 'Coach' };

/* every consist a vehicle being placed has to keep clear of */
function placeConsists(skip) {
  const a = [GAME.train, ...CARS.cuts, ...AI.trains.map(t => t.train)];
  if (MP.on && MP.peers) for (const p of MP.peers.values()) if (p.rt && p.rt.placed) a.push(p.rt.train);
  return a.filter(c => c && c !== skip && c.vehicles.length);
}
const tpXYZ = t => { const [X, N] = t.e.xz(t.s); return [X, t.e.elev(t.s), -N]; };
/* points down the middle of a body len long whose front coupler is at F, about a metre apart */
function bodyPts(F, len) {
  const t = F.clone(), out = [], end = len - PLACE_INSET;
  if (end <= PLACE_INSET) { t.advance(-len / 2, null); return [tpXYZ(t)]; }
  t.advance(-PLACE_INSET, null);
  for (let a = PLACE_INSET; ; ) { out.push(tpXYZ(t)); if (a >= end - 1e-6) break; const d = Math.min(1, end - a); t.advance(-d, null); a += d; }
  return out;
}
const PG = 4, pgKey = (x, z) => Math.floor(x / PG) + ',' + Math.floor(z / PG);
/* the bodies of everything else, hashed on a 4 m grid. Nothing moves while placing, so it is kept until a
   placement changes something. */
function placeGrid(skip) {
  const key = CARS.gen + ':' + PLACE.ver + ':' + S.time;
  if (PLACE.grid && PLACE.grid.key === key && PLACE.grid.skip === skip) return PLACE.grid.g;
  const g = new Map();
  for (const c of placeConsists(skip)) for (const p of bodyPts(c.endTP('front'), c.length)) {
    const k = pgKey(p[0], p[2]); let l = g.get(k); if (!l) g.set(k, l = []); l.push({ p, c });
  }
  PLACE.grid = { key, skip, g };
  return g;
}
/* the first consist whose body comes within PLACE_CLEAR of any of the points */
function bodyClash(pts, g) {
  const r2 = PLACE_CLEAR * PLACE_CLEAR;
  for (const p of pts) {
    const cx = Math.floor(p[0] / PG), cz = Math.floor(p[2] / PG);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = g.get((cx + i) + ',' + (cz + j)); if (!l) continue;
      for (const q of l) { const dx = q.p[0] - p[0], dy = q.p[1] - p[1], dz = q.p[2] - p[2]; if (dx * dx + dy * dy + dz * dz < r2) return q.c; }
    }
  }
  return null;
}
/* slide a front position forward until len metres of track lie behind it; the rear position, or null */
function onRails(F, len) {
  let R = F.clone();
  const short = R.advance(-len, null);
  if (!short) return R;
  if (F.advance(-short, null)) return null;
  R = F.clone();
  return R.advance(-len, null) ? null : R;
}
const sameTP = (a, b) => a.e === b.e && Math.abs(a.s - b.s) < 0.05;

/* Where consist C would stand with its front coupler at (or slid along from) `front`. Snaps to a facing
   coupler within PLACE_SNAP, then checks the track is there and nothing is in the way. Leaves C standing
   there either way, so the player sees what was tried. via lists switches ({ sw, li }) the way to `front`
   came through from a leg they are not lined for: the car is laid along that leg as if they were. Returns
   { ok, why ('short', 'clash' or 'points'), F, R, joins: [{ end, c, cEnd }], hit, fouls: [switch], line: [{ sw, li }] }. */
PLACE.fit = function (C, front, skip = C, via = []) {
  const was = via.map(l => l.sw.state);
  via.forEach(l => { l.sw.state = l.li; });
  try { return placeFit(C, front, skip, via); } finally { via.forEach((l, i) => { l.sw.state = was[i]; }); }
};
/* switches passed trailing from a leg they are not lined for, walking from tp by d */
PLACE.against = function (tp, d) {
  const out = [];
  tp.clone().advance(d, { onNode: (node, from) => { const sw = node.sw; if (!sw) return; const li = sw.legs.findIndex(l => l.edge === from); if (li >= 0 && li !== sw.state && !out.some(l => l.sw === sw)) out.push({ sw, li }); } });
  return out;
};
function placeFit(C, front, skip, via) {
  const len = C.length, out = { ok: false, why: '', F: null, R: null, joins: [], hit: null, fouls: [] };
  let F = front.clone(), R = onRails(F, len);
  if (!R) { out.why = 'short'; return out; }
  const idx = carIndex();
  // the nearest thing ahead of the rear coupler and behind the front one; gap < 0 means it overlaps
  const look = (from, dir) => { const t = from.clone(); t.advance(dir * 0.05, null); const h = carFrom(t, dir, len + PLACE_SNAP, idx, skip); return h && Object.assign(h, { gap: h.d + 0.05 - len }); };
  const snaps = h => h && h.end && h.facing && !h.c.ai && Math.abs(h.gap) < PLACE_SNAP;
  const a = look(R, 1), b = look(F, -1);
  const shift = snaps(a) && (!snaps(b) || Math.abs(a.gap) <= Math.abs(b.gap)) ? a.gap : snaps(b) ? -b.gap : 0;
  if (shift) {
    const F2 = F.clone(), R2 = F2.advance(shift, null) ? null : F2.clone();
    if (R2 && !R2.advance(-len, null)) { F = F2; R = R2; }
  }
  out.F = F; out.R = R;
  C.place(F);
  if (typeof NET !== 'undefined') out.fouls = NET.switches.filter(sw => C.fouls(sw));
  // anything between the couplers, along the track or alongside it
  const t = R.clone(); t.advance(0.05, null);
  const inside = carFrom(t, 1, len - 0.1, idx, skip);
  const hit = inside ? inside.c : bodyClash(bodyPts(F, len), placeGrid(skip));
  if (hit) { out.hit = hit; out.why = 'clash'; return out; }
  for (const h of [look(R, 1), look(F, -1)]) if (h && h.c.ai && h.gap < PLACE_AI_GAP) { out.hit = h.c; out.why = 'clash'; return out; }
  // a switch under the car lined for the other track: out.line says which leg each one needs
  out.line = [...via, ...PLACE.against(F, -len).filter(l => !via.some(k => k.sw === l.sw))];
  const fwd = R.clone(); fwd.advance(len, null);
  if (out.line.length || !sameTP(fwd, F)) { out.why = 'points'; return out; }
  // couplers that now meet another
  const touch = (from, dir, end) => { const h = carFrom(from, dir, 0.06, idx, skip); if (h && h.end && h.facing && !h.c.ai) out.joins.push({ end, c: h.c, cEnd: h.end }); };
  touch(F, 1, 'front'); touch(R, -1, 'rear');
  out.ok = true;
  return out;
}

/* Set C down where fit says, coupling it to whatever it touches. A new or lifted cut of cars stands with its
   handbrakes tied and the knuckles at its ends open. Returns the consist C ends up in. */
PLACE.commit = function (C, fit) {
  if (!fit.ok) return null;
  const T = GAME.train;
  C.place(fit.F);
  if (C === T) { S.v = 0; S.vw = 0; }
  else {
    C.v = 0; C.rolling = false; C.stopT = 0;
    for (const v of C.vehicles) v.hb = true;
    if (!CARS.cuts.includes(C)) CARS.cuts.push(C);
    for (const end of ['front', 'rear']) setKn(endCoupler(C, end), KN_OPEN);
  }
  const ends = { front: endCoupler(C, 'front'), rear: endCoupler(C, 'rear') };
  for (const j of fit.joins) {
    if (j.c !== T && !CARS.cuts.includes(j.c)) continue;
    const g = ends[j.end], cur = [T, ...CARS.cuts].find(c => c && c.vehicles.includes(g.v));
    const curEnd = cur && ['front', 'rear'].find(e => { const x = endCoupler(cur, e); return x.v === g.v && x.k === g.k; });
    if (!curEnd || cur === j.c) continue;
    if (j.c === T) absorb(T, j.cEnd, cur, curEnd); else absorb(cur, curEnd, j.c, j.cEnd);
  }
  if (fit.joins.length && (C === T || fit.joins.some(j => j.c === T))) { S.v = 0; S.vw = 0; }
  PLACE.changed();
  return [T, ...CARS.cuts].find(c => c && c.vehicles.includes(ends.front.v));
};
PLACE.changed = function () {
  PLACE.ver++; CARS.gen++;
  if (typeof IX !== 'undefined') IX.idx = null;
  if (CARS.onChange) CARS.onChange();
};

/* Take vehicle v out of consist c as a cut of its own, which is not on the railroad until it is set down
   again. The rest of c stays where it stands: the part with the engine stays the player's train, and the
   cars on the far side of v become a cut. The knuckles either side of the gap are left open. */
PLACE.split = function (c, v) {
  if (!CARS.geo) CARS.geo = { tg: truckGeos(), a6: plainAxle(0.457), a4: plainAxle(0.419) };
  const V = c.vehicles, i = V.indexOf(v), T = GAME.train;
  if (i < 0) return null;
  if (c !== T && V.length === 1) { CARS.cuts = CARS.cuts.filter(x => x !== c); PLACE.changed(); return c; }
  const ahead = V.slice(0, i), behind = V.slice(i + 1);
  const keepAhead = c === T ? ahead.some(isPower) : ahead.length > 0;
  const keep = keepAhead ? ahead : behind, rest = keepAhead ? behind : ahead;
  for (const u of [v, ...rest]) c.release(u);
  c.vehicles = keep; c.layout(); c.buildInstances();
  for (const im of c.inst) linearizeObject(im);
  if (keep.length) setKn(endCoupler(c, keepAhead ? 'rear' : 'front'), KN_OPEN);
  if (rest.length) {
    const n = new Cut(c.scene, rest);
    n.home = c.home; n.vented = c !== T && c.vented;
    for (const u of rest) u.hb = true;
    setKn(endCoupler(n, keepAhead ? 'front' : 'rear'), KN_OPEN);
    CARS.cuts.push(n); n.update(0);
  }
  if (c === T) c.update(0, S.theta, S.reverser); else c.update(0);
  const g = new Cut(c.scene, [v]);
  g.home = c.home; v.hb = true;
  g.update(0);
  PLACE.changed();
  return g;
};
/* the front coupler of the span vehicle v stands on within its consist c */
PLACE.frontOf = function (c, v) { const t = c.endTP('front'); t.advance(-v.a0, null); return t; };
/* turned end for end over the same stretch of track */
PLACE.turned = function (C) { const t = C.endTP('rear'); t.o = -t.o; return t; };
/* the name of the track a position is on, for messages */
PLACE.lineOf = function (tp) {
  if (typeof ROUTE === 'undefined') return '';
  for (const k in ROUTE.lines) if (ROUTE.lines[k].edges.includes(tp.e)) return k;
  return '';
};
