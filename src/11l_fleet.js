/* ============================================================================
   Your trains: make up more than one, leave one standing while you drive
   another, and take any of them over by clicking it in the world, on the
   map or in the Trains panel (O; [ and ] step through them). A train you
   leave stands where it is with the throttle shut and the brakes set, its
   fire kept up. It is an ordinary consist on the rails: it holds its block,
   holds switches, can be shoved, and cars can be cut off it. Single player.
   ========================================================================== */
const FLEET = { MAX: 8, n: 0, card: null, armed: null, hover: null, hoverAt: 0, uiT: 0, newLoco: null, newCk: null };
/* the parts of S that belong to the railroad and the clock rather than to one engine */
const FLEET_WORLD = ['time', 'paused', 'autoFire', 'autoCut', 'derailed', 'warnTimer', 'wet', 'railP', 'mu', 'grade', 'limit'];
/* the menu settings that say how a train was made up */
const FLEET_CFG = ['loco', 'consist', 'units', 'livery', 'mix', 'custom', 'number', 'finish'];

/* every train you have, the one being driven first, then the others in the order they were made up */
FLEET.parked = () => CARS.cuts.filter(c => c.parkS);
FLEET.all = function () {
  const a = GAME.train ? [GAME.train, ...FLEET.parked()] : FLEET.parked();
  for (const t of a) if (!t.fid) t.fid = ++FLEET.n;
  return a;
};
const fleetOrder = () => FLEET.all().slice().sort((a, b) => a.fid - b.fid);

function fleetCfgOut() {
  const g = GAME.settings; if (!g) return null;
  const o = {}; for (const k of FLEET_CFG) o[k] = k === 'custom' && g.custom ? Object.assign({}, g.custom) : g[k];
  return o;
}
function fleetCfgIn(o) {
  const g = GAME.settings; if (!g || !o) return;
  for (const k of FLEET_CFG) if (o[k] !== undefined) g[k] = k === 'custom' ? Object.assign({}, o.custom) : o[k];
}

/* Leave train T standing: the crew shuts off, sets the train and engine brakes and keeps the fire up. Its
   controls, boiler, air and supplies are kept with it (T.parkS); it joins the consists standing about. */
function fleetPark(T) {
  const st = {};
  for (const k in S) { const x = S[k]; if (typeof x === 'number' ? isFinite(x) : typeof x === 'boolean' || typeof x === 'string') st[k] = x; }
  for (const k of FLEET_WORLD) delete st[k];
  Object.assign(st, { throttle: 0, notch: 0, dyn: 0, whistle: 0, bell: false, sander: false, slip: false, slide: false, brakeH: Math.max(st.brakeH || 0, 0.5), indH: 1, dist0: T.dist });
  T.parkS = st;
  T.cfg = fleetCfgOut() || T.cfg || null;
  T.v = S.v; T.rolling = Math.abs(S.v) > 0.005; T.stopT = 0; T.vented = false;
  // still moving, it brakes to a stand on its own (CARS.step) and is tied down there
  for (const v of T.vehicles) { v.hb = !T.rolling; if (v.brake) v.brake.BC = Math.max(v.brake.BC || 0, 50); }
  if (!CARS.cuts.includes(T)) CARS.cuts.push(T);
  CARS.gen++; if (typeof IX !== 'undefined') IX.idx = null;
  return st;
}
/* take standing train T over: its controls and boiler come back as they were left, and it moves at whatever
   speed it has been shoved to */
function fleetResume(T) {
  const st = T.parkS; if (!st) return false;
  CARS.cuts = CARS.cuts.filter(c => c !== T);
  const theta = st.theta - (T.dist - st.dist0) / (T.diesel ? LG.rD : steamK(LOCO_SPEC[T.locoKey]).rD);
  for (const k in st) if (k !== 'dist0' && !FLEET_WORLD.includes(k)) S[k] = st[k];
  S.theta = theta; S.v = S.vw = T.v || 0;
  T.parkS = null; T.v = 0; T.rolling = false; T.stopT = 0;
  for (const v of T.vehicles) v.hb = false;
  GAME.train = T;
  CARS.gen++; if (typeof IX !== 'undefined') IX.idx = null;
  return true;
}

