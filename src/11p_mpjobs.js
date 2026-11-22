/* ============================================================================
   Jobs in a multiplayer room. Each player works their own job; a job is taken
   by one player at a time. Everyone in the room sees who is on which job, how
   far they have got and what it scored, and a running tally of the session's
   pay. On Laurel Mountain a second player can bring their engine up behind the
   mine run and push it for real: the pusher's tractive effort goes over the
   relay to the train in front (S.pushF in 08_physics.js).
   ========================================================================== */
const MPJ = { sig: '', earn: 0, n: 0 };
const MPJ_PUSH_MAX = 900e3;     // N: about two big engines' worth, in case of a bad number
const MPJ_PUSH_NEAR = 3;        // m between couplers that still counts as pushing (updates come a few times a second)
const MPJ_PUSH_FRESH = 1200;    // ms a pusher's report holds good
const _mpjA = new THREE.Vector3(), _mpjB = new THREE.Vector3();

/* what we tell the room about our job: [id, step, score, over (1 done, 2 failed), claimed at, clock s, lead, paid] */
MPJ.out = function () {
  const R = JOB.run; if (!R) return null;
  return [R.def.id, R.i, JOB.total(R).total, R.over ? (R.failed ? 2 : 1) : 0, R.claim || 0, Math.round(JOB.clock()), R.lead || '', R.paid || 0];
};
/* another player's job report, checked */
MPJ.clean = function (r) {
  if (!Array.isArray(r) || r.length !== 8 || typeof r[0] !== 'string' || !/^[a-z0-9]{1,16}$/.test(r[0])) return null;
  const n = (x, lo, hi) => (typeof x === 'number' && isFinite(x)) ? Math.round(clamp(x, lo, hi)) : lo;
  return [r[0], n(r[1], 0, 50), n(r[2], 0, 100), n(r[3], 0, 2), n(r[4], 0, 1e13), n(r[5], 0, 2e5), typeof r[6] === 'string' && /^[a-z0-9]{6,16}$/.test(r[6]) ? r[6] : '', n(r[7], 0, 1e6)];
};
/* a pusher's report: [whose train, which of their trains, newtons] */
MPJ.cleanPush = function (r) {
  if (!Array.isArray(r) || r.length !== 3 || typeof r[0] !== 'string' || !/^[a-z0-9]{6,16}$/.test(r[0])) return null;
  const f = typeof r[1] === 'number' && isFinite(r[1]) ? Math.round(clamp(r[1], 0, 1e6)) : 0;
  const N = typeof r[2] === 'number' && isFinite(r[2]) ? clamp(r[2], 0, MPJ_PUSH_MAX) : 0;
  return N > 0 ? [r[0], f, N] : null;
};
/* the session's pay and jobs done: [dollars, jobs] */
MPJ.cleanTally = function (r) {
  if (!Array.isArray(r) || r.length !== 2) return null;
  const n = (x, hi) => (typeof x === 'number' && isFinite(x)) ? Math.round(clamp(x, 0, hi)) : 0;
  return [n(r[0], 1e8), n(r[1], 1e4)];
};

