/* ============================================================================
   Jobs: timetabled passenger runs, a time freight and switching work, run
   against the railroad clock and scored for time, train handling and rules
   ========================================================================== */
const hm = (h, m) => h * 3600 + m * 60;
const JOB_CATS = [['time', 'On time', 40], ['handling', 'Train handling', 30], ['rules', 'Rules', 30]];
const PLATFORM = 120;          // metres either side of the station mark that count as the platform
const FOUL = 38;               // cars closer than this to a switch are foul of it (same as the switch lockout)

/* Where a job's train is made up. s < 0 counts back from the end of the line. */
const JOB_SPAWNS = {
  yardEast: { line: 'Yard 2', s: -175, o: 1, lined: ['Yard ladder E2', 'Bellevue East'], name: 'Yard 2, Bellevue' },
  yardWest: { line: 'Yard 2', s: 175, o: -1, lined: ['Yard ladder W2', 'Bellevue West'], name: 'Yard 2, Bellevue' },
  depot: { line: 'Main', s: 1120, o: 1, lined: [], cabAt: 'Bellevue', name: 'the Bellevue depot' },
};

const JOBS = [
  { id: 'elevator', name: 'Elevator pickup', kind: 'switch', level: 'Easy', look: 'morning', train: 'light', spawn: 'yardEast', start: hm(6, 50), due: hm(7, 20),
    brief: 'The elevator at Fostoria has loaded four boxcars of grain overnight. Run light to the elevator track, couple to the loads and set them out on Yard 1 at Bellevue for the evening manifest.',
    steps: [
      { type: 'pickup', from: 'Elevator Track', text: 'Couple to the four loads on the Elevator Track', hint: 'East on the main, into the Fostoria siding at Fostoria West, then the Elevator switch. Couple at 4 mph or less.' },
      { type: 'spot', to: 'Yard 1', tag: 'Y1', text: 'Set the loads out on Yard 1, clear of the switches', hint: 'Back west on the main and in at Bellevue East. Stop, cut the cars off, and leave them at least 125 ft from every switch.' },
    ] },
  { id: 'no3', name: 'No. 3, Kenton local', kind: 'passenger', level: 'Easy', look: 'morning', train: 'passenger', spawn: 'depot', start: hm(7, 39),
    brief: 'The morning local. Eight heavyweights out of Bellevue, a stop at Fostoria, and over Kenton Hill to Kenton. Keep the ride smooth, leave no station early and put the engine on the mark.',
    steps: [
      { type: 'depart', at: 'Bellevue', dep: hm(7, 40) },
      { type: 'stop', at: 'Fostoria', arr: hm(7, 45), dep: hm(7, 46) },
      { type: 'stop', at: 'Kenton', arr: hm(7, 55) },
    ] },
  { id: 'bd2', name: 'BD-2 time freight', kind: 'freight', level: 'Medium', look: 'golden', train: 'timefreight', spawn: 'yardEast', start: hm(17, 30), vmax: 50,
    brief: 'Eighteen cars and a caboose of hot merchandise around the division. Make every timing point, hold it to 50 mph, the timetable speed for freight, and bring it home to stop in the clear on the main at Bellevue.',
    steps: [
      { type: 'pass', at: 'Fostoria', by: hm(17, 38) },
      { type: 'pass', at: 'Kenton', by: hm(17, 46) },
      { type: 'pass', at: 'Delphos', by: hm(17, 51) },
      { type: 'clear', between: ['Bellevue West', 'Bellevue East'], where: 'Bellevue', by: hm(17, 58), text: 'Stop in the clear on the main at Bellevue', hint: 'The whole train between Bellevue West and Bellevue East, at least 125 ft from both switches.' },
    ] },
  { id: 'no7', name: 'No. 7, around the division', kind: 'passenger', level: 'Medium', look: 'noon', train: 'passenger', spawn: 'depot', start: hm(12, 9),
    brief: 'The midday train makes every stop on the division: Fostoria, Kenton over the hill, Delphos past the river bridge, and home to Bellevue. Four stops, four chances to be early, late or off the mark.',
    steps: [
      { type: 'depart', at: 'Bellevue', dep: hm(12, 10) },
      { type: 'stop', at: 'Fostoria', arr: hm(12, 15), dep: hm(12, 16) },
      { type: 'stop', at: 'Kenton', arr: hm(12, 25), dep: hm(12, 26) },
      { type: 'stop', at: 'Delphos', arr: hm(12, 33), dep: hm(12, 34) },
      { type: 'stop', at: 'Bellevue', arr: hm(12, 41) },
    ] },
  { id: 'quarry', name: 'Night quarry turn', kind: 'switch', level: 'Hard', look: 'night', train: 'light', spawn: 'yardWest', start: hm(21, 30), due: hm(22, 20),
    brief: 'Five loads of stone are waiting in quarry storage. Run light out the west end past Delphos, back up the branch at Quarry Jct, pull the loads and bring them home the long way around the division to Yard 2. In the dark.',
    steps: [
      { type: 'pickup', from: 'Quarry Storage', text: 'Couple to the five loads on Quarry Storage', hint: 'West out of the yard past Delphos. The branch faces the other way at Quarry Jct: run past it, throw it, and back up the branch. Storage is off the runaround.' },
      { type: 'spot', to: 'Yard 2', tag: 'Y2', text: 'Set the loads out on Yard 2, clear of the switches', hint: 'Pull off the branch and keep going east over the river, through Kenton and around the east curve, then back west past Fostoria. In at Bellevue East and up the ladder to Yard 2.' },
    ] },
];