/* why you cannot make up, change or take off a train right now, or '' */
FLEET.blocked = function () {
  if (!GAME.ready || !GAME.running || !GAME.train) return 'Start a run first.';
  if (MP.on) return 'Running several trains is single player for now: leave the room first.';
  if (JOB.activeId()) return 'A job is worked with one train. Finish it, or abandon it from the job sheet, first.';
  if (PLACE.on) return 'Finish placing first.';
  if (S.derailed) return 'Not until your train is back on the rails.';
  return '';
};

/* ---------------- names ---------------- */
FLEET.name = function (T) {
  const sp = LOCO_SPEC[T.locoKey] || {};
  if (sp.set) return HSR[sp.set].name;
  if (T.diesel) return `${T.nUnits > 1 ? T.nUnits + ' × ' : ''}${sp.short || 'Diesel'} ${(T.loco && T.loco.number) || sp.num || ''}`.trim();
  return `${sp.short} ${T.locoKey}`;
};
FLEET.what = function (T) {
  if (T.elec) return 'trainset';
  const n = T.vehicles.filter(v => !isPower(v)).length;
  return n ? `${n} car${n > 1 ? 's' : ''}` : 'light engine';
};
FLEET.where = function (T) {
  const f = T.endTP('front'), line = PLACE.lineOf(f), p = T.lead.pos;
  let near = null, best = 1500;
  if (p) for (const st of ROUTE.stations) { const d = st.p ? st.p.distanceTo(p) : Infinity; if (d < best) { best = d; near = st.name; } }
  const on = line ? `on ${line}` : 'on the line';
  return near && !line.includes(near) ? `${on} near ${near}` : on;
};
FLEET.status = function (T) {
  const v = T === GAME.train ? S.v : T.v || 0, mph = Math.round(Math.abs(v) / MPH);
  if (T === GAME.train) return `Driving · ${mph} mph · ${FLEET.where(T)}`;
  return `${mph >= 1 ? `Rolling, ${mph} mph` : 'Standing, brakes set'} · ${FLEET.where(T)}`;
};
/* boiler or fuel, as it was left */
FLEET.supplies = function (T) {
  const st = T === GAME.train ? S : T.parkS; if (!st) return '';
  if (T.elec) return st.panUp ? 'Pantograph up' : 'Pantograph down';
  if (T.diesel) return `${Math.round(st.fuel / 3.785).toLocaleString()} gal fuel`;
  return `${Math.round(st.P)} psi · ${Math.round(st.water / 3.785 / 100) / 10}k gal · ${(st.coal / 907.2).toFixed(1)} t coal`;
};