const mpjDef = id => JOBS.find(j => j.id === id) || null;
const mpjLive = jb => jb && jb[3] === 0;
/* the player in the room working job id (and, for a pusher, for the same train); null if nobody */
MPJ.takenBy = function (id, lead) {
  if (!MP.on) return null;
  for (const p of MP.peers.values()) { const jb = p.st.jb; if (mpjLive(jb) && jb[0] === id && (!lead || jb[6] === lead)) return p; }
  return null;
};
/* the player whose mine run is waiting at the foot of the hill for a pusher, and not already getting one */
MPJ.assistTarget = function () {
  if (!MP.on) return null;
  for (const p of MP.peers.values()) {
    const jb = p.st.jb; if (!mpjLive(jb) || jb[0] !== 'pusher' || jb[1] !== 0) continue;
    if (!p.rt || !p.rt.placed || p.st.dr) continue;
    if (MPJ.takenBy('assist', p.id)) continue;
    return p;
  }
  return null;
};
/* why a job cannot be started here and now ('' when it can) */
MPJ.ready = function (def) {
  if (!MP.on) return '';
  if (def.assist) { const p = MPJ.assistTarget(); return p ? '' : 'Nobody in the room has a mine run waiting for a pusher. When someone takes the mine run, this job opens.'; }
  const p = MPJ.takenBy(def.id);
  if (p) return `${p.st.nm} is working this job. Pick another, or wait until they are done.`;
  return '';
};
/* the cars a job picks up still stand where it expects them, and a way freight's still carry their waybills */
JOB.ready = function (def) {
  const why = MPJ.ready(def); if (why) return why;
  for (const st of def.steps) if (st.type === 'pickup') {
    const cuts = CARS.cuts.filter(c => c.home === st.from && !c.parkS);
    if (!cuts.length || cuts.some(c => c.pts.some(p => !p.tp.e.line || p.tp.e.line.name !== st.from)))
      return `The cars for this job are not on ${st.from} any more: someone has moved them.`;
    if (def.steps.some(s => s.type === 'bills') && !cuts.some(c => c.vehicles.some(v => v.wb)))
      return 'The cars on Yard 3 have lost their waybills in this room. Run the way freight in single player.';
  }
  return '';
};
/* the job's name on the board: a pusher job names whose train it pushes */
MPJ.title = function (def) {
  if (!def.assist) return def.name;
  const p = MPJ.assistTarget();
  return p ? `Push ${p.st.nm}'s mine run` : def.name;
};
/* a short line for where someone has got to on a job */
MPJ.stepText = function (def, i) {
  const st = def && def.steps[i]; if (!st) return '';
  if (st.type === 'depart') return `Depart ${st.at}`;
  if (st.type === 'stop') return `Stop at ${st.at}`;
  if (st.type === 'pass') return `Pass ${st.at}`;
  return st.text || '';
};
MPJ.status = function (st) {
  const jb = st.jb, d = jb && mpjDef(jb[0]); if (!d) return '';
  const nm = d.assist ? 'Pusher' : d.name;
  if (jb[3] === 1) return `${nm}: done, ${jb[2]} points`;
  if (jb[3] === 2) return `${nm}: over`;
  return `${nm} · ${MPJ.stepText(d, jb[1])} · ${jb[2]} pts`;
};

/* starting a job in a room */
MPJ.begin = function (R) {
  R.claim = Date.now();
  if (!MP.on) return;
  if (R.def.assist) {
    const p = MPJ.assistTarget();
    if (p) { R.lead = p.id; R.leadName = p.st.nm; R.def = Object.assign({}, R.def, { start: p.st.jb[5], name: `Pusher for ${p.st.nm}` }); }
  }
  MP.addLog(MP.name, MP.color, `took ${R.def.assist ? 'the pusher job' : R.def.name}`);
  MP.dirty = true;
};
/* a job of ours finished or came to grief: the session's tally, and a line in the room's log */
MPJ.over = function (R) {
  if (!MP.on) return;
  if (!R.failed) { MPJ.earn += R.paid || 0; MPJ.n++; }
  MP.addLog(MP.name, MP.color, R.failed ? `${R.def.name}: ${R.failed.title.toLowerCase()}` : `finished ${R.def.name}: ${JOB.total(R).total} points${R.paid ? `, $${R.paid.toLocaleString()}` : ''}`);
  MP.dirty = true;
};

/* someone's report came in: say what changed, and sort out two players on one job */
MPJ.receive = function (p, prev, st) {
  const a = prev && prev.jb, b = st.jb;
  if (b && (!a || a[0] !== b[0] || a[4] !== b[4])) {
    const d = mpjDef(b[0]);
    if (d && b[3] === 0 && a !== undefined) {
      const what = d.assist ? (b[6] === MP.id ? 'is coming to push your train' : 'is pushing the mine run') : `took ${d.name}`;
      MP.addLog(st.nm, p.color, what);
      if (b[6] === MP.id) toast(`${st.nm} is bringing an engine up behind your caboose to push.`, 'good', 5200, 'mpjAssist');
    }
  } else if (a && b && a[0] === b[0] && a[3] === 0 && b[3] !== 0) {
    const d = mpjDef(b[0]), nm = d ? (d.assist ? 'the pusher job' : d.name) : 'their job';
    const line = b[3] === 1 ? `finished ${nm}: ${b[2]} points${b[7] ? `, $${b[7].toLocaleString()}` : ''}` : `${nm} is over`;
    MP.addLog(st.nm, p.color, line);
    toast(`${st.nm} ${line}.`, b[3] === 1 ? 'good' : 'warn', 4200, 'mpjDone' + p.id);
  }
  const R = JOB.run;
  if (!R || R.over || !mpjLive(b)) return;
  // the same job twice: whoever took it first keeps it
  if (b[0] === R.def.id && (!R.def.assist || b[6] === R.lead)) {
    if (b[4] < R.claim || (b[4] === R.claim && p.id < MP.id)) {
      toast(`${st.nm} took ${R.def.assist ? 'that pusher job' : R.def.name} first. You are free running.`, 'warn', 5200, 'mpjClash');
      JOB.toFree();
      return;
    }
  }
  // someone is coming to push our mine run: our own pusher goes back to the shed
  if (b[0] === 'assist' && b[6] === MP.id && R.def.helper && R.steps[R.i] && R.steps[R.i].type === 'helper' && !R.roomPusher) {
    R.roomPusher = p.id;
    const H = CARS.cuts.find(c => c.parkS && c.pusher);
    if (H) {
      if (H.crew && typeof IX !== 'undefined') { IX.release(H.crew.ix); H.crew = null; }
      CARS.cuts = CARS.cuts.filter(c => c !== H); H.disposeDeep();
      CARS.gen++; if (typeof IX !== 'undefined') IX.idx = null;
      if (typeof FLEET !== 'undefined' && FLEET.ui) FLEET.ui(true);
      if (typeof MAP !== 'undefined' && MAP.visible) MAP.draw();
    }
  }
};
/* the job board needs drawing again when someone takes or finishes a job */
MPJ.tick = function () {
  let s = '';
  if (MP.on) for (const p of MP.peers.values()) { const jb = p.st.jb; if (jb) s += p.id + jb[0] + jb[1] + jb[3] + jb[6] + '|'; }
  if (s !== MPJ.sig) { MPJ.sig = s; if (!$('menu').hidden) jobMenu(); }
};
MPJ.leave = function () { MPJ.sig = ''; S.pushF = 0; if (JOB.run && JOB.run.def.assist && !JOB.run.over) { JOB.toFree(); toast('Out of the room, the pusher job is over. Free running.', 'warn', 4000); } };