const JOB = { run: null, best: {}, hz: 0 };
function fmtClock(t, ap) { t = ((t % 86400) + 86400) % 86400; const H = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, h = H % 12 || 12; return `${h}:${String(m).padStart(2, '0')}${ap ? (H < 12 ? ' AM' : ' PM') : ''}`; }
function fmtClockS(t) { return fmtClock(t) + ':' + String(Math.floor(((t % 60) + 60) % 60)).padStart(2, '0'); }
function fmtDur(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; }
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const starsFor = score => score >= 90 ? 3 : score >= 75 ? 2 : score >= 55 ? 1 : 0;
const stationNamed = n => ROUTE.stations.find(s => s.name === n);

JOB.load = function () { try { JOB.best = JSON.parse(localStorage.getItem('bd_jobs') || '{}') || {}; } catch (e) { JOB.best = {}; } };
JOB.save = function () { try { localStorage.setItem('bd_jobs', JSON.stringify(JOB.best)); } catch (e) {} };
/* jobs are written for the built-in railroad, single player */
JOB.available = () => !MP.on && !PLAY_LAYOUT;
JOB.def = id => JOBS.find(j => j.id === id) || null;
JOB.wanted = () => JOB.available() ? JOB.def(GAME.settings.job) : null;
JOB.activeId = () => JOB.run && !JOB.run.over ? JOB.run.def.id : '';
JOB.consist = () => { const j = JOB.wanted(); return j ? j.train : GAME.settings.consist; };
/* a job can hold the train below the track speed (freight timetable speed) */
JOB.vmax = () => JOB.run && !JOB.run.over && JOB.run.def.vmax || 99;
JOB.clock = () => JOB.run ? JOB.run.def.start + (S.time - JOB.run.t0) : 0;
/* the step's own deadline, or the job's */
const stepDue = (R, st) => st.arr || st.by || st.dep || R.def.due || null;

/* ---------------- making up the train for a job ---------------- */
JOB.spawn = function (def) {
  const sp = JOB_SPAWNS[def.spawn], line = ROUTE.lines[sp.line];
  return { line, s: sp.s < 0 ? line.len + sp.s : sp.s, o: sp.o, lined: sp.lined, name: sp.name, cabAt: sp.cabAt };
};
/* slide the train so its cab stands on a station's mark */
JOB.alignCab = function (t, name) {
  const st = stationNamed(name); if (!st) return;
  t.update(0); t.loco.root.updateMatrixWorld(true);
  const cab = t.worldOf(new THREE.Vector3(t.loco.cabEye.x, 0, 0));
  const along = _v1.subVectors(cab, st.p).dot(t.lead.fwd);
  const tp = t.frontTP().clone(); tp.advance(t.pts[0].a - along, null);
  t.place(tp);
};

/* ---------------- running a job ---------------- */
JOB.begin = function (def) {
  JOB.closeUI();
  const R = JOB.run = { def, t0: S.time, steps: def.steps.map(s => ({ ...s, state: 'todo' })), i: 0, items: [], over: false, failed: null, cars: [],
    ep: {}, moveAt: null, lastStop: 0, score: 100 };
  GAME.settings.time = def.look; applyLook(def.look, GAME.settings.weather, renderer, scene);
  [...$('optTime').children].forEach(c => c.setAttribute('aria-pressed', String(c.id === 'optTime_' + def.look)));
  // waybill the cars this job moves
  for (const st of R.steps) if (st.type === 'pickup') {
    const dest = R.steps.find(x => x.type === 'spot');
    for (const c of CARS.cuts) if (c.home === st.from) for (const v of c.vehicles) { v.job = { to: dest.to, tag: dest.tag }; R.cars.push(v); }
  }
  carPanelState.key = '';
  JOB.ui();
};
JOB.intro = function () {
  const R = JOB.run, d = R.def, first = R.steps[0];
  setTimeout(() => toast(`${d.name}: on duty at ${fmtClock(d.start, true)}, ${GAME.spawnName}. Tap the job card for the whole sheet.`, '', 6000, 'jobintro'), 600);
  if (first.hint) setTimeout(() => toast(first.hint, '', 8000, 'jobhint'), 11500);
};
/* back to free running: the menu's train choice follows the train you are on, so Resume keeps it */
JOB.toFree = function () {
  JOB.end(); GAME.settings.job = '';
  const t = GAME.train, c = t && CONSISTS[t.consistKey];
  if (c && !c.hidden) { GAME.settings.consist = t.consistKey; [...$('optTrain').children].forEach(b => b.setAttribute('aria-pressed', String(b.id === 'optTrain_' + t.consistKey))); }
  saveSettings(); jobMenu(); startLabel();
};
JOB.end = function () { if (JOB.run) for (const v of JOB.run.cars) delete v.job; JOB.run = null; JOB.closeUI(); JOB.ui(); };
JOB.step = () => JOB.run && !JOB.run.over ? JOB.run.steps[JOB.run.i] : null;