/* ---------------- taking a train over ---------------- */
/* the game picks up the train now being driven */
FLEET.after = function (T) {
  ROAD_SHORT = LOCO_SPEC[T.locoKey].short;
  if (!T.diesel) applySteamFinish(GAME.settings.finish);
  S.limit = Math.min(...T.pts.map(p => p.tp.e.limit));
  buildWhistleIfReady();
  GAME.jointMem = new Map(); GAME.filling = null; GAME.scan = null; GAME.lastStation = null;
  if (IX.PLAYER) Object.assign(IX.PLAYER, { last: null, passed: null });   // the signals the other train was running up to are not this one's
  CAM.init = false;
  T.update(0, S.theta, S.reverser);
  saveSettings(); SAVE.menuSync(); startLabel(); GAME.refreshKeys();
  carPanelState.key = ''; if (CARS.onChange) CARS.onChange();
  FLEET.closeCard(); FLEET.ui(true);
  if (MAP.visible) MAP.draw();
};
/* a train left standing shows only a dimmed headlight */
FLEET.dim = function (T) {
  const L = T.loco; if (!L) return;
  if (L.beam) L.beam.material.opacity = 0;
  if (L.halo) L.halo.material.opacity = T.parkS && T.parkS.light ? 0.22 : 0;
  if (L.ditch) for (const d of L.ditch) { d.lens.material.color.setScalar(0.25); d.halo.material.opacity = 0; }
};
/* take over standing train T (how.walk: he climbed into its cab on foot) */
FLEET.select = function (T, how = {}) {
  const old = GAME.train;
  if (!T || T === old || !T.parkS) return false;
  const why = FLEET.blocked(); if (why) { toast(why, 'warn', 3600, 'fleet'); return false; }
  if (WALK.on && !how.walk) WALK.reset();
  fleetPark(old);
  fleetResume(T);
  T.takeLights(old);
  FLEET.dim(old);
  fleetCfgIn(T.cfg);
  FLEET.after(T);
  old.update(0);
  if (!how.quiet) toast(`Now driving ${FLEET.name(T)}. ${FLEET.name(old)} stands ${FLEET.where(old)} with its brakes set.`, 'good', 4200, 'fleet');
  return true;
};
/* the next (d = 1) or previous (-1) train, in the order they were made up */
FLEET.cycle = function (d) {
  const a = fleetOrder();
  if (a.length < 2) { toast('You have one train. Press O to make up another.', '', 3000, 'fleet'); return; }
  const i = a.indexOf(GAME.train);
  FLEET.select(a[(i + d + a.length) % a.length]);
};
/* the standing train nearest T */
FLEET.nearest = function (T) {
  let best = null, bd = Infinity;
  for (const c of FLEET.parked()) { if (c === T) continue; const d = c.lead.pos && T.lead.pos ? c.lead.pos.distanceTo(T.lead.pos) : 0; if (d < bd) { bd = d; best = c; } }
  return best;
};

/* ---------------- making one up, taking one off ---------------- */
/* clear track for a new train t: the usual yard tracks first (see MP.spawnSlot), else anywhere on a layout */
function fleetSlot(t) {
  if (WORLD.custom) { const tp = MP.layoutSlot(t.length + 4); return tp ? { tp, name: PLAY_LAYOUT.name || 'your layout' } : null; }
  const s = MP.spawnSlot(t); if (!s) return null;
  const loc = s.line.locate(s.s);
  return { tp: new TrackPos(loc.edge, loc.s, 1), name: s.name };
}
/* make up another train (engine key, consist key) on clear track and take it over; the one you were driving stands */
FLEET.add = function (loco, ck) {
  const why = FLEET.blocked(); if (why) { toast(why, 'warn', 3600, 'fleet'); return false; }
  if (!LOCO_SPEC[loco]) return false;
  if (FLEET.all().length >= FLEET.MAX) { toast(`${FLEET.MAX} trains is as many as the railroad holds. Take one off first.`, 'warn', 4000, 'fleet'); return false; }
  const old = GAME.train, g = GAME.settings, set = !!LOCO_SPEC[loco].set;
  if (WALK.on) WALK.reset();
  fleetPark(old);
  g.loco = loco; if (!set) g.consist = ck;
  const t = new Train(scene, loco, set ? 'light' : ck, dieselOpts());
  const slot = fleetSlot(t);
  if (!slot) {
    t.disposeDeep(); fleetCfgIn(old.cfg); fleetResume(old); ROAD_SHORT = LOCO_SPEC[old.locoKey].short;
    toast('No clear track to make up another train. Move one with Place (G), or take one off the railroad.', 'warn', 5200, 'fleet');
    return false;
  }
  t.place(slot.tp);
  prepareTrain(t);
  old.dropLights(); FLEET.dim(old); old.update(0);
  GAME.train = t; t.fid = ++FLEET.n;
  resetState();   // a fresh engine: fire up, full tender, brakes released
  CARS.gen++; IX.idx = null;
  FLEET.after(t);
  toast(`${FLEET.name(t)} made up on ${slot.name}. ${FLEET.name(old)} stands with its brakes set: click it, or press O, to go back to it.`, 'good', 5600, 'fleet');
  return true;
};
/* take train T off the railroad (fromPlace: picked up in Place mode, which already holds everything still) */
FLEET.remove = function (T, fromPlace) {
  if (!T) return false;
  if (!fromPlace) { const why = FLEET.blocked(); if (why) { toast(why, 'warn', 3600, 'fleet'); return false; } }
  if (T === GAME.train) {
    const next = FLEET.nearest(T);
    if (!next) { toast('That is your only train. Make up another before you take this one off.', 'warn', 3600, 'fleet'); return false; }
    if (!FLEET.select(next, { quiet: true })) return false;
  }
  if (!T.parkS) return false;
  const name = FLEET.name(T);
  if (WALK.ride && WALK.ride.c === T) WALK.reset();
  if (CPL.hover && CPL.hover.c === T) CPL.point(null);
  if (FLEET.hover === T) FLEET.point(null);
  CARS.cuts = CARS.cuts.filter(c => c !== T);
  T.disposeDeep();
  CARS.gen++; IX.idx = null; carPanelState.key = ''; if (CARS.onChange) CARS.onChange();
  FLEET.closeCard(); FLEET.ui(true);
  if (MAP.visible) MAP.draw();
  toast(`${name} taken off the railroad.${GAME.train ? ` You are driving ${FLEET.name(GAME.train)}.` : ''}`, '', 3600, 'fleet');
  return true;
};