/* ---------------- pushing someone else's train ---------------- */
/* nearest end of a remote train to point q, metres */
function mpjEndDist(rt, q) { return rt.polyN ? Math.min(q.distanceTo(rt.poly[0]), q.distanceTo(rt.poly[rt.polyN - 1])) : Infinity; }
/* Our engine against the end of another player's train and working to shove it: tell them how hard. What is
   left of our own effort after our train's grade, rolling resistance and brakes (S.Fnet) goes into theirs. */
MPJ.pushOut = function (T) {
  MP.push = null;
  if (!T || S.derailed || !(S.Fnet > 0 || S.Fnet < 0)) return;
  mpEnds(T, _mpjA, _mpjB);
  let best = null;
  for (const { p, h, rt } of MP.trains()) {
    if (!rt.placed || !rt.polyN || p.st.dr) continue;
    for (const [end, sg] of [[_mpjA, 1], [_mpjB, -1]]) {
      const N = sg * S.Fnet;
      if (N <= 0 || mpjEndDist(rt, end) > MPJ_PUSH_NEAR) continue;
      if (!best || N > best[2]) best = [p.id, h.f || 0, Math.round(Math.min(N, MPJ_PUSH_MAX))];
    }
  }
  MP.push = best;
};
/* another player pushing ours: their effort, applied at whichever of our ends they are against */
MPJ.pushIn = function (T) {
  let F = 0, from = 0;
  const now = performance.now();
  if (T && MP.on) {
    mpEnds(T, _mpjA, _mpjB);
    for (const p of MP.peers.values()) {
      const ps = p.st.ps;
      if (!ps || ps[0] !== MP.id || ps[1] !== (T.fid || 0) || now - p.at > MPJ_PUSH_FRESH || !p.trains) continue;
      for (const h of p.trains.values()) {
        if (!h.rt || !h.rt.placed) continue;
        const dF = mpjEndDist(h.rt, _mpjA), dR = mpjEndDist(h.rt, _mpjB);
        if (Math.min(dF, dR) > MPJ_PUSH_NEAR + 1) continue;
        const sg = dR < dF ? 1 : -1;   // against our rear: shoved ahead; against our front: shoved back
        F += sg * ps[2]; from = p.id;
        break;
      }
    }
  }
  S.pushF = clamp(F, -MPJ_PUSH_MAX, MPJ_PUSH_MAX); S.pushBy = from;
};
/* the room player whose engine stands against our rear coupler, pushing or ready to (null if none) */
MPJ.behind = function (T) {
  if (!MP.on || !T) return null;
  if (S.pushF > 0 && S.pushBy) return MP.peers.get(S.pushBy) || null;
  for (const { p, h } of MP.trains()) if (h.touch && h.touch[1] && h.touch[1].kind === 'end') return p;
  return null;
};