/* A deduction. Items with the same label are grouped on the results card. */
JOB.dock = function (cat, pts, label, detail, quiet) {
  const R = JOB.run; if (!R || R.over || pts <= 0) return;
  R.items.push({ cat, pts, label, detail, t: JOB.clock() });
  R.score = JOB.total(R).total;
  if (pts >= 3 && !quiet) toast(`${label}: −${pts}${detail ? ' · ' + detail : ''}`, 'bad', 3200, 'dock' + label);
};
JOB.total = function (R) {
  const cats = JOB_CATS.map(([k, name, max]) => { const lost = R.items.filter(i => i.cat === k).reduce((a, i) => a + i.pts, 0); return { k, name, max, lost, got: Math.max(0, max - lost) }; });
  return { cats, total: cats.reduce((a, c) => a + c.got, 0) };
};

/* events reported by the simulation */
JOB.note = function (what, d = {}) {
  const R = JOB.run; if (!R || R.over) return;
  const now = S.time, once = (k, gap) => { if (R.ep[k] && now - R.ep[k] < gap) return false; R.ep[k] = now; return true; };
  if (what === 'couple') {
    if (d.mph > COUPLE_HARD / MPH) JOB.dock('handling', 6, 'Hard coupling', `${Math.round(d.mph)} mph`, true);
    else if (d.mph > COUPLE_OK / MPH) JOB.dock('handling', 3, 'Firm coupling', `${Math.round(d.mph)} mph`, true);
  } else if (what === 'bumper' && once('bump', 4)) JOB.dock('handling', 3, 'Hit the bumping post', `${Math.round(d.mph)} mph`, true);
  else if (what === 'runThrough') JOB.dock('rules', 10, 'Ran through a switch', d.name, true);
  else if (what === 'turnout' && once('tov' + d.name, 20)) JOB.dock('rules', 5, 'Over turnout speed', `${d.name}, ${Math.round(d.mph)} in a ${d.limit}`, true);
  else if (what === 'curve' && once('curve', 8)) JOB.dock('rules', 4, 'Too fast for the curve', `${Math.round(d.mph)} mph`, true);
  else if (what === 'foul' && once('foul', 6)) JOB.dock('rules', 5, 'Ran into cars standing foul', '', true);
};

/* derailed, or the fire went out: the job is over */
JOB.fail = function (title, body) {
  const R = JOB.run; if (!R || R.over) return false;
  R.over = true; R.failed = { title, body }; R.end = JOB.clock();
  setTimeout(() => JOB.results(), 900);
  JOB.ui();
  return true;
};

/* ---------------- every frame ---------------- */
JOB.tick = function (dt) {
  const R = JOB.run, T = GAME.train; if (!R || R.over || !T) return;
  const now = JOB.clock(), av = Math.abs(S.v), mph = av / MPH, ep = R.ep;
  // overspeed: three mph over the board for more than three seconds
  if (mph > S.limit + 3) {
    if (!ep.over) ep.over = { t: 0, peak: 0, limit: S.limit };
    ep.over.t += dt; ep.over.peak = Math.max(ep.over.peak, mph); ep.over.limit = Math.min(ep.over.limit, S.limit);
  } else if (ep.over && mph < S.limit + 1) { JOB.closeOver(); }
  // emergency brake application while moving
  const emg = brakeZone(S.brakeH) === 'EMG';
  if (emg && av > 0.5 && !ep.emg) { ep.emg = true; JOB.dock('handling', 8, 'Emergency brake application', `${Math.round(mph)} mph`); }
  if (!emg) ep.emg = false;
  // wheel slip
  if (S.slip && !ep.slip && R.items.filter(i => i.label === 'Slipped the drivers').length < 5) JOB.dock('handling', 1, 'Slipped the drivers', '');
  ep.slip = S.slip;
  // ride quality: passengers feel hard starts and stops
  if (R.def.kind === 'passenger') {
    const a = Math.abs(S.accel || 0);
    if (a > 0.8 && av > 0.3) { ep.rough = (ep.rough || 0) + dt; ep.roughPk = Math.max(ep.roughPk || 0, a); }
    else if (ep.rough !== undefined) {
      if (ep.rough > 0.6) JOB.dock('handling', ep.roughPk > 1.3 ? 4 : 2, 'Rough ride', `${(ep.roughPk / (MPH)).toFixed(1)} mph per second`);
      ep.rough = undefined; ep.roughPk = 0;
    }
  }
  // when the train last started moving from a stand
  if (av > 0.3 && R.lastV <= 0.3) R.moveAt = now;
  R.lastV = av;
  if (av < 0.05) R.lastStop += dt; else R.lastStop = 0;
  JOB.hz += dt; if (JOB.hz < 0.1) return; JOB.hz = 0;
  JOB.steps(R, T, now);
};
JOB.closeOver = function () {
  const o = JOB.run && JOB.run.ep.over; if (!o) return;
  JOB.run.ep.over = null;
  if (o.t < 3) return;
  const pts = 2 + Math.floor(o.t / 10) + (o.peak > o.limit + 10 ? 3 : 0);
  JOB.dock('rules', pts, 'Overspeed', `${Math.round(o.peak)} in a ${o.limit} for ${Math.round(o.t)} s`);
};