/* ---------------- pointing at a train in the world ---------------- */
const _flA = new THREE.Vector3();
/* the standing train under screen point (x, y), within reach */
FLEET.at = function (x, y) {
  let best = null, bd = Infinity;
  const ppm = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)), cam = camera.position;
  for (const c of FLEET.parked()) for (const v of c.vehicles) {
    if (!v.pos || v.root.visible === false) continue;
    const dc = v.pos.distanceTo(cam); if (dc > 900) continue;
    const lim = Math.max(18, 1.6 * ppm / dc);
    _flA.copy(v.pos).addScaledVector(v.fwd, v.len / 2); _flA.y += 1.9; const a = placeScreen(_flA);
    _flA.copy(v.pos).addScaledVector(v.fwd, -v.len / 2); _flA.y += 1.9; const b = placeScreen(_flA);
    if (!a || !b) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
    const d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
    if (d < lim && d + dc * 0.01 < bd) { bd = d + dc * 0.01; best = c; }
  }
  return best;
};
/* a tap or click on a standing train opens its card */
FLEET.tap = function (x, y) {
  if (MP.on || !GAME.running) return false;
  const c = FLEET.at(x, y); if (!c) return false;
  FLEET.openCard(c, x, y);
  return true;
};
/* mouse hover: say what a click will do (a few times a second: it projects every car) */
FLEET.point = function (x, y) {
  const tip = $('cplTip');
  if (x === null) { if (FLEET.hover) { FLEET.hover = null; tip.hidden = true; $('gl').style.cursor = ''; } return; }
  const now = performance.now(); if (now - FLEET.hoverAt < 90) return; FLEET.hoverAt = now;
  const c = MP.on ? null : FLEET.at(x, y);
  if (!c) { FLEET.point(null); return; }
  FLEET.hover = c;
  $('gl').style.cursor = 'var(--cur-hot, pointer)';
  tip.textContent = `${FLEET.name(c)} · ${FLEET.what(c)} · click to take it over`; tip.hidden = false;
  tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, x + 14) + 'px'; tip.style.top = Math.max(8, y - 34) + 'px';
};