/* ---------------- the pusher's own job ---------------- */
/* steps for the player doing the pushing: buff up, shove to Summit, drop back. Returns true if st was one. */
MPJ.step = function (R, T, st, now, done) {
  if (st.type !== 'buff' && st.type !== 'shove' && st.type !== 'drop') return false;
  const lead = MP.peers.get(R.lead), lj = lead && lead.st.jb;
  if (!lead) { JOB.fail('Left on your own', `${R.leadName || 'The other engineer'} has left the room.`); return true; }
  if (!lj || lj[0] !== 'pusher' || lj[4] === 0) { JOB.fail('The mine run was called off', `${lead.st.nm} has given up the job.`); return true; }
  if (lj[3] === 2) { JOB.fail('The mine run came to grief', `${lead.st.nm}'s train is off the rails.`); return true; }
  const h = lead.trains && lead.trains.get(lead.st.f);
  const touching = !!(h && h.touch && h.touch.some(t => t && t.kind === 'end')) || (MP.push && MP.push[0] === lead.id);
  const leadMoving = Math.abs(lead.st.v || 0) > 0.45, cut = mpjDef('pusher').steps.findIndex(s => s.type === 'cutoff');
  if (st.type === 'buff') {
    st.why = touching ? '' : h && h.rt && h.rt.placed ? `${fmtMi(cabPos(T).distanceTo(h.rt.train.pts[h.rt.train.pts.length - 1].F.p))} to the caboose` : '';
    if (touching && R.lastStop > 0.5) { toast(`Buffed up behind ${lead.st.nm}'s caboose. Open up when they do, and keep shoving to Summit.`, 'good', 5200, 'mpjBuff'); st.doneT = now; done(); }
    return true;
  }
  if (st.type === 'shove') {
    const ep = R.ep;
    if (leadMoving) { ep.climb = (ep.climb || 0) + 0.1; if (touching) ep.pushed = (ep.pushed || 0) + 0.1; }
    st.why = touching ? '' : leadMoving ? `Catch up: you have dropped off ${lead.st.nm}'s train` : '';
    if (lj[1] >= cut || lj[3] === 1) {
      const frac = ep.climb > 30 ? (ep.pushed || 0) / ep.climb : 1;
      if (frac < 0.8) JOB.dock('time', Math.min(40, Math.round((0.8 - frac) * 60)), 'Dropped off the train', `pushed for ${Math.round(frac * 100)} per cent of the climb`);
      toast(`Summit. Stop, and drop back clear of ${lead.st.nm}'s caboose.`, 'good', 5200, 'mpjTop');
      st.doneT = now; done();
    }
    return true;
  }
  // drop back: stopped, off their caboose
  st.why = touching ? 'Ease back off the caboose' : R.lastStop < 1.5 ? 'Bring your engine to a stand' : '';
  if (!touching && R.lastStop >= 1.5) { st.doneT = now; done(); }
  return true;
};

/* ---------------- making up a job's train in a room ---------------- */
/* what is standing on the len metres of track behind front ('' when clear); skip: a player whose trains don't count */
MPJ.blocking = function (front, len, skip) {
  const rts = MP.trains().filter(x => x.p.id !== skip && x.rt.placed && x.rt.polyN);
  const tp = front.clone(), F = newFrame();
  for (let d = 0; d <= len; d += 2) {
    if (d) tp.advance(-2, null);
    tp.pose(F);
    for (const { p, rt } of rts) for (let i = 0; i < rt.polyN - 1; i++) if (mpSegDist(F.p, rt.poly[i], rt.poly[i + 1]) < 1.6) return `${p.st.nm}'s train`;
    for (const c of CARS.cuts) for (let i = 0; i < c.pts.length - 1; i++) if (mpSegDist(F.p, c.pts[i].F.p, c.pts[i + 1].F.p) < 1.6) return 'A cut of cars';
  }
  return '';
};
/* line the switches a job's train needs out of where it is made up, unless someone's train is over them */
MPJ.line = function (names) {
  for (const n of names || []) {
    const sw = NET.switches.find(s => s.name === n);
    if (!sw || sw.state === 1 || MP.occupant(sw) || CARS.occupied(sw)) continue;
    sw.state = 1; MP.noteThrow(sw);
  }
};
/* a pusher's engine: the same way round as the mine run, 20 m short of its caboose */
MPJ.assistAt = function (t) {
  const p = MPJ.assistTarget(); if (!p) return null;
  const T = p.rt.train, tp = T.pts[0].tp.clone();
  if (tp.advance(-(T.length + 20), null) !== 0) return null;
  return MPJ.blocking(tp, t.length + 4, p.id) ? null : tp;   // their own pusher goes when they hear we are coming
};