function cabPos(T) { return T.worldOf(new THREE.Vector3(T.loco.cabEye.x, 0, 0)); }
/* a consist stands clear of every switch */
function foulOf(c) {
  for (const sw of NET.switches) for (const p of c.pts) for (const att of sw.node.att) {
    if (p.tp.e !== att.edge) continue;
    const d = att.end === 0 ? p.tp.s : att.edge.len - p.tp.s; if (d < FOUL) return sw;
  }
  return null;
}
const cutOf = v => CARS.cuts.find(c => c.vehicles.includes(v)) || null;

JOB.steps = function (R, T, now) {
  const st = R.steps[R.i]; if (!st) return;
  const done = () => { st.state = 'done'; st.t = now; R.i++; carPanelState.key = ''; if (R.i >= R.steps.length) JOB.finish(); else JOB.ui(); };
  const lateBy = due => now - due;
  if (st.type === 'depart' || st.type === 'stop') {
    const sn = stationNamed(st.at), cab = cabPos(T), d = cab.distanceTo(sn.p);
    const along = _v1.subVectors(cab, sn.p).dot(T.lead.fwd);
    const near = d < PLATFORM;
    if (st.type === 'depart') {
      if (!near) {
        st.depT = R.moveAt != null ? R.moveAt : now;
        if (st.depT < st.dep - 5) JOB.dock('time', 5, `Left ${st.at} early`, `${fmtDur(st.dep - st.depT)} before ${fmtClock(st.dep)}`);
        toast(`Departed ${st.at}${st.depT >= st.dep - 5 ? ' on time' : ''}. Next stop ${R.steps[R.i + 1].at}, due ${fmtClock(R.steps[R.i + 1].arr)}.`, 'good', 4200, 'jobdep');
        done();
      }
      return;
    }
    // stopping at a station
    if (st.state === 'todo' || st.state === 'ranby') {
      if (near && R.lastStop > 1.2) {
        st.state = 'at'; st.arrT = st.arrT || now; st.ft = Math.round(Math.abs(along) / FT); st.past = along > 0;
        const late = lateBy(st.arr);
        const timing = late > 59 ? `${Math.ceil(late / 60)} min late` : late < -60 ? `${Math.floor(-late / 60)} min early` : 'on time';
        const mark = st.ft < 25 ? 'right on the mark' : `${st.ft} ft ${st.past ? 'past' : 'short of'} the mark`;
        toast(`${st.at}: ${timing}, ${mark}.${st.dep ? ` Depart ${fmtClock(st.dep)}.` : ''}`, late > 59 || st.ft >= 80 ? 'warn' : 'good', 5200, 'jobarr');
        if (!st.dep) { JOB.scoreStop(st); done(); }
        else JOB.ui();
        return;
      }
      if (near) st.seen = true;
      if (st.seen && !near && along > PLATFORM && st.state === 'todo') { st.state = 'ranby'; toast(`You ran by ${st.at}. Stop and back up to the platform.`, 'bad', 5000, 'ranby'); }
      // carried on without stopping: the stop is missed
      const next = R.steps[R.i + 1];
      const nextNear = next && next.at && cab.distanceTo(stationNamed(next.at).p) < PLATFORM * 3;
      if (st.state === 'ranby' && (along > 1500 || nextNear)) {
        st.state = 'missed'; JOB.dock('rules', 15, `Missed the ${st.at} stop`, '');
        if (!next) { JOB.finish(); return; }
        done(); st.state = 'missed';
      }
      return;
    }
    if (st.state === 'at') {
      // re-spotting at the platform is fine; the stop counts from the last time the train came to rest
      if (near && R.lastStop > 1.2) { st.ft = Math.round(Math.abs(along) / FT); st.past = along > 0; }
      if (!near) {
        st.depT = R.moveAt != null ? R.moveAt : now;
        if (st.depT < st.dep - 5) JOB.dock('time', 5, `Left ${st.at} early`, `${fmtDur(st.dep - st.depT)} before ${fmtClock(st.dep)}`);
        JOB.scoreStop(st); done();
      }
    }
    return;
  }
  if (st.type === 'pass') {
    const sn = stationNamed(st.at);
    if (T.lead.pos.distanceTo(sn.p) < 40) {
      st.passT = now; const late = lateBy(st.by);
      if (late > 0) JOB.dock('time', Math.min(8, 2 * Math.ceil(late / 60)), `Late past ${st.at}`, `${fmtDur(late)} behind ${fmtClock(st.by)}`);
      toast(`By ${st.at} at ${fmtClock(now)}: ${late > 0 ? fmtDur(late) + ' late' : fmtDur(-late) + ' to spare'}.`, late > 0 ? 'warn' : 'good', 4200, 'jobpass');
      done();
    }
    return;
  }
  if (st.type === 'clear') {
    if (R.lastStop < 2) return;
    const edge = JOB.edgeBetween(st.between); if (!edge) return;
    const ok = T.pts.every(p => p.tp.e === edge && p.tp.s > FOUL && p.tp.s < edge.len - FOUL);
    if (!ok) { st.why = T.pts.some(p => p.tp.e === edge) ? 'Not all of the train is in the clear' : ''; return; }
    st.why = ''; st.doneT = now; const late = lateBy(st.by);
    if (late > 0) JOB.dock('time', Math.min(20, 4 * Math.ceil(late / 60)), `Late into ${st.where}`, `${fmtDur(late)} behind ${fmtClock(st.by)}`);
    done();
    return;
  }
  if (st.type === 'pickup') {
    if (R.cars.length && R.cars.every(v => T.vehicles.includes(v))) { toast(`All ${R.cars.length} cars coupled. ${R.steps[R.i + 1].text}.`, 'good', 5200, 'jobpick'); done(); }
    else st.got = R.cars.filter(v => T.vehicles.includes(v)).length;
    return;
  }
  if (st.type === 'spot') {
    st.why = '';
    if (R.cars.some(v => T.vehicles.includes(v))) return;
    const cuts = [...new Set(R.cars.map(cutOf))];
    if (cuts.some(c => !c || c.rolling || Math.abs(c.v) > 0.01)) return;
    const wrong = R.cars.find(v => v.ptsAll.some(p => !p.tp.e.line || p.tp.e.line.name !== st.to));
    if (wrong) { const ln = wrong.fp[0].tp.e.line; st.why = `The cars are on ${ln ? ln.name : 'the wrong track'}, not ${st.to}`; return; }
    for (const c of cuts) { const sw = foulOf(c); if (sw) { st.why = `The cut is foul of ${sw.name}: shove it clear`; return; } }
    st.doneT = now;
    const late = lateBy(R.def.due);
    if (late > 0) JOB.dock('time', Math.min(40, 3 * Math.ceil(late / 60)), 'Late finishing the work', `${fmtDur(late)} after ${fmtClock(R.def.due)}`);
    done();
  }
};
JOB.edgeBetween = function (names) {
  const [a, b] = names.map(n => NET.switches.find(s => s.name === n).node);
  return NET.edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || null;
};
/* time and platform for a stop the train has left or finished at */
JOB.scoreStop = function (st) {
  const late = st.arrT - st.arr;
  if (late > 59) JOB.dock('time', Math.min(12, 3 * Math.ceil((late - 59) / 60)), `Late into ${st.at}`, `${fmtDur(late)} behind ${fmtClock(st.arr)}`);
  if (st.ft >= 200) JOB.dock('handling', 5, `Off the platform at ${st.at}`, `${st.ft} ft ${st.past ? 'past' : 'short'}`);
  else if (st.ft >= 80) JOB.dock('handling', 3, `Missed the mark at ${st.at}`, `${st.ft} ft ${st.past ? 'past' : 'short'}`);
  else if (st.ft >= 25) JOB.dock('handling', 1, `Off the mark at ${st.at}`, `${st.ft} ft ${st.past ? 'past' : 'short'}`);
};