/* ---------------- the card for one train ---------------- */
FLEET.openCard = function (c, x, y) {
  FLEET.card = c; FLEET.armed = null;
  const el = $('fleetCard'); el.hidden = false;
  FLEET.cardFill();
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = clamp((x === undefined ? innerWidth / 2 : x) - w / 2, 8, innerWidth - w - 8) + 'px';
  el.style.top = clamp((y === undefined ? innerHeight / 3 : y) - h - 18, 8, innerHeight - h - 8) + 'px';
};
FLEET.closeCard = function () { FLEET.card = null; FLEET.armed = null; const el = $('fleetCard'); if (el) el.hidden = true; };
FLEET.cardFill = function () {
  const c = FLEET.card; if (!c) return;
  if (c !== GAME.train && !CARS.cuts.includes(c)) { FLEET.closeCard(); return; }
  const set = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
  set('fcName', FLEET.name(c)); set('fcWhat', FLEET.what(c));
  set('fcStatus', FLEET.status(c)); set('fcSup', FLEET.supplies(c));
  const drive = $('fcDrive'), del = $('fcDelete'), mine = c === GAME.train;
  drive.disabled = mine; drive.textContent = mine ? 'Driving this one' : 'Take it over';
  del.textContent = FLEET.armed === c ? 'Tap again to remove' : 'Take off railroad';
  del.classList.toggle('warn', FLEET.armed === c);
};

/* ---------------- the Trains panel ---------------- */
FLEET.toggle = function (open) {
  const p = $('fleetPanel'), on = open === undefined ? p.hidden : open;
  if (on && MP.on) { toast('Running several trains is single player for now: leave the room first.', 'warn', 3600, 'fleet'); return; }
  p.hidden = !on; $('btnTrains').classList.toggle('on', on);
  if (on) { carPanelToggle(false); $('mpPanel').hidden = true; FLEET.armed = null; FLEET.ui(true); }
};
/* the delete button asks twice */
FLEET.ask = function (c) {
  if (FLEET.armed === c) { FLEET.armed = null; FLEET.remove(c); return; }
  FLEET.armed = c; FLEET.ui(true); FLEET.cardFill();
  setTimeout(() => { if (FLEET.armed === c) { FLEET.armed = null; FLEET.ui(true); FLEET.cardFill(); } }, 3500);
};
FLEET.chips = function () {
  const g = GAME.settings;
  if (!FLEET.newLoco || !$('optLoco_' + FLEET.newLoco)) FLEET.newLoco = g.loco;
  if (!FLEET.newCk || !CONSISTS[FLEET.newCk] || CONSISTS[FLEET.newCk].hidden) FLEET.newCk = CONSISTS[g.consist] && !CONSISTS[g.consist].hidden ? g.consist : 'light';
  const host = $('fleetEngines'), key = [...$('optLoco').children].map(b => b.id).join();
  if (host.dataset.k !== key) {
    host.dataset.k = key; host.innerHTML = '';
    for (const b of $('optLoco').children) {
      const k = b.id.replace('optLoco_', ''), c = document.createElement('button');
      c.type = 'button'; c.className = 'pchip'; c.dataset.loco = k; c.textContent = b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent : b.textContent;
      c.addEventListener('click', () => { FLEET.newLoco = k; FLEET.chips(); });
      host.appendChild(c);
    }
    const th = $('fleetTrains'); th.innerHTML = '';
    for (const k in CONSISTS) {
      if (CONSISTS[k].hidden) continue;
      const c = document.createElement('button'); c.type = 'button'; c.className = 'pchip'; c.dataset.ck = k; c.textContent = CONSISTS[k].name;
      c.addEventListener('click', () => { FLEET.newCk = k; FLEET.chips(); });
      th.appendChild(c);
    }
  }
  const set = !!LOCO_SPEC[FLEET.newLoco].set;
  for (const c of host.children) c.setAttribute('aria-pressed', String(c.dataset.loco === FLEET.newLoco));
  for (const c of $('fleetTrains').children) { c.setAttribute('aria-pressed', String(!set && c.dataset.ck === FLEET.newCk)); c.disabled = set; }
};
FLEET.ui = function (force) {
  const b = $('btnTrains'); if (b) b.hidden = MP.on;
  const n = FLEET.all().length, cnt = $('fleetCount'); if (cnt) { const t = n > 1 ? String(n) : ''; if (cnt.textContent !== t) cnt.textContent = t; }
  const p = $('fleetPanel'); if (!p || p.hidden) return;
  const list = $('fleetList'), rows = fleetOrder();
  const key = rows.map(c => c.fid + (c === GAME.train ? '*' : '') + (FLEET.armed === c ? '!' : '')).join();
  if (force || list.dataset.k !== key) {
    list.dataset.k = key; list.innerHTML = '';
    for (const c of rows) {
      const mine = c === GAME.train, row = document.createElement('div'); row.className = 'flRow' + (mine ? ' mine' : '');
      row.innerHTML = '<i></i><div class="mpN"><b></b><span></span></div><div class="flBtns"></div>';
      row.querySelector('b').textContent = `${FLEET.name(c)} · ${FLEET.what(c)}`;
      row.querySelector('span').dataset.fid = c.fid;
      const bx = row.querySelector('.flBtns');
      if (mine) { const t = document.createElement('em'); t.textContent = 'Driving'; bx.appendChild(t); }
      else { const d = document.createElement('button'); d.type = 'button'; d.className = 'btn prim'; d.textContent = 'Drive'; d.addEventListener('click', () => FLEET.select(c)); bx.appendChild(d); }
      const x = document.createElement('button'); x.type = 'button'; x.className = 'btn' + (FLEET.armed === c ? ' warn' : ''); x.textContent = FLEET.armed === c ? 'Sure?' : 'Remove';
      x.setAttribute('aria-label', `Take ${FLEET.name(c)} off the railroad`); x.disabled = rows.length < 2;
      x.addEventListener('click', () => FLEET.ask(c)); bx.appendChild(x);
      list.appendChild(row);
    }
    FLEET.chips();
    $('fleetAdd').disabled = n >= FLEET.MAX;
  }
  // what each train is doing, kept fresh while the panel is open
  for (const s of list.querySelectorAll('span[data-fid]')) { const c = rows.find(r => r.fid === +s.dataset.fid); if (c) { const t = FLEET.status(c); if (s.textContent !== t) s.textContent = t; } }
};
/* twice a second while running: the panel and the card follow the trains */
FLEET.frame = function (dt) {
  FLEET.uiT += dt; if (FLEET.uiT < 0.5) return; FLEET.uiT = 0;
  FLEET.ui(); if (FLEET.card) FLEET.cardFill();
};