JOB.finish = function () {
  const R = JOB.run; if (!R || R.over) return;
  JOB.closeOver();
  R.over = true; R.end = JOB.clock();
  const sc = JOB.total(R).total, prev = JOB.best[R.def.id];
  R.prevBest = prev ? prev.score : null;
  if (!prev || sc > prev.score) JOB.best[R.def.id] = { score: sc, stars: starsFor(sc), at: Date.now() };
  JOB.save();
  toast(`${R.def.name} complete: ${sc} points.`, 'good', 4000, 'jobdone');
  setTimeout(() => JOB.results(), 1600);
  JOB.ui();
};

/* ---------------- what the HUD shows ---------------- */
JOB.task = function () {
  const R = JOB.run; if (!R) return null;
  const now = JOB.clock();
  if (R.over) return R.failed ? { text: 'Job over: ' + R.failed.title.toLowerCase(), sub: 'Tap for the results', kind: 'bad' } : { text: 'Job complete', sub: `${JOB.total(R).total} points · tap for the results`, kind: 'good' };
  const st = R.steps[R.i], cd = (t, verb) => { const d = t - now; return d >= 0 ? { s: `${verb} ${fmtClock(t)} · ${fmtDur(d)}`, k: d < 60 ? 'warn' : '' } : { s: `${verb} ${fmtClock(t)} · ${fmtDur(-d)} late`, k: 'bad' }; };
  if (st.type === 'depart') { const d = st.dep - now; return { text: `Depart ${st.at} at ${fmtClock(st.dep)}`, sub: d > 0 ? `in ${fmtDur(d)}` : 'Highball: you are clear to go', kind: d > 0 ? '' : 'good' }; }
  if (st.type === 'stop') {
    if (st.state === 'at') { const d = st.dep - now; return { text: `At ${st.at} · depart ${fmtClock(st.dep)}`, sub: d > 0 ? `in ${fmtDur(d)}` : 'Highball: you are clear to go', kind: d > 0 ? '' : 'good' }; }
    const c = cd(st.arr, 'due');
    return { text: st.state === 'ranby' ? `Back up to the ${st.at} platform` : `Stop at ${st.at}`, sub: c.s, kind: st.state === 'ranby' ? 'bad' : c.k };
  }
  if (st.type === 'pass') { const c = cd(st.by, 'by'); return { text: `Pass ${st.at}`, sub: c.s, kind: c.k }; }
  const c = cd(stepDue(R, st), 'by');
  if (st.type === 'pickup') return { text: st.text, sub: (st.got ? `${st.got} of ${R.cars.length} coupled · ` : '') + c.s, kind: c.k };
  return { text: st.text, sub: st.why ? st.why : c.s, kind: st.why ? 'warn' : c.k };
};

JOB.ui = function () {
  const box = $('jobBox'); if (!box) return;
  box.hidden = !JOB.run; $('hud').classList.toggle('job', !!JOB.run);
  JOB.hud(true);
  if (!$('jobPanel').hidden) JOB.panel();
};
let jobHudT = 0;
JOB.hud = function (force) {
  const R = JOB.run; if (!R) return;
  if (!force && (jobHudT += 1) % 3) return;
  const t = JOB.task(), now = R.over ? R.end : JOB.clock();
  $('jobClock').textContent = fmtClockS(now);
  $('jobName').textContent = R.def.name;
  $('jobScore').textContent = JOB.total(R).total;
  const tk = $('jobTask'); if (tk.textContent !== t.text) tk.textContent = t.text;
  const sb = $('jobSub'); sb.textContent = t.sub; sb.className = t.kind || '';
};

/* the job sheet: every step, the timetable and what has cost points so far */
JOB.panel = function () {
  const R = JOB.run, p = $('jobPanel'); if (!R) { p.hidden = true; return; }
  const now = R.over ? R.end : JOB.clock();
  $('jpTitle').textContent = R.def.name;
  $('jpBody').innerHTML = JOB.sheet(R, now, true);
  $('jpAbandon').textContent = R.over ? 'Close job' : 'Abandon job';
};
/* the steps as a table (shared by the briefing, the live sheet and the results) */
JOB.sheet = function (R, now, live) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = R.steps.map((st, i) => {
    const cur = live && R && !R.over && i === R.i;
    const mark = st.state === 'done' ? '<i class="ok">✓</i>' : st.state === 'missed' ? '<i class="no">✕</i>' : cur ? '<i class="cur">▸</i>' : '<i></i>';
    let what, sched = '', act = '';
    if (st.type === 'depart') { what = `Depart ${st.at}`; sched = fmtClock(st.dep); act = st.depT != null ? fmtClockS(st.depT) : ''; }
    else if (st.type === 'stop') { what = st.dep ? `${st.at}` : `Arrive ${st.at}`; sched = st.dep ? `${fmtClock(st.arr)}–${fmtClock(st.dep)}` : fmtClock(st.arr); act = st.arrT != null ? fmtClockS(st.arrT) + (st.ft != null ? ` · ${st.ft < 25 ? 'on the mark' : st.ft + ' ft'}` : '') : st.state === 'missed' ? 'missed' : ''; }
    else if (st.type === 'pass') { what = `Pass ${st.at}`; sched = 'by ' + fmtClock(st.by); act = st.passT != null ? fmtClockS(st.passT) : ''; }
    else { what = st.text; sched = (st.by || (st.type === 'spot' && R.def.due)) ? 'by ' + fmtClock(st.by || R.def.due) : ''; act = st.doneT != null ? fmtClockS(st.doneT) : st.t != null ? fmtClockS(st.t) : ''; }
    const late = (st.arrT != null && st.arrT - st.arr > 59) || (st.passT != null && st.passT > st.by) || (st.doneT != null && st.doneT > (st.by || R.def.due || Infinity));
    const hint = cur && st.hint ? `<div class="jh">${esc(st.hint)}</div>` : '';
    return `<div class="jr${cur ? ' cur' : ''}">${mark}<span class="jw">${esc(what)}${hint}</span><span class="js">${sched}</span><span class="ja${late ? ' late' : ''}">${act}</span></div>`;
  }).join('');
  let ded = '';
  if (R.items) {
    const groups = [];
    for (const it of R.items) { let g = groups.find(x => x.label === it.label); if (!g) groups.push(g = { label: it.label, n: 0, pts: 0, detail: '' }); g.n++; g.pts += it.pts; g.detail = it.detail; }
    ded = groups.length ? groups.map(g => `<div class="jd"><span>${esc(g.label)}${g.n > 1 ? ` ×${g.n}` : ''}<small>${esc(g.detail || '')}</small></span><b>−${g.pts}</b></div>`).join('') : (live ? '<div class="jd none">Clean so far: nothing has cost you a point.</div>' : '');
  }
  return `<div class="jt">${rows}</div>${ded ? `<div class="lbl jl">Marks against you</div><div class="jds">${ded}</div>` : ''}`;
};