/* ---------------- the map ---------------- */
FLEET.drawMap = function (g, tx, ty, opt) {
  for (const c of FLEET.parked()) {
    if (!c.lead.pos) continue;
    g.strokeStyle = '#d9b45a'; g.lineWidth = 4 * opt.w; g.beginPath();
    c.vehicles.forEach((v, i) => { const x = tx(v.pos.x), y = ty(-v.pos.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const q = c.lead.pos, x = tx(q.x), y = ty(-q.z);
    g.fillStyle = '#ffe08a'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 3.2 * opt.w, 0, TAU); g.fill(); g.stroke();
    if (opt.labels) { g.font = `700 ${opt.fs}px "IBM Plex Sans Condensed", sans-serif`; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; const t = FLEET.name(c); g.strokeText(t, x + 7, y - 7); g.fillStyle = '#ffe08a'; g.fillText(t, x + 7, y - 7); }
  }
};
/* a tap on the full map near one of your standing trains takes it over */
FLEET.mapPick = function (x, y) {
  if (MP.on || !MAP.t) return null;
  let best = null, bd = 16;
  for (const c of FLEET.parked()) for (const v of c.vehicles) {
    if (!v.pos) continue;
    const d = Math.hypot(MAP.t.tx(v.pos.x) - x, MAP.t.ty(-v.pos.z) - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};

FLEET.setup = function () {
  $('btnTrains').addEventListener('click', () => FLEET.toggle());
  $('fleetClose').addEventListener('click', () => FLEET.toggle(false));
  $('fleetAdd').addEventListener('click', () => FLEET.add(FLEET.newLoco || GAME.settings.loco, FLEET.newCk || 'light'));
  $('fcDrive').addEventListener('click', () => { const c = FLEET.card; if (c) FLEET.select(c); });
  $('fcDelete').addEventListener('click', () => { const c = FLEET.card; if (c) FLEET.ask(c); });
  $('fcClose').addEventListener('click', () => FLEET.closeCard());
  FLEET.ui(true);
};