/* ---------------- results ---------------- */
JOB.results = function () {
  const R = JOB.run; if (!R || !R.over) return;
  const { cats, total } = JOB.total(R), card = $('jobDone');
  const fail = R.failed, st = fail ? 0 : starsFor(total);
  card.classList.toggle('fail', !!fail);
  $('jdEyebrow').textContent = `${R.def.name} · ${fmtDur(R.end - R.def.start)} on the clock`;
  $('jdTitle').textContent = fail ? fail.title : ['Completed', 'Good work', 'Fine run', 'Superintendent\'s commendation'][st];
  $('jdStars').textContent = fail ? '' : stars(st);
  $('jdScore').innerHTML = fail ? '' : `<b>${total}</b><small>/ 100</small>`;
  $('jdFail').textContent = fail ? fail.body + ' The job is over.' : '';
  $('jdBest').textContent = fail ? '' : R.prevBest == null ? 'First run of this job.' : total > R.prevBest ? `New best: up from ${R.prevBest}.` : `Best so far: ${R.prevBest}.`;
  $('jdCats').innerHTML = fail ? '' : cats.map(c => `<div class="jc"><span>${c.name}</span><i><em style="width:${(c.got / c.max * 100).toFixed(1)}%"></em></i><b>${c.got}<small>/${c.max}</small></b></div>`).join('');
  $('jdSheet').innerHTML = JOB.sheet(R, R.end, false);
  $('jdDrive').textContent = !fail ? 'Keep driving' : /plug/i.test(fail.title) ? 'Relight and drive on' : 'Re-rail and drive on';
  $('jobDone').hidden = false; $('bigMsg').hidden = true;
};
JOB.closeUI = function () { const d = $('jobDone'); if (d) d.hidden = true; const p = $('jobPanel'); if (p) p.hidden = true; };
JOB.again = function () {
  const id = JOB.run.def.id; JOB.closeUI(); JOB.end();
  GAME.settings.job = id; saveSettings(); jobMenu();
  S.derailed = false; GAME.start();
};
JOB.drive = function () {
  const R = JOB.run; JOB.closeUI();
  const failed = R && R.failed;
  JOB.toFree();
  if (failed) GAME.rerail(); else toast('Free running: the railroad is yours.', 'good', 3000);
};
JOB.board = function () { JOB.closeUI(); if (JOB.run && JOB.run.failed) { JOB.end(); GAME.rerail(); } else if (JOB.run && JOB.run.over) JOB.end(); GAME.pause(true); };

/* ---------------- the job board in the menu ---------------- */
function jobMenu() {
  const host = $('optJob'); if (!host) return;
  const ok = JOB.available();
  $('grpJob').hidden = false;
  host.innerHTML = '';
  if (!ok) { $('jobBrief').innerHTML = `<p class="help">${MP.on ? 'Jobs are single player for now. Leave the room to take one.' : 'Jobs are written for the Berkshire Division. Pick it under Railroad to take one.'}</p>`; refreshJobGroups(); return; }
  const opts = [['', 'Free run', 'No clock, no score', null]];
  for (const j of JOBS) { const b = JOB.best[j.id]; opts.push([j.id, j.name, `${{ switch: 'Switching', passenger: 'Passenger', freight: 'Freight' }[j.kind]} · ${j.level}`, b]); }
  const cur = JOB.def(GAME.settings.job) ? GAME.settings.job : '';
  for (const [id, name, sub, best] of opts) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'optJob_' + (id || 'free');
    b.setAttribute('aria-pressed', String(id === cur));
    b.innerHTML = `<span></span><small></small>${best ? `<em class="best" aria-label="Best ${best.score} points">${stars(best.stars)} ${best.score}</em>` : ''}`;
    b.firstChild.textContent = name; b.children[1].textContent = sub;
    b.addEventListener('click', () => { GAME.settings.job = id; [...host.children].forEach(c => c.setAttribute('aria-pressed', String(c === b))); jobBrief(); refreshJobGroups(); startLabel(); saveSettings(); });
    host.appendChild(b);
  }
  jobBrief(); refreshJobGroups();
}
function jobBrief() {
  const j = JOB.wanted(), el = $('jobBrief');
  if (!j) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  const R = { def: j, steps: j.steps.map(s => ({ ...s })) };
  const trains = { light: 'Light engine', passenger: '8 coaches', timefreight: '18 cars, caboose' };
  const b = JOB.best[j.id], last = j.steps[j.steps.length - 1];
  el.innerHTML = `<p class="jb">${j.brief}</p><div class="jm"><span><b>${fmtClock(j.start, true)}</b>On duty</span><span><b>${fmtClock(j.due || last.arr || last.by, true)}</b>${j.due ? 'Work done by' : last.type === 'stop' ? 'Due ' + last.at : 'In the clear by'}</span><span><b>${trains[j.train]}</b>Your train</span><span><b>${b ? stars(b.stars) + ' ' + b.score : '—'}</b>Best</span></div>` + JOB.sheet(R, 0, false);
}
/* a job picks the train and the time of day itself */
function refreshJobGroups() {
  const j = JOB.wanted();
  $('optTrain').parentElement.hidden = !!j; $('optTime').parentElement.hidden = !!j;
}

function jobSetup() {
  JOB.load();
  if (GAME.settings.job && !JOB.def(GAME.settings.job)) GAME.settings.job = '';
  jobMenu();
  $('jobBox').addEventListener('click', () => { const R = JOB.run; if (!R) return; if (R.over) JOB.results(); else { const p = $('jobPanel'); p.hidden = !p.hidden; if (!p.hidden) { $('carPanel').hidden = true; $('btnCars').classList.remove('on'); $('mpPanel').hidden = true; JOB.panel(); } } });
  $('jpClose').addEventListener('click', () => { $('jobPanel').hidden = true; });
  $('jpAbandon').addEventListener('click', () => {
    const b = $('jpAbandon');
    if (JOB.run && !JOB.run.over && !b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'Tap again to abandon'; setTimeout(() => { delete b.dataset.arm; if (JOB.run) JOB.panel(); }, 3000); return; }
    delete b.dataset.arm;
    JOB.toFree();
    toast('Job abandoned. Free running.', 'warn', 3000);
  });
  $('jdAgain').addEventListener('click', () => JOB.again());
  $('jdDrive').addEventListener('click', () => JOB.drive());
  $('jdBoard').addEventListener('click', () => JOB.board());
  setInterval(() => { if (JOB.run && !$('jobPanel').hidden && !S.paused) JOB.panel(); }, 1000);
}

/* job cars and the place the job is headed, on the map */
JOB.drawMap = function (g, tx, ty, opt) {
  const R = JOB.run; if (!R || R.over) return;
  const st = R.steps[R.i]; if (!st) return;
  g.save();
  if (st.type === 'spot') {
    const ln = ROUTE.lines[st.to];
    g.strokeStyle = 'rgba(207,166,81,0.85)'; g.lineWidth = 5 * opt.w; g.setLineDash([6 * opt.w, 5 * opt.w]);
    for (const e of ln.edges) { const L = MAP.lines.find(m => m.e === e); if (!L) continue; g.beginPath(); L.pts.forEach((p, i) => { const x = tx(p[0]), y = ty(p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    g.setLineDash([]);
  }
  const at = st.at || (st.type === 'clear' ? st.where : null), sn = at && stationNamed(at);
  if (sn) { const [X, N] = sn.edge.xz(sn.s); const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250); g.strokeStyle = `rgba(242,179,61,${0.5 + 0.5 * pulse})`; g.lineWidth = 2.5 * opt.w; g.beginPath(); g.arc(tx(X), ty(N), (9 + 4 * pulse) * opt.w, 0, TAU); g.stroke(); }
  // the waybilled cars
  g.fillStyle = '#ffb347';
  for (const v of R.cars) { if (!v.pos) continue; g.beginPath(); g.arc(tx(v.pos.x), ty(-v.pos.z), 2.4 * opt.w, 0, TAU); g.fill(); }
  g.restore();
};
